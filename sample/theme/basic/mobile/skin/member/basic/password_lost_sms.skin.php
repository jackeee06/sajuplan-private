<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);
?>

<div id="find_info" class="new_win mbskin">
    <h1 id="win_title">아이디/비밀번호 찾기</h1>

    <form name="fpasswordlost2" action="<?php echo $action_url ?>" onsubmit="return fpasswordlost_submit2(this);" method="post" autocomplete="off">
    <fieldset id="info_fs">
            <h2 style="font-size:16px; margin-bottom:6px;">SMS로 전송된 인증번호를 입력해 주세요.</h2>
            인증번호를 입력시 해당 핸드폰으로 아이디와 변경된 비밀번호 정보를 보내드립니다.
        <!--label for="hp_confirm">인증번호</label-->
        <input type="text" name="hp_confirm" id="hp_confirm" class="frm_input nospace" placeholder="인증번호를 입력">
		<input type="hidden" name="mb_no" value="<?php echo $mb_no; ?>">
		<input type="hidden" name="mb_datetime" value="<?php echo $mb_datetime; ?>">
		<input type="hidden" name="mb_lost_certify" value="<?php echo $mb_lost_certify; ?>">
		<input type="hidden" name="mb_hp" value="<?php echo $mb_hp; ?>">
    </fieldset>

    <?//php echo captcha_html(); ?>

    <div class="win_btn">
        <input type="submit" value="확인" class="btn_submit w100">
        <!--<button type="button" onclick="javascript:window.close();" class="win_btn_uto">창닫기</button>-->
    </div>
    </form>
</div>

<style>

.tail_wrap { display:none;}

#find_info .win_btn #btn_submit_uto_pw {float: inherit;height: 50px;margin-top: 10px;}
#find_info .win_btn .win_btn_uto {background: #aaa;color: #fff;padding: 0 20px;width: 25%;height: 50px;margin-top: 10px;border: 0;}
#find_info .win_btn #btn_submit_uto_pw {background: #465bf0;}
.mbskin p {border-bottom: 0px solid #c8c8c8;}
.mbskin {}
.mbskin .frm_input {width: 100%; margin: 20px 0;}
.new_win { padding:20px;}
</style>

<script>
function fpasswordlost_submit2(f)
{
    <?//php echo chk_captcha_js(); ?>

    return true;
}

$(function() {
    var sw = screen.width;
    var sh = screen.height;
    var cw = document.body.clientWidth;
    var ch = document.body.clientHeight;
    var top  = sh / 2 - ch / 2 - 100;
    var left = sw / 2 - cw / 2;
    moveTo(left, top);
});
</script>
