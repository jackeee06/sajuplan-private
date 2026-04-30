<?php
$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr"; // 운영서버
//$DOCUMENT_ROOT = "/data/wwwroot/thesaju.dmonster.kr";

include_once($DOCUMENT_ROOT . "/common.php");
include_once("./_common.php");

// 실서버에서 주석 해제
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');

header('Content-Type: application/json; charset=utf-8');

// 결과 리스트 초기화
$list_no_answer = [];
$list_skip      = [];

/* ===========================================================
 * 1) NO_ANSWER_CSR 2회 이상 → ABSE 전환 + 알림
 *    (최근 30분, 미마킹만 집계/마킹)
 * =========================================================== */
$sql = "
SELECT
    c.mb_id, m.mb_hp, m.mb_nick, m.state,
    COUNT(*) AS no_answer_count
FROM platform_consulting c
JOIN g5_member m ON c.mb_id = m.mb_id
WHERE c.reason = 'NO_ANSWER_CSR'
  AND c.abse_check = 'N'
  AND m.state <> 'ABSE'
  AND c.wr_datetime >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
GROUP BY c.mb_id, m.mb_hp, m.mb_nick, m.state
HAVING COUNT(*) >= 2
ORDER BY no_answer_count DESC
";
$result = sql_query($sql);

while ($row = sql_fetch_array($result)) {
    $mb_id   = $row['mb_id'];
    $mb_hp   = $row['mb_hp'];
    $mb_nick = $row['mb_nick'];

    // 상태 변경 (단순화: 감지 없이 바로 업데이트)
    sql_query("UPDATE g5_member SET state='ABSE' WHERE mb_id='{$mb_id}'");

    // 알림톡 발송
    $send_ok = false;
    try {
        $bizmsg = new bizmsg();
        $bizmsg->phn      = $mb_hp;
        $bizmsg->at_type  = '상담사 자동 부재중 전환';
        $bizmsg->csr_name = $mb_nick;
        $send_ok = $bizmsg->send();
    } catch (Exception $e) {
        $send_ok = false;
    }

    // 집계한 창(30분) 내 미마킹 건만 마킹
    sql_query("
        UPDATE platform_consulting
           SET abse_check='Y'
         WHERE mb_id      = '{$mb_id}'
           AND reason     = 'NO_ANSWER_CSR'
           AND abse_check = 'N'
           AND wr_datetime >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    ");

    $list_no_answer[] = [
        'mb_id' => $mb_id,
        'hp'    => $mb_hp,
        'nick'  => $mb_nick,
        'cnt'   => (int)$row['no_answer_count'],
        'sent'  => $send_ok
    ];
}

/* ===========================================================
 * 2) skip_charge='Y' 2회 이상  → ABSE 전환 + 알림
 *    (최근 30분, 미마킹만 집계/마킹)
 * =========================================================== */
$sql3 = "
SELECT
    c.mb_id, m.mb_hp, m.mb_nick, m.state,
    COUNT(*) AS skip_count
FROM platform_consulting c
JOIN g5_member m ON c.mb_id = m.mb_id
WHERE c.abse_check = 'N'
  AND c.skip_charge = 'Y'
  AND m.state <> 'ABSE'
  AND c.wr_datetime >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
GROUP BY c.mb_id, m.mb_hp, m.mb_nick, m.state
HAVING COUNT(*) >= 2
ORDER BY skip_count DESC
";
$res = sql_query($sql3);

while ($row = sql_fetch_array($res)) {
    $mb_id   = $row['mb_id'];
    $mb_hp   = $row['mb_hp'];
    $mb_nick = $row['mb_nick'];

    // 상태 변경 (단순화)
    sql_query("UPDATE g5_member SET state='ABSE' WHERE mb_id='{$mb_id}'");

    // 알림톡 발송
    $send_ok = false;
    try {
        $bizmsg = new bizmsg();
        $bizmsg->phn      = $mb_hp;
        $bizmsg->at_type  = '상담사 자동 부재중 전환';
        $bizmsg->csr_name = $mb_nick;
        $send_ok = $bizmsg->send();
    } catch (Exception $e) {
        $send_ok = false;
    }

    // 집계한 창(30분) 내 미마킹 건만 마킹
    sql_query("
        UPDATE platform_consulting
           SET abse_check='Y'
         WHERE mb_id       = '{$mb_id}'
           AND skip_charge = 'Y'
           AND abse_check  = 'N'
           AND wr_datetime >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    ");

    $list_skip[] = [
        'mb_id' => $mb_id,
        'cnt'   => (int)$row['skip_count'],
        'sent'  => $send_ok
    ];
}

// 최종 반환
echo json_encode([
    'result'            => true,
    'msg'               => '정상 처리',
    'count_no_answer'   => count($list_no_answer),
    'count_skip_charge' => count($list_skip),
    'list_no_answer'    => $list_no_answer,
    'list_skip_charge'  => $list_skip
], JSON_UNESCAPED_UNICODE);
