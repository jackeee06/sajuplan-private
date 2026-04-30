<?php
include_once('../common.php');

// 쿼리: 최근 3일간 상담사 목록 가져오는 로직 (latest.lib.php 쿼리 복사해서 mb_id, state만 가져오게 수정)
$treeday = date("Y-m-d H:i:s",strtotime("-3 days"));
$ssq = "SELECT csrid, SUM( usetm ) AS utm FROM `platform_consulting` where wr_datetime >='".$treeday."' GROUP BY csrid ORDER BY utm DESC LIMIT 0 , 15";
$mbids = array();
$rrs = sql_query($ssq);
if($rrs){
    while($trow=sql_fetch_array($rrs)){
        if($trow["csrid"]){
            $mm = get_csrid($trow["csrid"]);
            $mbids[] = $mm["mb_id"];
        }
    }
    sql_free_result($rrs);
}
$states = [];
if ($mbids) {
    $in = "'".implode("','", array_map('sql_escape_string', $mbids))."'";
    $sql = "SELECT mb_id, state FROM g5_member WHERE mb_id IN ($in)";
    $res = sql_query($sql);
    while ($row = sql_fetch_array($res)) {
        $states[] = ['mb_id'=>$row['mb_id'], 'state'=>$row['state']];
    }
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($states);
?>
