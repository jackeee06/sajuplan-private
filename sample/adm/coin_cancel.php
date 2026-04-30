<?php
// /adm/coin_cancel.php
include_once('../common.php');
include_once(G5_LIB_PATH.'/pay_ag9.php'); // pay_cancel($oid, $partial, $recamt, $reccoin, $reason)

header('Content-Type: application/json; charset=utf-8');

// 관리자만
if (empty($is_admin)) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'err'=>'NO_PERMISSION']); exit;
}

// JSON/FORM 입력 파싱
$raw = file_get_contents('php://input');
$ct  = $_SERVER['CONTENT_TYPE'] ?? '';
$in  = [];
if ($ct && stripos($ct,'application/json') !== false && $raw !== '') {
    $tmp = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE && $tmp !== null) $in = $tmp;
}
if ($in === []) $in = $_POST + $_GET; // POST 우선, GET 보조

$oid     = trim($in['oid'] ?? '');
$partial = !empty($in['partial']);
$recamt  = (int)($in['recamt'] ?? 0);   // 취소(환불) 금액
$reccoin = (int)($in['reccoin'] ?? 0);  // 회수 포인트(미지정시 자동계산)
$reason  = trim($in['reason'] ?? '');

if ($oid === '') { http_response_code(400); echo json_encode(['ok'=>false,'err'=>'OID_REQUIRED']); exit; }
if ($partial && $recamt <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'err'=>'PARTIAL_NEEDS_AMOUNT']); exit; }

sql_query("START TRANSACTION");

// 결제건 잠금
$oid_esc = sql_real_escape_string($oid);
$row = sql_fetch("SELECT * FROM saju_payment WHERE Oid='{$oid_esc}' FOR UPDATE");
if (!$row) { sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'PAYMENT_NOT_FOUND']); exit; }
if ($row['ReqResult'] !== '0000') { sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'NOT_SUCCESSFUL']); exit; }

$amount      = (int)$row['Amount'];
$coin_amount = (int)$row['Coin_Amount'];
$can_amt     = max(0, $amount - (int)$row['CancelAmount']);

if ($can_amt <= 0) { sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'ALREADY_FULLY_CANCELLED']); exit; }

if ($partial) {
    if ($recamt > $can_amt) { sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'OVER_REMAIN','remain'=>$can_amt]); exit; }
} else {
    $recamt = $can_amt; // 전액취소
}

// 포인트 회수 자동계산(미지정 시 비례, 내림)
if ($reccoin <= 0) {
    $reccoin = (int)floor($coin_amount * ($recamt / max(1,$amount)));
}

// VBANK 미입금이면 포인트 회수 없음
$deposited = !empty($row['DepositTm']) && $row['DepositTm'] !== '0000-00-00 00:00:00';
if (strtoupper($row['PayMethod']) === 'VBANK' && !$deposited) {
    $reccoin = 0;
}

// 회원 포인트 확인
$mb = sql_fetch("SELECT mb_id, mb_point FROM {$g5['member_table']} WHERE mb_id='".sql_real_escape_string($row['mb_id'])."' FOR UPDATE");
if (!$mb) { sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'MEMBER_NOT_FOUND']); exit; }
if ($reccoin > 0 && (int)$mb['mb_point'] < $reccoin) {
    sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>'INSUFFICIENT_COIN','has'=>$mb['mb_point'],'need'=>$reccoin]); exit;
}

// PG 취소
$res = pay_cancel($oid, $partial, $recamt, $reccoin, $reason);
if (empty($res['ok'])) {
    sql_query("ROLLBACK"); echo json_encode(['ok'=>false,'err'=>$res['err'] ?? 'CANCEL_FAILED','res'=>$res]); exit;
}

// saju_payment 누적 취소 반영
sql_query("
  UPDATE saju_payment
     SET CancelAmount = CancelAmount + {$recamt},
         CancelCoin   = CancelCoin   + {$reccoin},
         CancelAt     = NOW()
   WHERE Oid='{$oid_esc}'
");

// 포인트 회수
if ($reccoin > 0) {
    if (function_exists('insert_point')) {
        insert_point($mb['mb_id'], -$reccoin, "결제 취소({$oid})", '@coin_cancel', $oid, uniqid('coin_cancel_'), 0);
    } else {
        sql_query("UPDATE {$g5['member_table']} SET mb_point = mb_point - {$reccoin} WHERE mb_id='".sql_real_escape_string($mb['mb_id'])."'");
    }
}

sql_query("COMMIT");
echo json_encode(['ok'=>true,'recamt'=>$recamt,'reccoin'=>$reccoin]);
