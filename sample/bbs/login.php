<?php
include_once('./_common.php');

if( function_exists('social_check_login_before') ){
    $social_login_html = social_check_login_before();
}

$g5['title'] = '로그인';
//if (G5_IS_MOBILE) {
    //include_once(G5_THEME_MOBILE_PATH.'/head_w.php');
    //return;
//}
include_once('./_head.sub.php');

$url = isset($_GET['url']) ? strip_tags($_GET['url']) : '';
$od_id = isset($_POST['od_id']) ? safe_replace_regex($_POST['od_id'], 'od_id') : '';

// url 체크
check_url_host($url);

// 이미 로그인 중이라면
if ($is_member) {
    if ($url)
        goto_url($url);
    else
        goto_url(G5_URL);
}

$login_url        = login_url($url);

$login_action_url = G5_HTTPS_BBS_URL."/login_check.php";




// 로그인 스킨이 없는 경우 관리자 페이지 접속이 안되는 것을 막기 위하여 기본 스킨으로 대체
$login_file = $member_skin_path.'/login.skin.php';
if (!file_exists($login_file))
    $member_skin_path   = G5_SKIN_PATH.'/member/basic';


if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
    //   echo "===>".$member_skin_path.'/login.skin.php';
    //   exit;
}


// if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
//         // var_dump($mb);
//         // var_dump($_POST);
//         // var_dump($_GET);
//         // var_dump($url);
//         var_dump($member_skin_path);
//         exit;
// }

//echo $member_skin_path;
///data/wwwroot/sajumoon.co.kr/theme/basic/mobile/skin/member/basic
// echo $member_skin_path.'/login.skin.php';

include_once($member_skin_path.'/login.skin.php');

run_event('member_login_tail', $login_url, $login_action_url, $member_skin_path, $url);

include_once('./_tail.sub.php');