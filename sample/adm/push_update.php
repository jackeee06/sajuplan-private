<?php
$sub_menu = "900050";
include_once('./_common.php');
//error_reporting(E_ALL);
//ini_set('display_errors', '1');


include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');



// auth_check($auth[$sub_menu], 'w');

if ($is_admin != 'super')
    alert('최고관리자만 접근 가능합니다.');

// check_admin_token();



$title = $_REQUEST["title"];
$url   = $_REQUEST["url"];
$gubun = $_REQUEST["gubun"] ? $_REQUEST["gubun"] : '10';

$message = $title;
$link    = $url ? $url : 'none';
$id      = 'all';
$code    = 'alim_notice';
$reg_ip  = $_SERVER['REMOTE_ADDR'];

// gubun에 따른 토픽 매핑 (10:전체공지, 5:상담사, 2:일반회원)
$topic_map = array(
    '10' => 'chl_all',
    '5'  => 'chl_5',
    '2'  => 'chl_2'
);
$topic = isset($topic_map[$gubun]) ? $topic_map[$gubun] : 'chl_all';

// V2 토픽 방식 푸시 전송
send_noti_topic($topic, $title, $message, 'alim_notice', '', '', $link);

$query = "insert into member_push set "
        . "title = '{$message}', "
        . "id = '{$id}', "
        . "url = '{$link}', "
        . "content = '{$message}', "
        . "code = '{$code}', "
        . "reg_ip = '{$reg_ip}', "
        . "gubun = '{$gubun}', "
        . "regdate = now()";
sql_query($query);

goto_url('./push_list.php', false);
?>