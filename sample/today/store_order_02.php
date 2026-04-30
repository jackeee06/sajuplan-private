<?php
include_once("../include/head.sub.php");
include_once("../include/head_roll_store.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<!-- VIEW : START -->
<div class="store_view con_section_b_bot_02">
	<!-- PHOTO : START -->
	<ul class="photo_order" style=" background-image:url(../img/sample/good_01.png);">
	</ul>
    <!-- PHOTO : END -->
    
    <!-- PROFILE : START -->
    <ul class="profile">
        <!-- 이름 -->
        <li class="pro_title">사주패키지</li>
        <li class="pro_info">개인 사주풀이를 이메일로 받아보실 수 있습니다.<br />다양하게 구성된 추가상품들도 함께 주문하면 패키지 가격으로 혜택받으실 수 있어요!</li>
    </ul>
</div>


<div class="con_section order_wrap con_section_b_bot_02">
    
    <h3>상품선택</h3>
    	
	<ul class="order_item">
    	<li class="order_name">
            <input type="radio" name="pro01" id="대운" checked="checked"><label for="대운"></label>대운</li>
        <li class="order_price">
        	+ 990개
        	<p class="ctrl_box">
            	<span>-</span>
                <span>1</span>
                <span>+</span>
            </p>
        </li>
    </ul>
</div>

<div class="con_section order_wrap">
    
    <h3>추가선택</h3>    
    <ul class="order_item">
    	<li class="order_name">
        	<input type="radio" name="pro02" id="궁합" checked="checked"><label for="궁합"></label>
        	궁합
      </li>
        <li class="order_price">
        	+ 1,000개
            <p class="ctrl_box">
            	<span>-</span>
                <span>1</span>
                <span>+</span>
            </p>
        </li>
    </ul>
</div>


<a href="store_orderform.php">
<div class="bottom_btn bottom_btn_left">상품 결제하기<span class="point">+ 1,290개</span></div>
</a>


<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
