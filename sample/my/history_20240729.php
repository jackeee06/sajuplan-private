<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "상담내역";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<div class="con_section date_search">
	<ul>
        	<li class="input_date">
            	<input type="date"  data-placeholder="날짜 선택" required="required" aria-required="true">
                <!--<i class="xi-calendar-check"></i>-->
            </li>
            
            <li class="input_date_line">~</li>
            
            <li class="input_date">
            	<input type="date" data-placeholder="날짜 선택" required="required" aria-required="true">
                <!--<i class="xi-calendar-check"></i>-->
            </li>
            
            <li class="input_search"><i class="xi-search"></i></li>
    </ul>
</div>

<div class="con_section">   
    <ul class="sub_tap sub_tap_4">
	    <button class="sub_tap_btn on">전체</button>
        <button class="sub_tap_btn">사주</button>
        <button class="sub_tap_btn">신점</button>
        <button class="sub_tap_btn">타로</button>
    </ul>
</div>




<div class="list_type_01 con_section_b_bot">
    <!-- 선생님 소개 -->
	<ul class="list_01_detail">
    	<!-- 사진 -->
        <a href="../counsel/view.php">
        <li class="photo" style="background-image:url(../img/sample/partner_28.png);">
        	<span class="wish_btn"><img src="../img/common/list_icon_scrap_on.png"/></span>
        </li>
        </a>
        
        <!-- 정보 -->
        <li class="info ">
        	<a href="../counsel/view.php">
        	<!-- 구분 --><span class="cate cate_type01">사주</span>
       		<!-- 활동명 --><p class="name">바리공주 <img class="c_grade" src="../img/common/grade_3.png"/></p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">명확하고 시원하게 고민해결과 행운의 문을 열어드립니다.</p>
            <!-- 사용알약 및 상담 방법 -->
            <p class="text03"><img src="../img/head/point.png"/> 사용알약 <span>108개 (음성)</span></p>
            
            <!-- 상담일자 -->
            <p class="text04">상담일자. 2023. 3. 12</p>
            </a>
        </li>
    </ul>

    <!-- 선생님 소개 -->
    <ul class="list_01_detail">
    	<a href="../counsel/view.php"><strong></strong>
    	<li class="photo" style="background-image:url(../img/sample/partner_07.png);">
        	<span class="wish_btn"><img src="../img/common/list_icon_scrap_w.png"/></span>
        </li>
        </a>
        
        <li class="info ">
        	<a href="../counsel/view.php">
        	<span class="cate cate_type02">신점</span>
       		<p class="name">해원도령 <img class="c_grade" src="../img/common/grade_2.png"/></p>
            <p class="text01">누구와도 말 못하는 속마음, 해원도령이랑~</p>
            <!-- 사용알약 및 상담 방법 -->
            <p class="text03"><img src="../img/head/point.png"/> 사용알약 <span>108개 (음성)</span></p>
            
            <!-- 상담일자 -->
            <p class="text04">상담일자. 2023. 3. 12</p>
            </a>
        </li>
  </ul>    
    
    <!-- 선생님 소개 -->
    <ul class="list_01_detail">
    	<a href="../counsel/view.php">
    	<li class="photo" style="background-image:url(../img/sample/partner_08.png);">
        	<span class="wish_btn"><img src="../img/common/list_icon_scrap_w.png"/></span>
        </li>
        </a>
        
        <li class="info ">
        	<a href="../counsel/view.php">
        	<span class="cate cate_type03">타로</span>
       		<p class="name">우산타로 <img class="c_grade" src="../img/common/grade_1.png"/></p>
            <p class="text01">고민되고 막막한 상황, 명쾌한 해결책이 되어드려요.</p>
            <!-- 사용알약 및 상담 방법 -->
            <p class="text03"><img src="../img/head/point.png"/> 사용알약 <span>108개 (음성)</span></p>
            
            <!-- 상담일자 -->
            <p class="text04">상담일자. 2023. 3. 12</p>
            </a>
        </li>
    </ul>
    
    <!-- 선생님 소개 -->
	<ul class="list_01_detail">
    	<!-- 사진 -->
        <a href="../counsel/view.php"><strong></strong>
        <li class="photo" style="background-image:url(../img/sample/partner_20.png);">	        
        	<span class="wish_btn"><img src="../img/common/list_icon_scrap_on.png"/></span>
        </li>
        </a>
        
        <!-- 정보 -->
        <li class="info ">
        	<a href="../counsel/view.php">
        	<!-- 구분 --><span class="cate cate_type01">사주</span>
       		<!-- 활동명 --><p class="name">바리공주 <img class="c_grade" src="../img/common/grade_3.png"/></p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">명확하고 시원하게 고민해결과 행운의 문을 열어드립니다.</p>
            
           <!-- 사용알약 및 상담 방법 -->
            <p class="text03"><img src="../img/head/point.png"/> 사용알약 <span>108개 (음성)</span></p>
            
            <!-- 상담일자 -->
            <p class="text04">상담일자. 2023. 3. 12</p>
            </a>
        </li>
    </ul>

    <!-- 선생님 소개 -->
    <ul class="list_01_detail">
	    <a href="../counsel/view.php">
    	<li class="photo" style="background-image:url(../img/sample/partner_26.png);">	    	
        	<span class="wish_btn"><img src="../img/common/list_icon_scrap_w.png"/></span>
        </li>
        </a>
        
        <li class="info ">
        	<a href="../counsel/view.php">
        	<span class="cate cate_type02">신점</span>
       		<p class="name">해원도령 <img class="c_grade" src="../img/common/grade_2.png"/></p>
            <p class="text01">누구와도 말 못하는 속마음, 해원도령이랑~</p>
            <!-- 사용알약 및 상담 방법 -->
            <p class="text03"><img src="../img/head/point.png"/> 사용알약 <span>108개 (음성)</span></p>
            
            <!-- 상담일자 -->
            <p class="text04">상담일자. 2023. 3. 12</p>
            </a>
        </li>
    </ul>    
    
</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
