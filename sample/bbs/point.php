<?php
include_once('./_common.php');

if ($is_guest)
    //alert_close('회원만 조회하실 수 있습니다.');
	alert('로그인이 필요한 서비스입니다', G5_BBS_URL.'/login.php?'.$qstr.'&url='.urlencode(G5_BBS_URL.'/point.php'));
	
//$g5['title'] = get_text($member['mb_nick']).' 님의 포인트 내역';
$g5['title'] = '포인트내역';

//include_once(G5_PATH.'/head.sub.php');
include_once('./_head.php');

$list = array();

$sql_common = " from {$g5['point_table']} where mb_id = '".escape_trim($member['mb_id'])."' ";
$sql_order = " order by po_id desc ";

$sql = " select count(*) as cnt {$sql_common} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) { $page = 1; } // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select *
            {$sql_common}
            {$sql_order}
            limit {$from_record}, {$rows} ";

$result = sql_query($sql);

for ($i=0; $row=sql_fetch_array($result); $i++) {
    $list[] = $row;
}


//echo $member_skin_path;
///home/hosting_users/dfsoft_thesaju/www/theme/basic/mobile/skin/member/basic

include_once($member_skin_path.'/point.skin.php');

//include_once(G5_PATH.'/tail.sub.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.php');