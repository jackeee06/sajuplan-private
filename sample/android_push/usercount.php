<?
################ 공통 파일 #########################
include_once("./_common.php");



if($_REQUEST["mb_id"]){
	$mb_id = $_REQUEST["mb_id"];
}

if($mb_id){
	$board = "BBS_1";
	$agree_count = get_board_count($board, $mb_id);
	$after_count = get_about_count("tbl_afterschool", $mb_id);
}


$total = 0;
$total = (int)$agree_count+(int)$after_count;

echo $total;
?>