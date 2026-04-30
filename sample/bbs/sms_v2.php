<?php
include_once('../common.php');
$a_auth = time();
?><!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>휴대폰 인증</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style type="text/css">
    body { background:#fff; margin:0; padding:10px; overflow:hidden; }
    div, label { font-size:12px }
    .frm_input {font-size:12px;padding:3px;border:1px solid #e4eaec;background:#f7f7f7;color:#000;vertical-align:middle;line-height:2em}
    .frm_white {padding:3px 10px 3px 10px;border:1px solid #bdbdbd;background:#ffffff; cursor:pointer;}
    .frm_white2 {font-size:11px;padding:3px 5px 3px 5px;border:1px solid #bdbdbd;background:#ffffff; cursor:pointer;}
    .frm_btn2   {font-size:11px;padding:3px 5px 3px 5px;border:1px solid #242d3d;background:#4b5568;color:#ffffff; cursor:pointer;}
</style>
<script type="text/javascript" src="/js/jquery-1.8.3.min.js"></script>
<script type="text/javascript">

function authSend(){
    var f1 = document.sForm;
    $.post("/bbs/ajax_send.php", $("#sForm").serialize(),function(data){
        if (data=="F"){
            alert("단시간에 너무 많은 요청을 하셨습니다.\n\n잠시후 이용 부탁드립니다.");
        }else{
            f1.sendYN.value = "Y";
            f1.auth_num.focus();
        }
    });
}

function authCheck(){
    var f1 = document.sForm;
    if (f1.sendYN.value=="Y"){
        if (f1.auth_num.value==""){
            alert("'인증번호'를 입력해주세요.");
            f1.auth_num.focus();
        }else{
            $.post("/bbs/ajax_check.php", $("#sForm").serialize(),function(data){
                if (data=="Y"){
                    var authNum = f1.auth_num.value;
                    // 1. iframe 모달 방식 (platform.js - phone_auth_close_modal)
                    if (window.parent && typeof window.parent.phone_auth_close_modal === "function") {
                        window.parent.jQuery("input[name='hp_auth']").val("Y");
                        window.parent.jQuery("input[name='a_num']").val(authNum);
                        window.parent.phone_auth_close_modal();
                    }
                    // 2. 일반 팝업 방식
                    else if (window.opener) {
                        window.opener.jQuery("input[name='hp_auth']").val("Y");
                        window.opener.jQuery("input[name='a_num']").val(authNum);
                        window.close();
                    }
                }else{
                    alert("입력하신 '인증번호'가 일치하지 않습니다.");
                }
            });
        }
    }else{
        alert("'인증번호 발송' 버튼을 클릭해주세요.");
    }
}

function closeWindow() {
    // 1. iframe 모달 방식 (platform.js)
    if (window.parent && typeof window.parent.phone_auth_close_modal === "function") {
        window.parent.phone_auth_close_modal();
    }
    // 2. 레이어 ID 직접 삭제
    else if (window.parent && window.parent.jQuery("#phone_auth_layer").length) {
        window.parent.jQuery("#phone_auth_layer").remove();
    }
    // 3. 팝업 방식
    else {
        window.close();
    }
}

$(document).ready(function() {
    authSend();
});
</script>
</head>
<body>

<div style="width:345px; height:265px; margin:0 auto; padding:10px; border:1px solid #d3d3d3">
    <div align=left style="width:100%;padding:0px 0px 5px 0px;border-bottom:2px solid #737573"><b>휴대폰인증</b></div>

    <form name="sForm" id="sForm" method="post" autocomplete="off">
    <input type="hidden" name="a_auth" value="<?=$a_auth?>">
    <input type="hidden" name="sendYN" value="">
    <input type="hidden" name="mb_hp" value="<?=$mb_hp?>">

    <div style="height:20px;"></div>
    <div style="padding:10px;width:325px;border:1px solid #dddddd">
    1) 인증번호를 못 받으셨을 경우는 아래에 <font color="red">재전송</font> 눌러주세요.
    </div>
    <div style="padding:5px;text-align:center;width:335px;border-bottom:1px solid #dddddd;border-left:1px solid #dddddd;border-right:1px solid #dddddd">
        <?=$mb_hp?> &nbsp;
        <input type="button" class="frm_white2" value="재전송" onclick="authSend();">
    </div>

    <div style="height:15px;"></div>
    <div style="padding:10px;width:325px;border:1px solid #dddddd">
    2) 카톡으로 전송된 <font color="red">5자리 인증번호</font>를 입력하세요.
    </div>
    <div style="padding:5px;text-align:center;width:335px;border-bottom:1px solid #dddddd;border-left:1px solid #dddddd;border-right:1px solid #dddddd">
        인증번호 : <input type="text" name="auth_num" id="auth_num" class="frm_input" style="width:100px;">
        <input type="button" class="frm_btn2" value="입력" onclick="authCheck();">
    </div>

    <div align=center style="padding:15px 0px 0px 0px;">
        <input type="button" class="frm_white" value="닫기" onclick="closeWindow();">
    </div>

    </form>
</div>

</body>
</html>
