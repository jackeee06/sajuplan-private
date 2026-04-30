<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<div class="title">주문정보 입력</div>

<!-- VIEW : START -->

<div class="form_warp con_section_b_bot_02">
    <ul>
		<h3>1. 본인정보</h3>  
        
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
        

    </ul>
</div>
<div class="form_warp con_section_b_bot_02">
    <ul>
		<h3>2. 상대방 정보</h3>  
        
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
        
    </ul>
</div>


<div class="form_warp">
    <ul>
		<h3>3. 기타정보</h3>  
        
        <p class="input_title">구체적인 궁금한 사항이나 고민(필수)</p>
    	<li class="input_div">
       	  <textarea placeholder="전후사정 등 구체적으로 기재해주세요."></textarea>
    	</li>            
        
        <p class="input_title">연락처/주소</p>
	    <li class="input_div input_div_flex">        	
    		<input class="input_pw" type="text" placeholder="연락처" />
            <input class="input_pw" type="text" placeholder="이메일" />
	    </li>
        
        <li class="input_div input_div_flex  input_div_toggle mbot_5">
            <input type="text" id="sample2_postcode" placeholder="우편번호">
            
            <button type="button" class="overlap idcheck btn_frmline_02" onclick="sample2_execDaumPostcode()">우편번호 검색</button>
    	</li>
    	<li class="input_div">
        	<input type="text" class="mbot_5" id="sample2_address" placeholder="주소">
			<input type="text" class="mbot_5" id="sample2_detailAddress" placeholder="상세주소">
			<input type="text" class="mbot_5" id="sample2_extraAddress" placeholder="참고항목">
    	</li>

    </ul>
</div>


<div class="con_section page_noti mtop_15">
	<h4>주의사항</h4>
	<ul class="page_noti_item">잘못된 정보로 인한 환불은 불가합니다.</ul>
    <ul class="page_noti_item">정보수정을 원하는 경우 1:1문의를 통해 문의주세요.<br />(단, 정보수정은 풀이 전 일경우에만 가능합니다)</ul>
    <ul class="page_noti_item">상품구매 후 작업이 진행되면 환불이 불가능합니다.</ul>
    <ul class="page_noti_item">본인이 직접 연락을 받을 수 있는 연락처를 입력해주세요.</ul>
    <ul class="page_noti_item">담당자가 확인 후 고객님의 정보 재확인차 연락이 갈 수 있으니 참고 부탁드립니다.</ul>
</div>

<div class="form_warp mtop_15">
    <ul>
	    <li class="register_menu">
   		  	<span class="auto_register">
        		<input type="checkbox" id="cb1">
    			<label for="cb1"></label> 위 정보로 서비스상품이 진행됨을 동의합니다.  	
	        </span>
    	    
        </li>
	</ul>
</div>

<a href="../my/store_view.php">
<div class="bottom_btn">완료</div>
</a>


<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
