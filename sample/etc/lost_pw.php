<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");
?>

<style>

</style>

<div class="title">비밀번호 찾기</div>

<div class="form_warp">
    <ul>
         
        <p class="input_title">이름</p>
    	<li class="input_div">
        	<input type="text" placeholder="입력해주세요" />
    	</li>
        
        <p class="input_title">이메일(아이디)</p>
	    <li class="input_div input_div_flex">
        	
    		<input class="input_pw" type="text" placeholder="아이디" />
            
            <select class="input_pw">
            	<option>이메일 선택</option>
                <option>naver.com</option>
                <option>hanmail.net</option>
                <option>daum.net</option>
                <option>gmail.com</option>
                <option>kakao.com</option>
                <option>직접입력</option>
            </select>
	    </li>
        
        <p class="input_title">연락처</p>
    	<li class="input_div">
        	<input type="text" placeholder="하이픈'-' 제외" />
    	</li>

        <p class="input_title">생년월일</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="text" placeholder="선택해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">음력</span>
                <span>양력</span>
            </p>
    	</li>
    
        <li>
        	<a href="../main/index.php">
          	<button class="log_btn">비밀번호 찾기</button>
            </a>
        </li>
    </ul>
</div>

<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
