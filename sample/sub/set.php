<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "앱 설정";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 


<div class="con_section_02">
    
    <ul class="set_div">        
		<li class="dis_none" style="background-image:url(../img/etc/icon_push.png);">
	        사주플랜 무료 일일운세 받아보기

       		<label class="switch">
  				<input name="push_service" type="checkbox" id="push_service"  onclick="set_push_mb('push_service')" value="Y" checked="checked" <?=$push_service_class?>>
  				<span class="slider round" id="push_all_c"></span>
			</label>              
        </li>
        
	</ul>
    
	<ul class="set_div"> 
        <!--
        <li style="background-image:url(../img/etc/icon_secret.png);">
            <a>고객센터</a>
        </li>
        -->
        
        <li style="background-image:url(../img/etc/icon_partner.png);">
            <a>리뷰로 응원하기</a>
        </li>        
            	
        <li style="background-image:url(../img/etc/icon_event.png);">
            <a href="../etc/notice_list.php">공지사항</a>
        </li>
    </ul>

    
    <ul class="set_div">    
        <li style="background-image:url(../img/etc/icon_guide.png);">
            <a href="../etc/provision.php" target="_self" class="">이용약관</a>
        </li>
        
        <li style="background-image:url(../img/etc/icon_privacy.png);">
            <a href="../etc/privacy.php" target="_self" class="">개인정보처리방침</a>
        </li>
    </ul>
    
    <!--
    <ul class="set_div">    
        <li class="text_item" style="background-image:url(../img/etc/icon_category.png);">
            앱 정보
            <span>ver 1.2.1</span>
        </li>
    </ul>    
    -->
	<!--
    <ul class="set_div">    
        <li class="text_item" style="background-image:url(../img/etc/icon_logout.png);">
            <a href="#">로그아웃</a>
        </li>
        
        
        <li class="text_item" style="background-image:url(../img/etc/icon_leave.png);">
            <a id="myBtn" href="#">탈퇴</a>
        </li>
    </ul>
    -->

</div>



<?php include_once("../include/leave.php"); ?>



<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
