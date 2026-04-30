<?php
include_once("./_common.php"); // 메뉴별 공통파일
###############################################

if(!$member["mb_id"]){
	alert('로그인하셔야합니다','/bbs/login.php?url=/shop/my.php');
	exit;
}

$mb_id = $_REQUEST["mb_id"];

if($member["mb_id"]!=$mb_id){
	alert('본인만 정산처리할수 있습니다.');
	exit;
}
set_con_account($mb_id);
?>
<script>
alert('처리완료');
location.href='/shop/mypage.php';
</script>
