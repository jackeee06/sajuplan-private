<?php
include_once('../common.php');
$a_auth = time();
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>휴대폰 인증</title>
<meta name="description" content="">
<meta name="author" content="">
<meta name="keywords" content="">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">

<style type="text/css">
	body {overflow-x:hidden; overflow-y:hidden;}
	div, label { font-size:12px }
	.frm_input {font-size:12px;padding:3px;border:1px solid #e4eaec;background:#f7f7f7;color:#000;vertical-align:middle;line-height:2em}
	.frm_white {padding:3px 10px 3px 10px;border:1px solid #bdbdbd;background:#ffffff}
	.frm_white2 {font-size:11px;padding:3px 5px 3px 5px;border:1px solid #bdbdbd;background:#ffffff}
	.frm_btn    {padding:3px 10px 3px 10px;border:1px solid #242d3d;background:#4b5568;color:#ffffff}
	.frm_btn2   {font-size:11px;padding:3px 5px 3px 5px;border:1px solid #242d3d;background:#4b5568;color:#ffffff}
</style>
<script type="text/javascript" src="/js/jquery-1.8.3.min.js"></script>
<script type="text/javascript">

function authSend(){
	var f1 = document.sForm;
	$.post("/bbs/ajax_send.php", $("#sForm").serialize(),function(data){
		
		if (data=="F"){
			alert("단시간에 너무 많은 요청을 하셨습니다.\n\n잠시후 이용 부탁드립니다.");
		}else{
			//alert("요청하신 휴대폰으로 '인증번호'가 발송되었습니다.");
			f1.sendYN.value = "Y";
			f1.auth_num.focus();
		}
	});	
}

function authCheck(){
    alert("CEHCK...!!!");
	var f1 = document.sForm;
	if (f1.sendYN.value=="Y"){
		if (f1.auth_num.value==""){
			alert("'인증번호'를 입력해주세요.");
			f1.auth_num.focus();
		}else{
			$.post("/bbs/ajax_check.php", $("#sForm").serialize(),function(data){

				if (data=="Y"){
					opener.document.fregisterform.hp_auth.value = "Y";
					self.close();
				}else{
					alert("입력하신 '인증번호'가 일치하지 않습니다.");
				}
			});	
		}
	}else{
		alert("'인증번호 발송' 버튼을 클릭해주세요.");
	}
}

$().ready(function() {
	authSend();
});
</script>
</head>
<body>

<div style="width:345px;height:265px;padding:20px;border:1px solid #d3d3d3">
	<div align=left style="width:100%;padding:0px 0px 5px 0px;border-bottom:2px solid #737573"><b>휴대폰인증</b></div>

	<form name="sForm" id="sForm" action="" method="post" autocomplete="off"> 
	<input type="hidden" name="a_auth" value="<?=$a_auth?>">
	<input type="hidden" name="sendYN" value="">
	<input type="hidden" name="mb_hp" value="<?=$mb_hp?>">

	<div style="height:30px;"></div>
	<div style="padding:10px;width:325px;border:1px solid #dddddd">
	1) 인증번호를 못 받으셨을 경우는 아래에 <font color="red">재전송</font> 눌러주세요.
	</div>
	<div style="padding:5px;text-align:center;width:335px;border-bottom:1px solid #dddddd;border-left:1px solid #dddddd;border-right:1px solid #dddddd">
		<?=$mb_hp?> &nbsp;

        <input type="button" name="btnPhone" class="frm_white2" value="재전송" onclick="authSend();"> 
	</div>


	<div style="height:20px;"></div>
	<div style="padding:10px;width:325px;border:1px solid #dddddd">
	2) 카카오 플친으로 전송된 <font color="red">5자리 인증번호</font>를 입력하세요.
	</div>
	<div style="padding:5px;text-align:center;width:335px;border-bottom:1px solid #dddddd;border-left:1px solid #dddddd;border-right:1px solid #dddddd">
		인증번호 : <input type="text" name="auth_num" id="auth_num"  class="frm_input"  style="width:100px;"> 
        <input type="button" name="btnPhone" class="frm_btn2" value="입력" onclick="authCheck();"> 
	</div>


	<div align=center style="padding:20px 0px 0px 0px;">
		<input type="button" id="btnClose" class="frm_white" value="닫기">
	</div>

	</form> 
</div>

</body>
<script>
$(function () {
    $('#btnClose').on('click', function () {
        window.close();
    });
});
</script>