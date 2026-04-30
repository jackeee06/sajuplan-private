<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<ul class="title">사주문 알림함</ul>

<div class="push_wrap">
	<ul class="push_item">    	        
    	<li class="push_con">
	        <p class="push_title">3월 14일, 신점상담에는 [신월궁] 선생님과 상담받아보세요~!</p>
        	<p class="push_text" onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">23년 3월 14일 [신월궁]선생님 쿠폰번호 : 100010533</p>
        	<p class="push_date">2023-03-14 09:00</p>
        </li>
    </ul>
    <ul class="push_item">    	        
        <a href="../counsel/pre_view.php"><li class="push_go"><i class="xi-long-arrow-right"></i></li></a>
    	<li class="push_con">
	        <p class="push_title">맛보기상담 댓글 알림</p>
        	<p class="push_text">선생님께서 답변을 남겼습니다.</p>
        	<p class="push_date">2023-03-14 09:00</p>
        </li>
    </ul>
    <ul class="push_item">    	        
    	<li class="push_con">
	        <p class="push_title">3월 13일, 명쾌한 해결책이 필요하다면 [타로몽] 선생님과 상담받아보세요~!</p>
        	<p class="push_text" onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">23년 3월 13일 [타로몽]선생님 쿠폰번호 : 100010533</p>
        	<p class="push_date">2023-03-13 09:00</p>
        </li>
    </ul>
</div>



<?php
include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
