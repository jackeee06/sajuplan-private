<?php
include_once("../common.php"); // 메뉴별 공통파일

$g5['title'] = "문의 게시판";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<div class="con_section con_section_b_bot_02">
    
    <ul class="sub_tap sub_tap_btn_2">
	    <button class="sub_tap_btn"><a href="../etc/faq.php">자주 묻는 질문</a></button>
        <button class="sub_tap_btn"><a href="../etc/qa_write.php">문의하기</a></button>
    </ul>
	
</div>


<div class="con_section con_section_b_bot_02">
  	<h3 class="con_title">어플 이용방법</h3>
    <ul class="my_menu">

        <li class="my_menu_item">
       	  	<a id="myBtn" href="#">
   	    		<p class="my_menu_icon"><img src="../img/tail/icon_home_on.png"/></p>
            	<p class="my_menu_text">홈</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  	<a id="myBtn" href="#">
   	    		<p class="my_menu_icon"><img src="../img/tail/icon_content_on.png"/></p>
            	<p class="my_menu_text">지식</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  	<a id="myBtn" href="#">
   	    		<p class="my_menu_icon"><img src="../img/tail/icon_consult_on.png"/></p>
            	<p class="my_menu_text">상담</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  	<a id="myBtn" href="#">
   	    		<p class="my_menu_icon"><img src="../img/tail/icon_my_on.png"/></p>
            	<p class="my_menu_text">MY</p>
            </a>
        </li>

    </ul>  
</div>


<?php include_once("../include/guide.php"); ?>

<!-- 일반 게시판 리스트 타입 : START -->
<div class="list_type_02 con_section con_section_b_bot">
	
    <h3 class="con_title">문의내역</h3>
    
    <a href="../etc/qa_view.php">
    <ul class="list_02_detail">
        <li class="list_02_title_03">
            문의드립니다.
        </li>
        <li class="list_02_date_03">2023. 10. 26 14:37:37</li>
    </ul>
    </a>
    
</div>
<!-- 일반 게시판 리스트 타입 : END -->


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>