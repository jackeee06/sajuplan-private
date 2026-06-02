<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>


<div class="my_wrap">


<div class="con_section con_section_b_bot_02">
	<a href="../etc/register_modify.php">
	<ul class="my_profile">
    	<li class="my_img"><img src="../img/common/level_1.png"/></li>
        <li class="my_info">
        	<ul class="my_name">
              	홍길동 님
                <p class="my_id">thesaju10@naver.com</p>
            </ul>
            <span class="my_edit"><img src="../img/head/edit.png"></span>
        </li>
    </ul>
    </a>
    
    <ul class="level_info">
    	<li class="my_levelup">
        	다음 SILVER등급까지 충전금액<br />
        	<span><strong>40,000</strong>원</span> 남음
            
            <p>
            	내 알약
	        	<img src="../img/left/quick_02.png">
    	        <span>360</span>
	        </p>
        </li>
        
        <a href="../my/grade.php">
        <li class="levle_banner">사주플랜 등급보기</li>
        </a>
    </ul>
</div>


<div class="con_section con_section_b_bot_02">
  <h3 class="con_title">자주찾는 메뉴</h3>
    <ul class="my_menu">

        <li class="my_menu_item">
       	  <a href="history.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">상담내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="review.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">상담후기</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="coin.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">알약 이용내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="store.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">스토어</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="wish.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_05.png"/></p>
            <p class="my_menu_text">나의 소원함</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="coupon.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_06.png"/></p>
            <p class="my_menu_text">쿠폰/이벤트</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="charm.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_07.png"/></p>
            <p class="my_menu_text">사주플랜 부적</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../etc/qa_list.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_08.png"/></p>
            <p class="my_menu_text">문의 게시판</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../etc/set.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_11.png"/></p>
            <p class="my_menu_text">앱 설정</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        </li>
   		
    </ul>

<!------ 공통내용 : 롤링배너  ------>
<?php include_once("../etc/rolling_banner.php"); ?>    
</div>

<div class="con_section">
	<a href="../etc/login.php">
    <div class="my_logout">로그아웃</div>
    </a>
</div>

</div>
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>