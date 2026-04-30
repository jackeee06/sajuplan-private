<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");
?>

<style>

</style>

<div class="title">회원정보 수정</div>

<div class="form_warp">
    <ul>
    	<p class="input_title">이메일(아이디)</p>
	    <li class="input_div input_div_flex">
        	
    		<input type="text" placeholder="아이디" value="test@gmail.com" />
	    </li>
        
        <p class="input_title">비밀번호</p>
	    <li class="input_div">        	
    		<input type="password" placeholder="입력해주세요." value="1234" />
	    </li>
        
        <p class="input_title">연락처</p>
    	<li class="input_div">
        	<input type="text" placeholder="하이픈'-' 제외" value="01012345678" />
    	</li>
        
        <p class="input_title">이름</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="text" placeholder="입력해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">남자</span>
                <span>여자</span>
            </p>
    	</li>
        
        <p class="input_title">생년월일</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="date" placeholder="선택해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">음력</span>
                <span>양력</span>
            </p>
    	</li>
        
        <p class="input_title">태어난 시간</p>
    	<li class="input_div input_div_flex  input_div_toggle_02">
        	<input type="time" placeholder="선택해주세요" />
            
            <p class="toggle_btn_02">
            	<span class="on">모름</span>
            </p>
    	</li>
        
        <p class="input_title">주소</p>
        <li class="input_div input_div_flex  input_div_toggle mbot_5">
            <input type="text" id="sample2_postcode" placeholder="우편번호">
            
            <button type="button" class="overlap idcheck btn_frmline_02" onclick="sample2_execDaumPostcode()">우편번호 검색</button>
    	</li>
    	<li class="input_div">
        	<input type="text" class="mbot_5" id="sample2_address" placeholder="주소">
			<input type="text" class="mbot_5" id="sample2_detailAddress" placeholder="상세주소">
			<input type="text" class="mbot_5" id="sample2_extraAddress" placeholder="참고항목">
    	</li>
        
      	<li class="page_noti_02">
        	일일운세 
        	<label class="switch">
  				<input name="push_service" type="checkbox" id="push_service"  onclick="set_push_mb('push_service')" value="Y" checked="checked" <?=$push_service_class?>>
  				<span class="slider round" id="push_all_c"></span>
			</label>    
        </li>

      <li>
        	<a href="../main/index.php">
          	<button class="log_btn">회원정보 수정</button>
            </a>
        </li>
        
        <li class="mtop_15">
        	<a href="change_pw.php">
          	<button class="log_btn_02">비밀번호 변경</button>
            </a>
        </li>
        
        <li class="link_div">
        	<a href="">로그아웃</a>
        </li>
    </ul>
</div>




<script>
$(document).ready(function(){
    $('.register_pw i').on('click',function(){
        $('input').toggleClass('active');
        if($('input').hasClass('active')){
            $(this).attr('class',"xi-eye")
            .prev('input').attr('type',"text");
        }else{
            $(this).attr('class',"xi-eye-off")
            .prev('input').attr('type','password');
        }
    });
});

</script>

<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
