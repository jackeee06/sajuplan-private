<?php
include_once('./_common.php');

if (!$_POST["mb_id"]){
		echo "아이디가 없습니다. 로그인해주세요!";
		exit;
}


if (!$_POST["smb_id"]){
		echo "상담사가 선택되지 않았습니다. 다시 확인해주세요.";
		exit;
}




$sinfo = get_member($_POST["smb_id"]);
$minfo = get_member($_POST["mb_id"]);

if($sinfo["mb_id"]==$minfo["mb_id"]){
	echo "본인에게 접속알림을 보낼수 없습니다!".$sinfo["mb_id"]."|".$minfo["mb_id"];
	exit;
}



if($sinfo["mb_id"] && $minfo["mb_id"]){
	$sql = "insert into saju_resv(`mb_id`,`cs_id`,`mb_hp`,`state`,`regday`)values('".$minfo["mb_id"]."','".$sinfo["mb_id"]."','".$minfo["mb_hp"]."','N',now())";
	$rtn = sql_query($sql);
	if($rtn){
		echo "접속알림예약 완료. 감사합니다!";
	}else{
		echo "접속알림 실패. 다시 시도해주세요!";
	}
}	