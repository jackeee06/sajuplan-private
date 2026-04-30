<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>
<div class="title">나의 구매현황</div>

<div class="order_view_wrap">

<div class="con_section order_view_date con_section_b_bot_02" >
	<ul>결제날짜 : 2022. 11. 23 오후 6시 15분</ul>
</div>


<div class="con_section page_noti mtop_15 con_section_b_bot_02">
	<h4>꼭 확인해주세요!</h4>
	<ul class="page_noti_item">잘못된 정보로 인한 환불은 불가합니다.</ul>
    <ul class="page_noti_item">정보수정을 원하는 경우 1:1문의를 통해 문의주세요.<br>(단, 정보수정은 풀이 전 일경우에만 가능합니다)</ul>
    <ul class="page_noti_item">상품구매 후 작업이 진행되면 환불이 불가능합니다.</ul>
    <ul class="page_noti_item">본인이 직접 연락을 받을 수 있는 연락처를 입력해주세요.</ul>
    <ul class="page_noti_item">담당자가 확인 후 고객님의 정보 재확인차 연락이 갈 수 있으니 참고 부탁드립니다.</ul>
</div>


<div class="con_section con_section_b_bot_02" >
    <ul class="order_his_wrap">	
        <li class="order_his_con">	
            <p class="order_his_statu order_02">배송준비 중</p>
           	<p class="order_his_name">사주패키지</p>                
            <p class="order_his_info">수량 1개 | 490개</p>      
            <!-- 상품사진: Background-image처리 -->
        	<p class="order_his_img" style=" background-image:url(../img/sample/column_02.png);"></p>
        </li>
    </ul>      
</div>

<div class="con_section order_view_info con_section_b_bot_02">
	<h3>입력 정보</h3>
    본인: 김길동 (2007-12-24 / 음력 / 13:00)<br />
    상대: 홍찰동 (2000-13-45 / 양력 / 07:00)
</div>


<div class="con_section order_view_info con_section_b_bot_02">
	<h3>주문자 정보</h3>
    홍길동 (010-1234-5678)
</div>

<div class="con_section order_view_info con_section_b_bot_02">
	<h3>결제 정보</h3>
    490개
</div>

<div class="con_section order_view_info" >
	<h3>배송지 정보</h3>
    홍길동 (대구 수성구 범어천로 54)
</div>


</div>
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>