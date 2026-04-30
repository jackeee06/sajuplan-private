<?php
include_once('./_common.php');
//include_once(G5_CAPTCHA_PATH.'/captcha.lib.php');

if ($is_member) {
    alert("이미 로그인중입니다.");
}

$g5['title'] = '인증번호 확인';
include_once(G5_PATH.'/_head.php');

$mb_no = trim($_GET['mb_no']);
$mb_datetime = trim($_GET['mb_datetime']);
$mb_lost_certify = trim($_GET['mb_lost_certify']);
$mb_hp = trim($_GET['mb_hp']);

$action_url = G5_HTTPS_BBS_URL."/password_lost2_sms.php";
include_once($member_skin_path.'/password_lost_sms.skin.php');

include_once(G5_PATH.'/_tail.php');