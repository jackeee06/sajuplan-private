<?php
// /mtonet/outbox_log.php
include_once('../common.php'); // 경로 맞추기

header('Content-Type: application/json; charset=utf-8');

try {
    // 1) raw 우선
    $raw = file_get_contents('php://input') ?: '';
    $j = json_decode($raw, true);

    // 2) 파싱 못하면 폼/쿼리 백업
    if (!is_array($j)) {
        $j = array_merge($_POST ?: [], $_GET ?: []);
    }

    // 3) 필수 최소키
    $oid      = isset($j['oid']) ? trim($j['oid']) : '';
    $endpoint = isset($j['endpoint']) ? trim($j['endpoint']) : '';

    if ($oid === '' || $endpoint === '') {
        http_response_code(400);
        echo json_encode(['ok'=>false, 'reason'=>'missing oid/endpoint', 'got'=>$j]);
        exit;
    }

    // 4) DB 저장 (필드명/테이블은 환경 맞게 조정)
    $cpid    = sql_escape_string($j['cpid']    ?? '');
    $membid  = sql_escape_string($j['membid']  ?? '');
    $amt     = (int)($j['amount']  ?? 0);
    $coinamt = (int)($j['coinamt'] ?? 0);
    $pmethod = sql_escape_string($j['paymethod'] ?? '');
    $ua      = sql_escape_string($_SERVER['HTTP_USER_AGENT'] ?? '');
    $rip     = sql_escape_string($_SERVER['REMOTE_ADDR'] ?? '');
    $is_mob  = (int)($j['is_mobile'] ?? 0);

    $payload = sql_escape_string(json_encode($j, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $oid_esc = sql_escape_string($oid);
    $endpoint_esc = sql_escape_string($endpoint);

    $exists = sql_fetch("SELECT id FROM saju_pay_outbox WHERE oid='{$oid_esc}'");
    if (!empty($exists['id'])) {
        $q = "
        UPDATE saju_pay_outbox SET
            cpid='{$cpid}', membid='{$membid}',
            paymethod='{$pmethod}', amount={$amt}, coinamt={$coinamt},
            endpoint_url='{$endpoint_esc}', http_method='POST',
            payload='{$payload}', user_agent='{$ua}', remote_ip='{$rip}',
            is_mobile={$is_mob}, updated_at=NOW()
        WHERE id='{$exists['id']}' LIMIT 1";
        sql_query($q);
    } else {
        $q = "
        INSERT INTO saju_pay_outbox
        (oid, cpid, membid, paymethod, amount, coinamt,
         endpoint_url, http_method, payload,
         user_agent, remote_ip, is_mobile,
         created_at, updated_at)
        VALUES
        ('{$oid_esc}','{$cpid}','{$membid}','{$pmethod}',{$amt},{$coinamt},
         '{$endpoint_esc}','POST','{$payload}',
         '{$ua}','{$rip}',{$is_mob},
         NOW(), NOW())";
        sql_query($q);
    }

    echo json_encode(['ok'=>true]);
} catch (Throwable $e) {
    // 파일 로그도 남겨 원인 추적
    error_log('[outbox_log.php] '.$e->getMessage().' @'.$e->getFile().':'.$e->getLine());
    http_response_code(500);
    echo json_encode(['ok'=>false, 'error'=>$e->getMessage()]);
}

