<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

include_once(G5_PATH.'/head.sub.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);
?>

<!-- 회원정보 입력/수정 시작 { -->

<style>

.search,
.haed_menu,
.btn_gokakao { display:none;}



</style>

<script src="<?php echo G5_JS_URL ?>/jquery.register_form.js"></script>
<?php if($config['cf_cert_use'] && ($config['cf_cert_ipin'] || $config['cf_cert_hp'])) { ?>
<script src="<?php echo G5_JS_URL ?>/certify.js?v=<?php echo G5_JS_VER; ?>"></script>
<?php } ?>

<form id="fregisterform" name="fregisterform" action="<?php echo $register_action_url ?>" onsubmit="return fregisterform_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off">
<input type="hidden" name="w" value="<?php echo $w ?>">
<input type="hidden" name="url" value="<?php echo $urlencode ?>">
<!--
<input type="hidden" name="agree" value="<?php echo $agree ?>">
<input type="hidden" name="agree2" value="<?php echo $agree2 ?>">
-->
<input type="hidden" name="cert_type" value="<?php echo $member['mb_certify']; ?>">
<input type="hidden" name="cert_no" value="">
<input type="hidden" name="hp_auth" value="">
<?php if (isset($member['mb_sex'])) {  ?><input type="hidden" name="mb_sex" value="<?php echo $member['mb_sex'] ?>"><?php }  ?>
<?php if (isset($member['mb_nick_date']) && $member['mb_nick_date'] > date("Y-m-d", G5_SERVER_TIME - ($config['cf_nick_modify'] * 86400))) { // 닉네임수정일이 지나지 않았다면  ?>
<input type="hidden" name="mb_nick_default" value="<?php echo get_text($member['mb_nick']) ?>">
<input type="hidden" name="mb_nick" value="<?php echo get_text($member['mb_nick']) ?>">
<?php }  ?>

<?php if($member['mb_level']>4){ //권한2보다 높은 권한일 경우 ?>
<div class="top_nav" style="">
	<a href="#" class="btn_gotop_02" style="display:block !important;"><ul class="on">회원정보</ul></a>

		<?

	if($member["mb_level"]=="5"){
		/// 해당 프로필이있는지 확인
		$sql1 = "select * from g5_write_counselor where mb_id='".$member["mb_id"]."'";
		$mrow=sql_fetch($sql1);
		$purl = "";
		if($mrow["wr_id"]){
			$purl = "&wr_id=".$mrow["wr_id"]."&tmb_id=".$member["mb_id"];
		}else{
			$purl = "";
		}
		?>
			
			<a href="/bbs/write.php?w=u&bo_table=counselor<?=$purl?>"><ul>상담사프로필 <i class="xi-external-link"></i></ul></a>
		<?
		}
		?>

	

	<a href="#info_02"><ul>계좌정보</ul></a>
</div>
<?php }  ?>

<div id="register_form"  class="form_01 first">   
    <div id="info_01">
        <h2>사이트 이용정보 입력</h2>
        <h3>회원정보</h3>
        <ul>
            <label for="reg_mb_id" >아이디</label>
            <li class="flex">
                <input type="text" name="mb_id" value="<?php echo $member['mb_id'] ?>" id="reg_mb_id" <?php echo $required ?> <?php echo $readonly ?> class="frm_input full_input <?php echo $required ?> <?php echo $readonly ?>" minlength="3" maxlength="20" placeholder="영문,숫자,_만 입력가능. 최소 3자이상">
                <span id="msg_mb_id"></span>
                <a href="#" class="overlap idcheck btn_frmline" style="width:80px;">중복체크</a>
            </li>
           <span class="frm_info">영문자, 숫자, _ 만 입력 가능. 최소 3자이상 입력하세요.</span>
        </ul>
        
        <ul>
        	<label for="reg_mb_password">비밀번호</label>
            <li class="flex">
                <!--<label for="reg_mb_password">비밀번호</label>-->
                <p class="pw_wrap input password">
	                <input type="password" name="mb_password" id="reg_mb_password" <?php echo $required ?> class="frm_input mb_password <?php echo $required ?>" minlength="3" maxlength="20" placeholder="비밀번호 입력">
    	            <span class="eyes">
					  	<i class="xi-eye-o"></i>
					</span>
                </p>

                <!--<label for="reg_mb_password_re">비밀번호 확인</label>-->
                <p class="pw_wrap input password">
	                <input type="password" name="mb_password_re" id="reg_mb_password_re" <?php echo $required ?> class="frm_input mb_password right_input <?php echo $required ?>" minlength="3" maxlength="20" placeholder="비밀번호 확인">
    	            <span class="eyes">
					  	<i class="xi-eye-o"></i>
					</span>
                </p>
            </li>
        </ul>

        <h2>개인정보 입력</h2>

        
        <ul>
			<label for="reg_mb_name">이름</label>
            <li>
                
                <input type="text" id="reg_mb_name" name="mb_name" value="<?php echo get_text($member['mb_name']) ?>" <?php echo $required ?> <?php echo $readonly; ?> class="frm_input full_input <?php echo $required ?> <?php echo $readonly ?>" size="10" placeholder="이름을 입력해주세요">
                <?php
                if($config['cf_cert_use']) {
                    if($config['cf_cert_ipin'])
                        echo '<button type="button" id="win_ipin_cert" class="btn_frmline">아이핀 본인확인</button>'.PHP_EOL;
                    if($config['cf_cert_hp'])
                        echo '<button type="button" id="win_hp_cert" class="btn_frmline">휴대폰 본인확인</button>'.PHP_EOL;

                    echo '<noscript>본인확인을 위해서는 자바스크립트 사용이 가능해야합니다.</noscript>'.PHP_EOL;
                }
                ?>
                <?php
                if ($config['cf_cert_use'] && $member['mb_certify']) {
                    if($member['mb_certify'] == 'ipin')
                        $mb_cert = '아이핀';
                    else
                        $mb_cert = '휴대폰';
                ?>
  
                <div id="msg_certify">
                    <strong><?php echo $mb_cert; ?> 본인확인</strong><?php if ($member['mb_adult']) { ?> 및 <strong>성인인증</strong><?php } ?> 완료
                </div>
                <?php } ?>
                <?php if ($config['cf_cert_use']) { ?>
                <span class="frm_info">아이핀 본인확인 후에는 이름이 자동 입력되고 휴대폰 본인확인 후에는 이름과 휴대폰번호가 자동 입력되어 수동으로 입력할수 없게 됩니다.</span>
                <?php } ?>

                
            </li>
        </ul>
        
        <?php //if ($req_nick) {  ?>
        <ul>
            <label for="reg_mb_nick">닉네임</label>
            <li>
                
                
                    <input type="hidden" name="mb_nick_default" value="<?php echo isset($member['mb_nick'])?get_text($member['mb_nick']):''; ?>">
                    <input type="text" name="mb_nick" value="<?php echo isset($member['mb_nick'])?get_text($member['mb_nick']):''; ?>" id="reg_mb_nick" required class="frm_input required nospace  full_input" size="10" maxlength="20" placeholder="닉네임을 입력해주세요">
                    <span id="msg_mb_nick"></span>
                    <span class="frm_info">
                        공백없이 한글,영문,숫자만 입력 가능 (한글2자, 영문4자 이상)<br>
                        닉네임을 바꾸시면 앞으로 <?php echo (int)$config['cf_nick_modify'] ?>일 이내에는 변경 할 수 없습니다.
                    </span>
                
            </li>
           
		</ul>
        <?php //}  ?>


        <ul>
        	<label for="reg_mb_email">E-mail</label>
            <li>
                
                
                <?php if ($config['cf_use_email_certify']) {  ?>
                <span class="frm_info">
                    <?php if ($w=='') { echo "E-mail 로 발송된 내용을 확인한 후 인증하셔야 회원가입이 완료됩니다."; }  ?>
                    <?php if ($w=='u') { echo "E-mail 주소를 변경하시면 다시 인증하셔야 합니다."; }  ?>
                </span>
                <?php }  ?>
                <input type="hidden" name="old_email" value="<?php echo $member['mb_email'] ?>">
                <input type="text" name="mb_email" value="<?php echo isset($member['mb_email'])?$member['mb_email']:''; ?>" id="reg_mb_email" required class="frm_input email full_input required" size="70" maxlength="100" placeholder="이메일 주소를 입력해주세요">
            
            </li>
        </ul>


        <ul>
        	<?php if ($config['cf_use_hp'] || $config['cf_cert_hp']) {  ?> 
        	<label for="reg_mb_hp">휴대폰번호<?php if ($config['cf_req_hp']) { ?><?php } ?></label>
            <?php } ?>
            
        	<li class="flex">
            
			
            <?php if ($config['cf_use_hp'] || $config['cf_cert_hp']) {  ?>                
                
                <input type="text" name="mb_hp" value="<?php echo get_text($member['mb_hp']) ?>" id="reg_mb_hp" <?php echo ($config['cf_req_hp'])?"required":""; ?> class="frm_input  full_input <?php echo ($config['cf_req_hp'])?"required":""; ?>" maxlength="20" placeholder="휴대폰번호">

                <?php
                if($config['cf_auth_hp']) {
                    
                    echo '<button type="button" id="win_hp_auth" class="btn_frmline" style="min-width:90px; ">인증번호 전송</button>'.PHP_EOL;

                    echo '<noscript>본인확인을 위해서는 자바스크립트 사용이 가능해야합니다.</noscript>'.PHP_EOL;
                }
                ?>
				
				<?php if ($config['cf_cert_use'] && $config['cf_cert_hp']) { ?>
                <input type="hidden" name="old_mb_hp" value="<?php echo get_text($member['mb_hp']) ?>">
                <?php } ?>
            <?php }  ?>
            </li>
        </ul>

        
        <ul>
        	<?php if ($config['cf_use_hp'] || $config['cf_cert_hp']) {  ?> 
        	<label for="reg_mb_hp"></label>
            <?php } ?>
            
        	<li class="flex">
            
			
            <?php if ($config['cf_use_hp'] || $config['cf_cert_hp']) {  ?>                
                
                <input type="text" name="mb_hp_cert" value="" id="reg_mb_hp_cert" <?php //echo ($config['cf_req_hp'])?"required":""; ?> class="frm_input  full_input" maxlength="20" placeholder="인증번호 입력">

				
				<button type="button" id="win_hp_auth" class="btn_frmline" style="min-width:90px; ">확인</button>
                
            <?php }  ?>
            </li>
        </ul>
        
        <?php if($member['mb_level']>4){ //권한2보다 높은 권한일 경우 ?>        
		<?php if ($member['mb_level'] >= $config['cf_icon_level'] && $config['cf_member_img_size'] && $config['cf_member_img_width'] && $config['cf_member_img_height']) {  ?>
        <ul>
        	<label for="reg_mb_img" class="frm_label">회원이미지</label>
	        
	            <li>
               
    	            <input class="frm_input  full_input" type="file" name="mb_img" id="reg_mb_img" >
                                
        	        <span class="frm_info">
            	        이미지 크기는 가로 <?php echo $config['cf_member_img_width'] ?>픽셀, 세로 <?php echo $config['cf_member_img_height'] ?>픽셀 이하로 해주세요.<br>
                	    gif, jpg, png파일만 가능하며 용량 <?php echo number_format($config['cf_member_img_size']) ?>바이트 이하만 등록됩니다.
	                </span>

    	            <?php if ($w == 'u' && file_exists($mb_img_path)) {  ?>
        	        <img src="<?php echo $mb_img_url ?>" alt="회원아이콘" class="mem_img mtop10">
            	    <input type="checkbox" name="del_mb_img" value="1" id="del_mb_img">
                	<label for="del_mb_img">삭제</label>
                <?php }  ?>
            
            </li>
            </ul>
         <?php } ?>
         <?php }  ?>
    </div>
</div>

<!--
<div id="register_form"  class="form_01">   
            
    <div style="margin-bottom:24px;">      
        <?php if($member['mb_level']>4){ //권한2보다 높은 권한일 경우 ?>
        <h3>상담사 정보</h3>
        
        <a href="../bbs/write.php?w=u&bo_table=counselor&wr_id=21">
        <span style=" display:block; font-size:14px; font-weight:400; padding:0px 10px; line-height:40px; border-radius:4px; background-color:#000; color:#fff; font-weight:600; width:calc(100% - 0%); text-align:center;">상담사정보 수정 <i class="xi-angle-right" style="display:inline-block; margin-left:10px;"></i></span>
        </a>
        
    </div>
</div>
-->
<div id="register_form"  class="form_01">     
    <div>
        
        
        <h3 id="info_02">계좌정보</h3>
		<ul>
            <label for="reg_mb_bank">은행명</label>
            <li>
                <input type="text" name="mb_1" value="" id="reg_mb_1" class="frm_input full_input" maxlength="20" placeholder=" OO은행">
            
			</li>
        </ul>
		<ul>
        	 <label for="reg_mb_account">예금주</label>
            <li>
                <input type="text" name="mb_2" value="" id="reg_mb_2" class="frm_input full_input" maxlength="20" placeholder="김OO">
            
			</li>
        </ul>
		<ul>
        	 <label for="reg_mb_account">계좌번호</label>
            <li>
                <input type="text" name="mb_3" value="" id="reg_mb_3" class="frm_input full_input" maxlength="20" placeholder="00000000000">
            
			</li>
        </ul>
		<? } else { ?>

		<?php } ?>
        
        <?php if ($config['cf_use_homepage']) {  ?>
        <ul>
            <li>
                <label for="reg_mb_homepage">홈페이지<?php if ($config['cf_req_homepage']){ ?><strong>필수</strong><?php } ?></label>
                <input type="text" name="mb_homepage" value="<?php echo get_text($member['mb_homepage']) ?>" id="reg_mb_homepage" <?php echo $config['cf_req_homepage']?"required":""; ?> class="frm_input full_input <?php echo $config['cf_req_homepage']?"required":""; ?>" size="70" maxlength="255" placeholder="홈페이지">
            </li> 
		</ul>
        <?php }  ?>
        
        <?php if ($config['cf_use_tel']) {  ?>
        <ul>
            <li>
            
            
                <label for="reg_mb_tel">전화번호<?php if ($config['cf_req_tel']) { ?><strong>필수</strong><?php } ?></label>
                <input type="text" name="mb_tel" value="<?php echo get_text($member['mb_tel']) ?>" id="reg_mb_tel" <?php echo $config['cf_req_tel']?"required":""; ?> class="frm_input full_input <?php echo $config['cf_req_tel']?"required":""; ?>" maxlength="20" placeholder="전화번호">
            
			</li>
        </ul>
        <?php }  ?>
        
        <?php if ($config['cf_use_addr']) { ?>
        <ul>
            <li>
                <?php if ($config['cf_req_addr']) { ?><?php }  ?>
                <label for="reg_mb_zip">주소</label>
                <input type="text" name="mb_zip" value="<?php echo $member['mb_zip1'].$member['mb_zip2']; ?>" id="reg_mb_zip" <?php echo $config['cf_req_addr']?"required":""; ?> class="frm_input frm_address <?php echo $config['cf_req_addr']?"required":""; ?>" size="10" maxlength="6"  placeholder="우편번호">
                <button type="button" class="btn_frmline" onclick="win_zip('fregisterform', 'mb_zip', 'mb_addr1', 'mb_addr2', 'mb_addr3', 'mb_addr_jibeon');" style="width:70px;">주소 검색</button><br>
                <input type="text" name="mb_addr1" value="<?php echo get_text($member['mb_addr1']) ?>" id="reg_mb_addr1" <?php echo $config['cf_req_addr']?"required":""; ?>ㄴ class="frm_input frm_address full_input <?php echo $config['cf_req_addr']?"required":""; ?>" size="50"  placeholder="기본주소">
                <label for="reg_mb_addr1" class="sound_only">기본주소<?php echo $config['cf_req_addr']?'<strong> 필수</strong>':''; ?></label><br>
                <input type="text" name="mb_addr2" value="<?php echo get_text($member['mb_addr2']) ?>" id="reg_mb_addr2" class="frm_input full_input" size="50"  placeholder="상세주소">
                <label for="reg_mb_addr2" class="sound_only">상세주소</label>
                <!--<br>
                <input type="text" name="mb_addr3" value="<?php echo get_text($member['mb_addr3']) ?>" id="reg_mb_addr3" class="frm_input frm_address full_input" size="50" readonly="readonly"  placeholder="참고항목">
                <label for="reg_mb_addr3" class="sound_only">참고항목</label>
                <input type="hidden" name="mb_addr_jibeon" value="<?php echo get_text($member['mb_addr_jibeon']); ?>">
                -->
            </li>
        </ul>
        <?php }  ?>

        <h2>기타 개인설정</h2>
        <ul>
            <?php if ($config['cf_use_signature']) {  ?>
            <li>
                <label for="reg_mb_signature" class="sound_only">서명<?php if ($config['cf_req_signature']){ ?><strong>필수</strong><?php } ?></label>
                <textarea name="mb_signature" id="reg_mb_signature" <?php echo $config['cf_req_signature']?"required":""; ?> class="<?php echo $config['cf_req_signature']?"required":""; ?>"   placeholder="서명"><?php echo $member['mb_signature'] ?></textarea>
            </li>
            <?php }  ?>

            <?php if ($config['cf_use_profile']) {  ?>
            <li>
                <label for="reg_mb_profile" class="sound_only">자기소개</label>
                <textarea name="mb_profile" id="reg_mb_profile" <?php echo $config['cf_req_profile']?"required":""; ?> class="<?php echo $config['cf_req_profile']?"required":""; ?>" placeholder="자기소개"><?php echo $member['mb_profile'] ?></textarea>
            </li>
            <?php }  ?>

            <?php if ($config['cf_use_member_icon'] && $member['mb_level'] >= $config['cf_icon_level']) {  ?>
            <li>
                <label for="reg_mb_icon" class="frm_label">회원아이콘</label>
                <input type="file" name="mb_icon" id="reg_mb_icon" >
                                
                <span class="frm_info">
                    이미지 크기는 가로 <?php echo $config['cf_member_icon_width'] ?>픽셀, 세로 <?php echo $config['cf_member_icon_height'] ?>픽셀 이하로 해주세요.<br>
                    gif, jpg, png파일만 가능하며 용량 <?php echo number_format($config['cf_member_icon_size']) ?>바이트 이하만 등록됩니다.
                </span>

                <?php if ($w == 'u' && file_exists($mb_icon_path)) {  ?>
                <img src="<?php echo $mb_icon_url ?>" alt="회원아이콘">
                <input type="checkbox" name="del_mb_icon" value="1" id="del_mb_icon">
                <label for="del_mb_icon">삭제</label>
                <?php }  ?>
            
            </li>
            <?php }  ?>


		</ul>
    </div>
</div>

<div id="register_form"  class="form_01 last">   
            
    <div>
        <ul>
            <?php
            //회원정보 수정인 경우 소셜 계정 출력
            if( $w == 'u' && function_exists('social_member_provider_manage') ){
                social_member_provider_manage();
            }
            ?>

            <?php if ($w == "" && $config['cf_use_recommend']) {  ?>
            <li>
                <label for="reg_mb_recommend" class="sound_only">추천인아이디</label>
                <input type="text" name="mb_recommend" id="reg_mb_recommend" class="frm_input" placeholder="추천인아이디">
            </li>
            <?php }  ?>
        </ul>
	</div>
    
    <div>
        <!-- 약관동의, 회원가입폼 추가 : END  20240516-->
		<ul>
        	<label>자동등록방지</label>
            <li class="is_captcha_use">
                
                <?php echo captcha_html(); ?>
            </li>
        </ul>        
        
    </div> 
	
    <div>
    	<ul class="agree_wrap">
	        <?php if ($w == "") { ?>
			<li class="agree">
			    <section id="fregister_term">
        			<h2><i class="fa fa-check-square-o" aria-hidden="true"></i> 회원가입약관</h2>
        			<fieldset class="fregister_agree">
			            <input type="checkbox" name="agree" value="1" id="agree11" checked="checked">
    	                <label for="agree11">회원가입약관 동의(필수)</label>        		    
        	            <i class="modal_pop_btn xi-angle-right"></i>
		    	    </fieldset>
                	<!--<textarea readonly><?php echo get_text($config['cf_stipulation']) ?></textarea>-->
			    </section>
			</li>
			<li class="agree">
		    	<section id="fregister_private">
        			<h2><i class="fa fa-check-square-o" aria-hidden="true"></i> 개인정보처리방침안내</h2>
	        		<fieldset class="fregister_agree">
			            <input type="checkbox" name="agree2" value="1" id="agree21" checked="checked">
        	            <label for="agree21">개인정보처리방침안내 동의(필수)</label>        		    
            	        <i class="modal_pop_btn xi-angle-right"></i>
		        	</fieldset>
			        <!--<textarea readonly><?php echo get_text($config['cf_privacy']) ?></textarea>-->
			    </section>
			</li>
	        <?php } ?>
            <br />
            <li class="chk_box">
	        	<input type="checkbox" name="mb_mailling" value="1" id="reg_mb_mailling" <?php echo ($w=='' || $member['mb_mailling'])?'checked':''; ?> class="selec_chk">
	            <label for="reg_mb_mailling">
	            	<span></span>
	            	<b style="padding-left:30px;">이메일 수신 동의</b>
	            </label>
	            
	        </li>
            
            <?php if ($config['cf_use_hp']) { ?>

            <li class="chk_box">
	            <input type="checkbox" name="mb_sms" value="1" id="reg_mb_sms" <?php echo ($w=='' || $member['mb_sms'])?'checked':''; ?> class="selec_chk">
	        	<label for="reg_mb_sms">
	            	<span></span>
	            	<b style="padding-left:30px;">문자 수신 동의</b>
	            </label>        
	        </li>

		<?php } ?>
        </ul>


<?php if($w != '') { ?>
<div class="btn_leave_wrap">
	<a href="javascript:member_leave();" class="btn_leave">회원탈퇴</a>
</div>
<?php } // tto?>
		

        
    </div>
    
</div>

<div class="modal_pop">
	<!-- 첫 번째 modal_pop의 내용 -->
	<div class="modal_pop-content">
    	<h4>회원가입약관</h4>
		<span class="modal_pop_close">
        <i class="xi-close-thin"></i></span>
        <textarea readonly><?php echo get_text($config['cf_stipulation']) ?></textarea>
	</div>
</div>

<div class="modal_pop">
	<!-- 두 번째 modal_pop의 내용 -->
	<div class="modal_pop-content">
    	<h4>개인정보처리방침안내</h4>
		<span class="modal_pop_close">
        <i class="xi-close-thin"></i></span>
        <textarea readonly><?php echo get_text($config['cf_privacy']) ?></textarea>
	</div>
</div>
         
             
                
<div class="btn_confirm">
    <!--<a href="<?php echo G5_URL ?>" class="btn_cancel">취소</a>-->
    <input type="submit" value="<?php echo $w==''?'동의하고 회원가입':'정보수정'; ?>" id="btn_submit" class="btn_submit" accesskey="s">
</div>


</form>

    <script>
    $(function() {
        $("#reg_zip_find").css("display", "inline-block");

        <?php if($config['cf_cert_use'] && $config['cf_cert_ipin']) { ?>
        // 아이핀인증
        $("#win_ipin_cert").click(function() {
            if(!cert_confirm())
                return false;

            var url = "<?php echo G5_OKNAME_URL; ?>/ipin1.php";
            certify_win_open('kcb-ipin', url);
            return;
        });

        <?php } ?>

        <?php if($config['cf_auth_hp']) { ?>
        $("#win_hp_auth").click(function() {
			opt = 'scrollbars=0,width=400,height=320,top=10,left=20';
			popup_window(g5_bbs_url+"/sms.php?mb_hp="+$("#reg_mb_hp").val(), "sms_auth", opt);
        });
        <?php } ?>
		
		<?php if($config['cf_cert_use'] && $config['cf_cert_hp']) { ?>
        // 휴대폰인증
        $("#win_hp_cert").click(function() {
            if(!cert_confirm())
                return false;

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

            certify_win_open("<?php echo $cert_type; ?>", "<?php echo $cert_url; ?>");
            return;
        });
        <?php } ?>
    });

    // submit 최종 폼체크
    function fregisterform_submit(f)
    {
		
		<?php if ($w == "") { ?>
		if (!f.agree.checked) {
		    alert("회원가입약관의 내용에 동의하셔야 회원가입 하실 수 있습니다.");
		    f.agree.focus();
		    return false;
		}

		if (!f.agree2.checked) {
		    alert("개인정보처리방침안내의 내용에 동의하셔야 회원가입 하실 수 있습니다.");
		    f.agree2.focus();
		    return false;
		}
		<?php } ?>


        // 회원아이디 검사
        if (f.w.value == "") {
            var msg = reg_mb_id_check();
            if (msg) {
                alert(msg);
                f.mb_id.select();
                return false;
            }
        }

        if (f.w.value == "") {
            if (f.mb_password.value.length < 3) {
                alert("비밀번호를 3글자 이상 입력하십시오.");
                f.mb_password.focus();
                return false;
            }
        }

        if (f.mb_password.value != f.mb_password_re.value) {
            alert("비밀번호가 같지 않습니다.");
            f.mb_password_re.focus();
            return false;
        }

        if (f.mb_password.value.length > 0) {
            if (f.mb_password_re.value.length < 3) {
                alert("비밀번호를 3글자 이상 입력하십시오.");
                f.mb_password_re.focus();
                return false;
            }
        }

        // 이름 검사
        if (f.w.value=="") {
            if (f.mb_name.value.length < 1) {
                alert("이름을 입력하십시오.");
                f.mb_name.focus();
                return false;
            }

            /*
            var pattern = /([^가-힣\x20])/i;
            if (pattern.test(f.mb_name.value)) {
                alert("이름은 한글로 입력하십시오.");
                f.mb_name.select();
                return false;
            }
            */
        }

        <?php if($w == '' && $config['cf_cert_use'] && $config['cf_cert_req']) { ?>
        // 본인확인 체크
        if(f.cert_no.value=="") {
            alert("회원가입을 위해서는 본인확인을 해주셔야 합니다.");
            return false;
        }
        <?php } ?>

	    <?php if($w == '' && $config['cf_auth_hp']) { ?>
        // 본인확인 체크
        //if(f.hp_auth.value=="") {
            //alert("회원가입을 위해서는 휴대폰인증을 해주셔야 합니다.");
            //return false;
        //}
        <?php } ?>

        // 닉네임 검사
        if ((f.w.value == "") || (f.w.value == "u" && f.mb_nick.defaultValue != f.mb_nick.value)) {
            var msg = reg_mb_nick_check();
            if (msg) {
                alert(msg);
                f.reg_mb_nick.select();
                return false;
            }
        }

        // E-mail 검사
        if ((f.w.value == "") || (f.w.value == "u" && f.mb_email.defaultValue != f.mb_email.value)) {
            var msg = reg_mb_email_check();
            if (msg) {
                alert(msg);
                f.reg_mb_email.select();
                return false;
            }
        }

        <?php if (($config['cf_use_hp'] || $config['cf_cert_hp']) && $config['cf_req_hp']) {  ?>
        // 휴대폰번호 체크
        var msg = reg_mb_hp_check();
        if (msg) {
            alert(msg);
            f.reg_mb_hp.select();
            return false;
        }
        <?php } ?>

        if (typeof f.mb_icon != "undefined") {
            if (f.mb_icon.value) {
                if (!f.mb_icon.value.toLowerCase().match(/.(gif|jpe?g|png)$/i)) {
                    alert("회원아이콘이 이미지 파일이 아닙니다.");
                    f.mb_icon.focus();
                    return false;
                }
            }
        }

        if (typeof f.mb_img != "undefined") {
            if (f.mb_img.value) {
                if (!f.mb_img.value.toLowerCase().match(/.(gif|jpe?g|png)$/i)) {
                    alert("회원이미지가 이미지 파일이 아닙니다.");
                    f.mb_img.focus();
                    return false;
                }
            }
        }

        if (typeof(f.mb_recommend) != "undefined" && f.mb_recommend.value) {
            if (f.mb_id.value == f.mb_recommend.value) {
                alert("본인을 추천할 수 없습니다.");
                f.mb_recommend.focus();
                return false;
            }

            var msg = reg_mb_recommend_check();
            if (msg) {
                alert(msg);
                f.mb_recommend.select();
                return false;
            }
        }

// 아이디 중복체크
$(".idcheck").click(function(){
	var msg = reg_mb_id_check();

	if(msg == "" || msg == null){
		// 중복된 아이디가 존재하지 않는다.
		if(!confirm("가입할 수 있는 아이디입니다.\n현재 아이디를 사용하시겠습니까?")){
			document.getElementById("reg_mb_id").value = "";
		}
	}
	else
	{
		// 중복된 아이디가 존재한다.
		alert(msg);
	}
});

        <?php echo chk_captcha_js();  ?>

        document.getElementById("btn_submit").disabled = "disabled";

        return true;
    }
    </script>

<!-- } 회원정보 입력/수정 끝 -->