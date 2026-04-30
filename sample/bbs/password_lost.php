<?php
include_once('./_common.php');
include_once(G5_CAPTCHA_PATH.'/captcha.lib.php');

if ($is_member) {
    alert("이미 로그인중입니다.");
}

$g5['title'] = '회원정보 찾기';
include_once(G5_PATH.'/head.php');

$action_url = G5_HTTPS_BBS_URL."/password_lost2.php";

//echo $member_skin_path;
///dfsoft_thesaju/www/theme/basic/mobile/skin/member/basic

include_once($member_skin_path.'/password_lost.skin.php');

include_once(G5_PATH.'/tail.sub.php');
?>