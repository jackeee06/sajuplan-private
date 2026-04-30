<?php
// lib/pay_ag9.php

if (!function_exists('http_json_post')) {
    function http_json_post($url, array $payload, array $headers = []) {
        $ch = curl_init($url);
        $h  = array_merge(
            ['Content-Type: application/json'],
            array_map(fn($k,$v)=>$k.': '.$v, array_keys($headers), $headers)
        );
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => $h,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        $json = json_decode($body, true);
        return ['code'=>$code, 'body'=>$body, 'json'=>$json, 'curl_err'=>$err];
    }
}

function pay_cancel_full($oid, $reason='') {
    // 0) 원거래
    $row = sql_fetch("SELECT * FROM saju_payment WHERE Oid='".sql_real_escape_string($oid)."'");
    if (!$row) return ['ok'=>false,'err'=>'NOT_FOUND'];
    if ($row['ReqResult'] !== '0000') return ['ok'=>false,'err'=>'ORIG_NOT_APPROVED'];
    if (!empty($row['cancel_status']) && $row['cancel_status'] !== 'N') {
        return ['ok'=>true,'already'=>true]; // 멱등 처리
    }
    // 당일 제한 (PG 정책 기준)
    if (date('Y-m-d', strtotime($row['od_time'])) !== date('Y-m-d')) {
        return ['ok'=>false,'err'=>'ONLY_TODAY_ALLOWED'];
    }

    // 가상계좌/무통장 케이스 제한 (필요 시 정책에 맞게 열어도 됨)
    $block_paytypes = ['GNR_VRBANK','VRBANK_PAY','GNR_MOB_PAVC','GNR_PC_PAVC'];
    if (in_array($row['PayMethod'], $block_paytypes, true)) {
        return ['ok'=>false,'err'=>'CANCEL_NOT_SUPPORTED_FOR_VIRTUAL_ACCOUNT'];
    }

    // 1) 아웃박스 로그(요청)
    $endpoint = '/cptl/cancelpay/gnrc_cancel_pay'; // 전액취소
    $payload  = ['oid' => $oid];
    sql_query("INSERT INTO saju_pay_outbox (request_type,endpoint,http_method,oid,membid,amount,coinamt,headers_json,payload_json,created_at)
               VALUES ('CANCEL','{$endpoint}','POST','".sql_real_escape_string($oid)."','".sql_real_escape_string($row['Membid'])."',".(int)$row['Amount'].",".(int)$row['Coin_Amount'].",NULL,'".sql_real_escape_string(json_encode($payload,JSON_UNESCAPED_UNICODE))."',NOW())");

    // 2) PG 호출
    $res = http_json_post(AG9_HOST.$endpoint, $payload, ['Authorization'=>AG9_AUTH_TOKEN]);
    $ok  = ($res['code']>=200 && $res['code']<300);
    $jr  = is_array($res['json']) ? $res['json'] : [];
    if (isset($jr['req_result'])) {
        // 문서 포맷에 맞춰 성공 코드 확인 (예: '00' 또는 '0000')
        $ok = ($jr['req_result']==='00' || $jr['req_result']==='0000');
    }

    if (!$ok) {
        // 응답 기록
        sql_query("UPDATE saju_pay_outbox
                   SET response_code=".(int)$res['code'].",
                       response_body='".sql_real_escape_string($res['body'])."'
                   WHERE id=LAST_INSERT_ID()");
        return ['ok'=>false,'err'=>$jr['resultmsg'] ?? 'PG_CANCEL_FAILED','res'=>$res];
    }

    // 3) 트랜잭션 권장
    // sql_query('START TRANSACTION');

    // 3-1) 포인트 회수 (음수)
    $cancel_coin = (int)$row['Coin_Amount'];
    insert_point($row['mb_id'], -$cancel_coin, "결제취소({$oid})", '@member', $row['mb_id'], "CANCEL:{$oid}");

    // 3-2) 엠투넷 동기화 (마이너스)
    $data = json_encode(['amt' => -$cancel_coin], JSON_UNESCAPED_UNICODE);
    $jresult = send_mjson1('memb-mgr', $data, 'PUT', $row['Membid']);
    $mtxt = ($jresult['req_result'] ?? '') === '00' ? '코인회수성공' : '코인회수실패';

    // 3-3) 원거래 취소 마킹
    $cancel_tid = $jr['tid'] ?? '';
    sql_query("UPDATE saju_payment
               SET cancel_status='FULL',
                   cancel_amount=".(int)$row['Amount'].",
                   cancel_coin_amount=".$cancel_coin.",
                   cancel_reason='".sql_real_escape_string($reason)."',
                   cancel_tid='".sql_real_escape_string($cancel_tid)."',
                   cancel_at=NOW(),
                   cancel_req_payload='".sql_real_escape_string(json_encode($payload,JSON_UNESCAPED_UNICODE))."',
                   cancel_res_payload='".sql_real_escape_string(json_encode($jr,JSON_UNESCAPED_UNICODE))."',
                   mtonet='".sql_real_escape_string($mtxt)."'
               WHERE Oid='".sql_real_escape_string($oid)."'");

    // sql_query('COMMIT');

    // 3-4) 아웃박스 응답 기록
    sql_query("UPDATE saju_pay_outbox
               SET response_code=".(int)$res['code'].",
                   response_body='".sql_real_escape_string($res['body'])."'
               WHERE id=LAST_INSERT_ID()");

    return ['ok'=>true];
}
