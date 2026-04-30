<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

include_once(G5_THEME_MOBILE_PATH.'/head.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);
?>

<!-- 슬라이드 JS -->
<script src="<?php echo G5_JS_URL; ?>/swipe.js"></script>
<script src="<?php echo G5_JS_URL; ?>/shop.mobile.main.js"></script>

<style>

.search,
.haed_menu { display:none;}

.btn_gokakao { display:none;}

/* 상단 띠배너 */
.topBanner_login #topBanner_login {position:relative; width:100%; background-color:#88c9e2; color:#fff; overflow:hidden; }
.topBanner_login #topBanner_login .bn_con {width:100%; height:100%; margin:0; padding:0; text-align:left;}
.topBanner_login #topBanner_login .bn_con span {font-size:14px; line-height:34px; color:#fff; }
.topBanner_login #topBanner_login .bn_close { position:absolute; top:50%; transform:translateY(-50%); right:0;}
.topBanner_login #topBanner_login .bn_close #chkday {position:absolute; top:1px; left:0; width:17px; height:17px; color:#fff; }
.topBanner_login #topBanner_login .bn_close label [for=chkday] {cursor:pointer; padding-right:10px; }
.topBanner_login #topBanner_login .bn_close label span {padding-left:10px; color:rgba(255,255,255,0.3); }
.topBanner_login #topBanner_login .bn_close .btnClose {display:inline-block; width:40px; height:34px; line-height:34px; text-align:right; border-radius:2px; color:rgba(255,255,255,.6); font-size:18px; padding-right:20px;}


</style>


<div class="topBanner_login">

        <script language="JavaScript">
        
            //쿠키저장
            function setCookie( name, value, expiredays ) {
                var todayDate = new Date();
                todayDate.setDate( todayDate.getDate() + expiredays );
                document.cookie = name + "=" + escape( value ) + "; path=/; expires=" + todayDate.toGMTString() + ";"
            }
        
            $(document).ready(function(){
                $("#topBanner_login .btnClose").click(function(){
                    if($("#chkday").is(':checked')){
                        setCookie( "topPop", "done" , 1 );
                        //alert("쿠키를 생성 체크");
                    }
                    $('#topBanner_login').slideUp(500);
                });
            });
        
        </script>
        

    	<div id="topBanner_login" style="display: block;">
        <div class="bn_con">
            <?php echo display_banner('로그인-상단띠배너', 'mainbanner.30.skin.php'); ?>
            <!--<img src="../../../../../../img/sample/login_top.png" style=" width:100%;" />-->
        </div>
        <div class="bn_close">
                <!--<input type="checkbox" value="checkbox" name="chkbox" id="chkday"><label for="chkday">오늘 하루 그만보기 </label>-->
                <a href="#none" class="btnClose">
                    <span><i class="xi-close"></i></span>
                </a>
        </div>
    </div>
    
    <script language="Javascript">
        //쿠키가 있으면 창을 안 띄우고 없으면 뛰웁니다.
        cookiedata = document.cookie;
        if ( cookiedata.indexOf("topPop=done") < 0 ){
            document.all['topBanner_login'].style.display = "block";
            }
        else {
            document.all['topBanner_login'].style.display = "none";
        }
    </script>
    </div>
    
    
<div id="mb_login" class="mbskin">
    <h1 style="text-align:center;">
		<?php //echo $g5['title'] ?>
    	<img src="../../../../../../img/common/logo2.png" style=" height:80px; margin-bottom:20px;" />
    </h1>

    <form name="flogin" action="<?php echo $login_action_url ?>" onsubmit="return flogin_submit(this);" method="post" id="flogin">
    <input type="hidden" name="url" value="<?php echo $login_url ?>">

    <div id="login_frm">
    	<ul class="">
	        <label for="login_id" class="sound_only">아이디<strong class="sound_only"> 필수</strong></label>
    	    <input type="text" name="mb_id" id="login_id" placeholder="아이디" required class="frm_input" maxLength="200">
        </ul>
        
        <ul class="pw_wrap input password">
        <label for="login_pw" class="sound_only">비밀번호<strong class="sound_only"> 필수</strong></label>
        <input type="password" name="mb_password" id="login_pw" placeholder="비밀번호" required class="frm_input mb_password" maxLength="200">
    	            <span class="eyes">
					  	<i class="xi-eye-o"></i>
					</span>
        </ul>
        
        
    <style>
    .login_menu { display:flex; justify-content: space-between;}
    </style>

        
        <div class="login_menu">
	        <ul id="login_info" class="chk_box">
    	        <input type="checkbox" name="auto_login" id="login_auto_login" class="selec_chk" checked="checked">
        	    <label for="login_auto_login"><span></span> 로그인 상태 유지</label>
	        </ul>
            
            
        </div>
		<button type="submit" class="btn_submit">로그인</button>
    </div>
    
    <section class="mb_login_join">

        <a href="./register.php">회원가입</a>
            
        <a href="<?php echo G5_BBS_URL ?>/password_lost.php">아이디/비밀번호 찾기</a>

    </section>

    
    
    <?php
    // echo get_social_skin_path().'/social_login.skin.php';
    @include_once(get_social_skin_path().'/social_login.skin.php');
    
    ?>


    </form>

    <?php // 쇼핑몰 사용시 여기부터 ?>
    <?php if ($default['de_level_sell'] == 1) { // 상품구입 권한 ?>

	<!-- 주문하기, 신청하기 -->
	<?php if (preg_match("/orderform.php/", $url)) { ?>
	<section id="mb_login_notmb">
	    <h2>비회원 구매</h2>
	    <p>비회원으로 주문하시는 경우 포인트는 지급하지 않습니다.</p>
	    
	    <div id="guest_privacy">
	        <?php echo $default['de_guest_privacy']; ?>
	    </div>
		
		<div class="chk_box">
			<input type="checkbox" id="agree" value="1" class="selec_chk">
		    <label for="agree"><span></span> 개인정보수집에 대한 내용을 읽었으며 이에 동의합니다.</label>
		</div>
		
	    <div class="btn_confirm">
	        <a href="javascript:guest_submit(document.flogin);" class="btn_submit">비회원으로 구매하기</a>
	    </div>
	
	    <script>
	    function guest_submit(f)
	    {
	        if (document.getElementById('agree')) {
	            if (!document.getElementById('agree').checked) {
	                alert("개인정보수집에 대한 내용을 읽고 이에 동의하셔야 합니다.");
	                return;
	            }
	        }
	
	        f.url.value = "<?php echo $url; ?>";
	        f.action = "<?php echo $url; ?>";
	        f.submit();
	    }
	    </script>
	</section>

	<?php } else if (preg_match("/orderinquiry.php$/", $url)) { ?>
	<div id="mb_login_od_wr">
		<h2>비회원 주문조회 </h2>
		
	    <fieldset id="mb_login_od">
	        <legend>비회원 주문조회</legend>
	
	        <form name="forderinquiry" method="post" action="<?php echo urldecode($url); ?>" autocomplete="off">
	
	        <label for="od_id" class="od_id sound_only">주문번호<strong class="sound_only"> 필수</strong></label>
	        <input type="text" name="od_id" value="<?php echo $od_id ?>" id="od_id" placeholder="주문번호" required class="frm_input required" size="20">
	        <label for="id_pwd" class="od_pwd sound_only">비밀번호<strong class="sound_only"> 필수</strong></label>
	        <input type="password" name="od_pwd" size="20" id="od_pwd" placeholder="비밀번호" required class="frm_input required">
	        <button type="submit" class="btn_submit">확인</button>
	
	        </form>
	    </fieldset>
	
	    <section id="mb_login_odinfo">
	        <p>메일로 발송해드린 주문서의 <strong>주문번호</strong> 및 주문 시 입력하신 <strong>비밀번호</strong>를 정확히 입력해주십시오.</p>
	    </section>
	</div>
	<?php } ?>

	<?php } ?>
	<?php // 쇼핑몰 사용시 여기까지 반드시 복사해 넣으세요 ?>
</div>

<script>
jQuery(function($){
    $("#login_auto_login").click(function(){
        if (this.checked) {
            this.checked = confirm("자동로그인을 사용하시면 다음부터 회원아이디와 비밀번호를 입력하실 필요가 없습니다.\n\n공공장소에서는 개인정보가 유출될 수 있으니 사용을 자제하여 주십시오.\n\n자동로그인을 사용하시겠습니까?");
        }
    });
});

function flogin_submit(f)
{
    if( $( document.body ).triggerHandler( 'login_sumit', [f, 'flogin'] ) !== false ){
        return true;
    }
    return false;
}
</script>
