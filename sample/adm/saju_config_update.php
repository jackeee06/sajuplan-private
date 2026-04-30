<?php
$sub_menu = "350800";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'w');

$html_title = '사주 메인설정';
check_demo();
check_admin_token();
include_once('./admin.head.php');
#####################################################################

$cf_now_add = $_REQUEST["cf_now_add"];
$cf_con_num = $_REQUEST["cf_con_num"];
$cf_1 = $_REQUEST["cf_1"];

if($cf_now_add || $cf_con_num){

	$sql = "update saju_config set cf_now_add='".$cf_now_add."' , cf_con_num='".$cf_con_num."', cf_1='".$cf_1."'";
	sql_query($sql);
}

  goto_url('./saju_config.php');
?>