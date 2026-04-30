<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);

if($config['cf_cert_use'] && ($config['cf_cert_simple'] || $config['cf_cert_ipin'] || $config['cf_cert_hp'])) { ?>
    <script src="<?php echo G5_JS_URL ?>/certify.js?v=<?php echo G5_JS_VER; ?>"></script>    
<?php } ?>


<style>

.new_win { padding:0;}
.new_win .new_win_con { padding:0px 0;}

/* 비밀번호 탭메뉴 */
#uto_tab_pw {height: auto;}
#uto_tab_pw ul.tab_btn_pw {list-style: none;  font-size:16px; text-align: center; position:relative;}
#uto_tab_pw ul.tab_btn_pw::after { content:''; position:absolute; top:50px; left:0px; width:calc(100% - 0px); height:1px; background-color:rgba(0,0,0,.2);}

#uto_tab_pw .tab_btn_pw li {float: left; width: 50%; border-bottom:2px solid rgba(255,255,255,0); height:50px; line-height:48px;opacity:.5; }
#uto_tab_pw .tab_btn_pw li:hover {cursor: pointer;}
#uto_tab_pw .tab_btn_pw li .uto_tab_su {border-left: 1px solid #e0e2e5;border-right: 1px solid #e0e2e5;}

#uto_tab_pw div.tab_con_pw {clear: both; float:none; width: 99.9999%; min-height: 100%; position: relative; overflow-y: hidden;}
#uto_tab_pw .tab_con_pw div {display: none; margin-top:30px;}
#uto_tab_pw .tab_btn_pw li.selected { border-color:#000; opacity:1; background-color:transparent; color:#000; opacity:1 !
;}
#find_info .btn_submit {background: #465bf0;}
#find_info #mb_hp {margin: 10px 0;}
#find_info .mb_hp_no {color: #465bf0;font-weight: 600;}

#uto_tab_pw div.tab_con_pw,
#find_info #captcha,
.new_win .win_btn { padding:0 20px;}

#find_info #info_fs #mb_email { margin:10px 0;}

#find_info #captcha { margin-top:10px;}

.timeline_tap_02 { width:100%; height:50px; float:left; position:relative; padding:0; border-bottom:1px solid #ddd;}
.timeline_tap_02::after { content:''; position:absolute; top:50px; left:0px; width:calc(100% - 0px); height:1px; background-color:rgba(255,255,255,.2);}

.timeline_tap_02_item { width:33.3333333%; float:left; position:relative; z-index:2; height:50px; border-radius:0; line-height:50px; text-align:center;  display:inline-block; color:#999; font-size:16px; opacity:.5; border-bottom:2px solid rgba(255,255,255,0); padding:0;}
.timeline_tap_02_item:hover,
.timeline_tap_02_item.on { border-color:#000; opacity:1; background-color:transparent; color:#000;}



</style>


<!-- 회원정보 찾기 시작 { -->
<div id="find_info" class="new_win<?php if($config['cf_cert_use'] != 0 && $config['cf_cert_find'] != 0) { ?> cert<?php } ?>">
    <div class="new_win_con">
        <form name="fpasswordlost" action="<?php echo $action_url ?>" onsubmit="return fpasswordlost_submit(this);" method="post" autocomplete="off">
        <input type="hidden" name="cert_no" value="">
        <h3>이메일로 찾기</h3>
        <fieldset id="info_fs">
            <!--
			<label for="mb_email" class="sound_only">E-mail 주소<strong class="sound_only">필수</strong></label>
            <input type="text" name="mb_email" id="mb_email" required class="required frm_input full_input email" size="30" placeholder="E-mail 주소">
			-->
			<!-- 비밀번호 탭메뉴 { -->
			<div id="uto_tab_pw">
 			<ul class="tab_btn_pw">
  			<?php if($config['cf_sms_use'] =='icode') { ?>
  			 <li>핸드폰으로 찾기</li>
  			 <li>이메일로 찾기</li>
 			 <?php } else { ?>
 			 <?php } ?>
 			</ul>
 			<div class="tab_con_pw">
   				
                <?php if($config['cf_sms_use'] =='icode') { ?>
				<div id="c_pw1">
					<h2 style="font-size:16px; margin-bottom:6px;">회원가입 시 등록하신 핸드폰번호를 입력해 주세요.</h2>
   			  		핸드폰 입력시 인증번호를 보내드립니다.<br>
				 	인증번호 입력시 해당 핸드폰으로 아이디와 변경된 비밀번호 정보를 다시 보내드립니다.<br><br>
				 <p class="mb_hp_no" style="margin-bottom:0px;">※ 번호입력시 '-'는 제외해 주십시오.</p>
				 <label for="mb_hp" class="sound_only">핸드폰 번호</label>
    			 <input type="text" name="mb_hp" id="mb_hp" class="frm_input full_input nospace" size="30" placeholder="핸드폰번호(숫자만 입력하세요)" onkeyup="onlynumberic(event)" minlength="10" maxlength="11">
				</div>
				<?php } ?>
                
                <div id="c_pw2">
	 			<h2 style="font-size:16px; margin-bottom:6px;">회원가입 시 등록하신 이메일 주소를 입력해 주세요.</h2>
    			 해당 이메일로 아이디와 비밀번호 정보를 보내드립니다.<br><br>
	 			<label for="mb_email" class="sound_only">E-mail 주소</label>
     			<input type="text" name="mb_email" id="mb_email" class="frm_input full_input email" size="30" placeholder="E-mail 주소">
    			</div>
                
				
                
 			</div>
			</div>

			<script>
			var count = $('.tab_btn_pw li').length;
			idx = Math.floor(Math.random() * 1);
			changeTab(idx);

			$('.tab_btn_pw li').click(function(){
    			idx = $(this).index();
    			changeTab(idx);
			});

			function changeTab(idx) {
   			 $('.tab_btn_pw li[class=selected]').removeClass('selected');
   			 $('.tab_btn_pw li').eq(idx).addClass('selected');
				$('.tab_con_pw div').hide();
   			 $('#c_pw'+(idx+1)).fadeIn();

			}

			function onlynumberic(event) {
             event.target.value = event.target.value.replace(/[^0-9]/g, "");
            }
			</script>
			<!-- } 비밀번호 탭메뉴 -->
        </fieldset>
        <?php echo captcha_html();  ?>

        <div class="win_btn">
            <!--<button type="submit" class="btn_submit">인증메일 보내기</button>-->
			<button type="submit" class="btn_submit bg_point w100">요청하기</button>
        </div>
        </form>
    </div>
    <?php if($config['cf_cert_use'] != 0 && $config['cf_cert_find'] != 0) { ?> 
    <div class="new_win_con find_btn">
        <h3>본인인증으로 찾기</h3>
        <div class="cert_btn">
        <?php if(!empty($config['cf_cert_simple'])) { ?>
            <button type="button" id="win_sa_kakao_cert" class="btn_submit win_sa_cert" data-type="">간편인증</button>
        <?php } if(!empty($config['cf_cert_hp']) || !empty($config['cf_cert_ipin'])) { ?>
            <?php if(!empty($config['cf_cert_hp'])) { ?>
            <button type="button" id="win_hp_cert" class="btn_submit">휴대폰 본인확인</button>
            <?php } if(!empty($config['cf_cert_ipin'])) { ?>
            <button type="button" id="win_ipin_cert" class="btn_submit">아이핀 본인확인</button>
            <?php } ?>
        <?php } ?>
        </div>
    </div>
    <?php } ?>
</div>
<script>    
$(function() {
    $("#reg_zip_find").css("display", "inline-block");
    var pageTypeParam = "pageType=find";

	<?php if($config['cf_cert_use'] && $config['cf_cert_simple']) { ?>
	// TOSS 간편인증
	var url = "<?php echo G5_INICERT_URL; ?>/ini_request.php";
	var type = "";    
    var params = "";
    var request_url = "";
    
	
	$(".win_sa_cert").click(function() {
		type = $(this).data("type");
		params = "?directAgency=" + type + "&" + pageTypeParam;
        request_url = url + params;
        call_sa(request_url);
	});
    <?php } ?>
    <?php if($config['cf_cert_use'] && $config['cf_cert_ipin']) { ?>
    // 아이핀인증
    var params = "";
    $("#win_ipin_cert").click(function() {
        params = "?" + pageTypeParam;
        var url = "<?php echo G5_OKNAME_URL; ?>/ipin1.php"+params;
        certify_win_open('kcb-ipin', url);
        return;
    });

    <?php } ?>
    <?php if($config['cf_cert_use'] && $config['cf_cert_hp']) { ?>
    // 휴대폰인증
    var params = "";
    $("#win_hp_cert").click(function() {
        params = "?" + pageTypeParam;
        <?php     
        switch($config['cf_cert_hp']) {
            case 'kcb':                
                $cert_url = G5_OKNAME_URL.'/hpcert1.php';
                $cert_type = 'kcb-hp';
                break;
            case 'kcp':
                $cert_url = G5_KCPCERT_URL.'/kcpcert_form.php';
                $cert_type = 'kcp-hp';
                break;
            case 'lg':
                $cert_url = G5_LGXPAY_URL.'/AuthOnlyReq.php';
                $cert_type = 'lg-hp';
                break;
            default:
                echo 'alert("기본환경설정에서 휴대폰 본인확인 설정을 해주십시오");';
                echo 'return false;';
                break;
        }
        ?>
        
        certify_win_open("<?php echo $cert_type; ?>", "<?php echo $cert_url; ?>"+params);
        return;
    });
    <?php } ?>
});
function fpasswordlost_submit(f)
{
    <?php echo chk_captcha_js();  ?>

    return true;
}
</script>
<!-- } 회원정보 찾기 끝 -->