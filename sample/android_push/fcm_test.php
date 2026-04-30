<?php
$sub_menu = "900050";
include_once('./_common.php');
include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');

$token = $_REQUEST["token"];

$link = "https://sajumoon.co.kr/bbs/board.php?bo_table=counselor&wr_id=330";
$title = "타이틀 테스트";
$message = "메시지 테스트";

sendPushNotification($token, $link, $title, $message);
?>