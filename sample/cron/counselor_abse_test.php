<?php
//20250729 eun 상담사 자동 부재중 전환 작업 시작
// 사용자의 전화를 두 번이상 받지 않은 상담사의 state를 ABSE로 바꾸고, 해당 상담사에게 알림톡을 발송한다.
//$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr"; //운영서버 안의 경로로 맞추기
$DOCUMENT_ROOT = "/data/wwwroot/thesaju.dmonster.kr";


include_once($DOCUMENT_ROOT . "/common.php"); // 메뉴별 공통파일
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');

// 1. 'NO_ANSWER_CSR' 사유가 2회 이상 발생한 상담사 ID 목록 조회
/*$sql = "
    SELECT 
        c.mb_id, m.mb_hp, m.mb_nick
    FROM platform_consulting c
    JOIN g5_member m ON c.mb_id = m.mb_id
    WHERE c.reason = 'NO_ANSWER_CSR' AND state != 'ABSE'
    GROUP BY c.mb_id
    HAVING COUNT(*) >= 2
";*/

$sql = " select * from g5_member where mb_id in ('test_c')";
//echo $sql;

$result = sql_query($sql);

/*
$sql = " select mb_id from g5_member where mb_id in ('test_c','browny57','dmonster')";
$result = sql_query($sql);
if ($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
    echo $sql;
}*/
// 2. 해당 상담사의 state를 'ABSE'로 업데이트
while ($row = sql_fetch_array($result)) {
    $mb_id = $row['mb_id'];
    // 이미 ABSE로 되어있지 않은 경우만 업데이트
    $sql2 = "UPDATE g5_member SET state = 'ABSE' WHERE mb_id = '{$mb_id}'";
    $updated = sql_query($sql2);



    // 20250730 wb 상담사 카톡 발송
    $bizmsg = new bizmsg();
    $bizmsg->phn                = $row['mb_hp'];
    $bizmsg->at_type            = '상담사 자동 부재중 전환';
    $bizmsg->csr_name           = $row['mb_nick'];
   // $rr = $bizmsg->send();


  //  $row['updated'] = (bool)$updated;
    $row['sms_result'] = $rr;
    $list[] = $row;

}
header('Content-Type: application/json');
echo json_encode(['result' => true, 'msg' => '정상 처리',  'count' => count($list),
    'list'  => $list]);
//20250729 eun 상담사 자동 부재중 전환 작업 마감
?>
