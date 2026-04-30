<?php
$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";
include_once($DOCUMENT_ROOT."/common.php");
include_once("./_common.php");
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');

if (!isset($_SERVER['HTTP_USER_AGENT'])) {
    $_SERVER['HTTP_USER_AGENT'] = 'CRON';
}
// 2분에 한번씩 돌리면될듯함.

// set_type=1, send_status=N 인 행 1개씩 처리
$result = sql_query("SELECT idx, aligo_subject, aligo_data FROM aligo_send_all_t WHERE set_type='1' AND send_status='N' ORDER BY idx ASC LIMIT 1");

while ($row = sql_fetch_array($result)) {

    $recv_list = json_decode($row['aligo_data'], true);

    if(!$recv_list){
        $recv_list = json_decode(stripslashes($row['aligo_data']), true);
    }

    if (empty($recv_list) || !is_array($recv_list)) {
        sql_query("UPDATE aligo_send_all_t SET send_status='Y', send_wdate=NOW() WHERE idx='".addslashes($row['idx'])."'");
        continue;
    }

    // 100건씩 나눠서 발송 (bizmsg API 제한)
    $chunks = array_chunk($recv_list, 100);
    foreach ($chunks as $chunk) {
        $bizmsg = new bizmsg();
        $bizmsg->at_type = $row['aligo_subject'];
        $res = $bizmsg->send_muti($chunk);
    }

    sql_query("UPDATE aligo_send_all_t SET send_status='Y', send_wdate=NOW() WHERE idx='".addslashes($row['idx'])."'");
}
?>
