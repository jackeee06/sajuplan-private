<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");
?>





<style>
.head { background-color:transparent;}
.head .back,
.haed_menu { display:none;}

</style>




<div class="login_warp">
	<ul class="login_logo">
	  <img src="../img/head/logo.png"/>
	</ul>
    
    <ul>
	    <li class="login_id">
    		<input type="text" placeholder="아이디(이메일주소)" />
            <select>
            	<option>이메일 선택</option>
                <option>naver.com</option>
                <option>hanmail.net</option>
                <option>daum.net</option>
                <option>gmail.com</option>
                <option>kakao.com</option>
                <option>직접입력</option>
            </select>
	    </li>
    	<li class="login_pw">
        	<input type="password" placeholder="비밀번호" />
	        <i class="xi-eye-off"></i>
    	</li>


    
	    <li class="login_menu">
   		  	<span class="auto_login">
        		<input type="checkbox" id="cb1">
    			<label for="cb1"></label> 자동로그인  	
	        </span>
    	    
        	<p class="lost_info">
        		<a href="lost_id.php">아이디 찾기</a>
            	<span>|</span>
    	        <a href="lost_pw.php">비밀번호 찾기</a>
        	</p>
        </li>
        <li>
        	<a href="../main/index.php">
          	<button class="log_btn">로그인</button>
            </a>
        </li>
    </ul>
    
    <ul class="log_sns">
   	  	<p>SNS계정으로 간편 로그인하기</p>
        <span><img src="../img/common/sns_apple.png" /></span>
        <span><img src="../img/common/sns_kakao.png" /></span>
        <span><img src="../img/common/sns_naver.png" /></span>
        
        
        <a href="register.php"><li class="join_btn">회원가입</li></a>
        </li>
    </ul>
</div>


<script>
$(document).ready(function(){
    $('.login_pw i').on('click',function(){
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
