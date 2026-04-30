<?php
include_once('../common.php');


// 2025-12-15 가입 + mb_1 비어있는 회원만
$sql = "
  SELECT mb_id, mb_name, mb_hp, mb_point
  FROM g5_member
  WHERE mb_datetime >= '2025-12-15 00:00:00'
    AND mb_datetime <  '2025-12-17 00:00:00'
    AND (mb_1 IS NULL OR mb_1 = '') and mb_id != 'dhdmsgh5425'
";
$rs = sql_query($sql);

while ($m = sql_fetch_array($rs)) {

    $mb_id   = $m['mb_id'];
    $mb_name = $m['mb_name'];
    $mb_hp   = preg_replace('/[^0-9]/', '', $m['mb_hp']); // 하이픈 제거
    $amt     = (int)$m['mb_point'];

    // memb-mgr 등록 payload (기존 회원가입 코드와 동일)
    $data = json_encode([
        "membnm" => $mb_name,
        "telno"  => $mb_hp,
        "amt"    => $amt
    ], JSON_UNESCAPED_UNICODE);

    $j = send_mjson("memb-mgr", $data, "POST");

    // 성공 케이스
    if (isset($j["req_result"]) && $j["req_result"] === "00" && !empty($j["membid"])) {
        $membid = addslashes($j["membid"]);
        sql_query("UPDATE g5_member SET mb_1='{$membid}' WHERE mb_id='".addslashes($mb_id)."'");
        echo "OK  mb_id={$mb_id} membid={$membid}\n";
        continue;
    }

    // 실패 케이스: 원인 로그 남기기(필요시 테이블 만들어도 됨)
    $msg = isset($j["resultmessage"]) ? $j["resultmessage"] : 'unknown';
    echo "FAIL mb_id={$mb_id} msg={$msg}\n";

    // (옵션) 이미 등록되어 있다고 응답이 오면, 그때 membid가 같이 오는 형태면 mb_1 업데이트 가능:
    if (!empty($j["membid"])) {
        $membid = addslashes($j["membid"]);
        sql_query("UPDATE g5_member SET mb_1='{$membid}' WHERE mb_id='".addslashes($mb_id)."'");
        echo "FIX mb_id={$mb_id} membid={$membid}\n";
    }
}
