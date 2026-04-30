
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

if ($nowday === 1) {
    $sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
    $result = sql_query($sql);
    if($result){
        while($row = sql_fetch_array($result)){
            set_con_account_v2($row["mb_id"]);
        }
    }
}
?>