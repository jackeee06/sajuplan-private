<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "나의 구매현황";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<div class="con_section" >
    <ul class="order_his_wrap">	
    	<!-- 주문상태 -->
        <a href="store_view.php">
    	<li class="order_his_info">
        	<p>2022. 11. 23</p>
            <span><i class="xi-angle-right"></i></span>
        </li>        
       	<!-- 주문내용 -->
        <li class="order_his_con">
        	
            <p class="order_his_statu order_02">배송준비 중</p>
           	<p class="order_his_name">사주패키지</p>                
            <p class="order_his_info">수량 1개 | 490개</p>
                    
                <!-- 상품사진: Background-image처리 -->
        	<p class="order_his_img" style=" background-image:url(../img/sample/column_02.png);"></p>
        </li>
        </a>
    </ul>
    
    <ul class="order_his_wrap">	
    	<!-- 주문상태 -->
        <a href="store_view.php">
    	<li class="order_his_info">
        	<p>2022. 11. 23</p>
            <span><i class="xi-angle-right"></i></span>
        </li>        
       	<!-- 주문내용 -->
        <li class="order_his_con">
        	
            <p class="order_his_statu order_03">발송완료</p>
           	<p class="order_his_name">사주패키지</p>                
            <p class="order_his_info">수량 1개 | 490개</p>
                    
                <!-- 상품사진: Background-image처리 -->
        	<p class="order_his_img" style=" background-image:url(../img/sample/column_02.png);"></p>
        </li>
        </a>
        
        <li id="myBtn" class="order_his_btn">구매후기 작성하기</li>
    </ul>
    
    <ul class="go_store">더 많은 상품 보러가기</ul>
              
</div>

<!-- The Modal -->
<div id="myModal" class="modal">

	<!-- Modal content -->
  	<div class="modal-content">
    	<span class="close"><i class="xi-close"></i></span>
    	<ul class="pop_title">리뷰를 입력해주세요.</ul>
        <ul class="item_name">
        	부적패키지
            <span class="review_star">
            	<ion-icon name="star" role="img" class="md hydrated" aria-label="star"></ion-icon>
                <ion-icon name="star" role="img" class="md hydrated" aria-label="star"></ion-icon>
                <ion-icon name="star" role="img" class="md hydrated" aria-label="star"></ion-icon>
                <ion-icon name="star" role="img" class="md hydrated" aria-label="star"></ion-icon>
                <ion-icon name="star" role="img" class="md hydrated" aria-label="star"></ion-icon>
            </span>
        </ul>
        <ul>
        	<textarea></textarea>
        </ul>
        
    	<ul><input type="file"></ul>
        
        <ul>
        	<button>작성</button>
        </ul>
  	</div>

</div>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>