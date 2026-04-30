<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");
?>

<style>

</style>

<div class="title">비밀번호 변경</div>

<div class="form_warp">
    <ul>

        <p class="input_title">기존 비밀번호</p>
    	<li class="input_div">
        	<input type="password" placeholder="입력하세요" />
    	</li>
        
        <p class="input_title">새로운 비밀번호</p>
    	<li class="input_div">
        	<input type="password" placeholder="입력하세요" />
    	</li>
        
        <p class="input_title">새로운 비밀번호 확인</p>
    	<li class="input_div">
        	<input type="password" placeholder="입력하세요" />
    	</li>


        <li>
        	<a href="../main/index.php">
          	<button class="log_btn">비밀번호 수정</button>
            </a>
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
