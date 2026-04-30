<?php
include_once('./_common.php');

if (!$is_member)
    //alert_close('회원만 조회하실 수 있습니다.');
    alert('로그인이 필요한 서비스입니다', G5_BBS_URL.'/login.php?'.$qstr.'&url='.urlencode(G5_BBS_URL.'/scrap.php'));

//$g5['title'] = get_text($member['mb_nick']).'님의 스크랩';
$g5['title'] = '단골상담사';
//include_once(G5_PATH.'/head.sub.php');
include_once(G5_PATH.'/head.php');
//20250726 eun 단골 정렬 수정 시작
//echo $member_skin_path;
///home/hosting_users/dfsoft_thesaju/www/theme/basic/mobile/skin/member/basic




include_once($member_skin_path.'/scrap.skin.php');

include_once(G5_PATH.'/tail.php');