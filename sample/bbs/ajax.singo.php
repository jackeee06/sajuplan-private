<?php
include_once('./_common.php');

if (!$member["mb_id"]){
		echo "로그인 하셔야합니다";
		exit;
}

$emsg = "";
if (!$bo_table && !$wr_id && !$mode) {
	echo $emsg = '값이 제대로 넘어오지 않았습니다.';
	exit;
}

$write = sql_fetch(" select * from g5_write_".$bo_table." where wr_id = '{$wr_id}'");
if (!$write["wr_id"]) {
	echo $msg = '존재하는 글이 아닙니다.';
	exit;
}

if($write['mb_id'] == $member['mb_id']) {
	echo $msg = '자신의 글은 신고할 수 없습니다.';
	exit;
}

//관리자만 가능한 기능
if(!$is_admin) {
	if(is_admin($write['mb_id'])) {
		$msg = '관리자 글은 신고할 수 없습니다.';
		echo $msg;
		exit;
	}
}

//신고여부
$sql = " select count(*) as cnt from g5_board_singo where bo_table = '$bo_table' and wr_id = '$wr_id' and mb_id = '{$member['mb_id']}' and mode = '{$mode}' ";
$row = sql_fetch($sql);
if($row['cnt'] > 0) {
	echo $msg = '이미 신고하신 글입니다.';
	exit;
} else {
	//신고 입력
	sql_query(" insert g5_board_singo set bo_table = '$bo_table', wr_id = '$wr_id', tmb_id = '{$tmb_id}', mb_id = '{$member['mb_id']}', mode='{$mode}', reg_date = '".G5_TIME_YMDHIS."'");
	echo "신고 완료";
}




