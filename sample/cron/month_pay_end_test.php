
<?php


/* ===============================
   🔐 크론 전체 실행 락
=============================== */
$cronLock = fopen(__DIR__."/month_pay_end.lock","c");
if(!$cronLock){
    die("LOCK FILE OPEN FAIL");
}
if(!flock($cronLock, LOCK_EX | LOCK_NB)){
    die("LOCK FAIL");
}

$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";

include_once($DOCUMENT_ROOT."/common.php"); // 메뉴별 공통파일
###############################################
include_once("./_common.php");

$tmpdate = date("Y-m",time())."-01";
//$lastday = date('t', strtotime($tmpdate));
$nowday = (int)date("d");

// 2월 정산 데이터 일괄 업데이트 (포인트 차감 없음)
$sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
$result = sql_query($sql);
if($result){
    while($row = sql_fetch_array($result)){
        set_con_account_v3($row["mb_id"], '2026-02');
    }
}
echo "2026-02 정산 업데이트 완료";
?>