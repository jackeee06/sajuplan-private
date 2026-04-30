<?php
include_once('./_common.php');
include_once('./android_push/send_fcm.php');

$mb_id = 'chl_all';
// $row = sql_fetch("SELECT t_android_id FROM tbl_android_phone WHERE t_mb_id = '{$mb_id}' ORDER BY idx DESC LIMIT 1");
send_noti_topic($mb_id, '테스트 푸시', '푸시 테스트 메시지입니다.', '', '', '', '');


// if ($row['t_android_id']) {
    
//     echo "푸시 전송 완료: {$mb_id}";
// } else {
//     echo "토큰 없음: {$mb_id}";
// }
?>