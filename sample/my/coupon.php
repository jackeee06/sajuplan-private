<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>
<div class="title">쿠폰/이벤트</div>

<style>
.sub_tap .sub_tap_btn_01 { border-color:#465bf0 !important; color:#465bf0 !important; z-index:2; font-weight:600; background-color:fff !important; }
.sub_tap .sub_tap_btn_01 a {color:#465bf0 !important; background-color:#fff !important;}
</style>

<div class="con_section">
    <?php include_once(G5_PATH.'/include/tap_coupon.php'); ?>
</div>

<div class="con_section img_list">
	<ul onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">
    	<img src="../img/sample/coupon.png" />
    </ul>
    <ul onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">
    	<img src="../img/sample/coupon.png" />
    </ul>
    <ul onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">
    	<img src="../img/sample/coupon.png" />
    </ul>
    <ul onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">
    	<img src="../img/sample/coupon.png" />
    </ul>
    <ul onClick="alert('쿠폰번호가 복사되었습니다.\n쿠폰번호:202304260007');">
    	<img src="../img/sample/coupon.png" />
    </ul>
</div>

<div class="con_section coupon_reg">
	<div class="form_warp">
    <ul>
        <p class="input_title">쿠폰코드 등록</p>
    	<li class="input_div">
        	<input type="text" placeholder="쿠폰코드를 입력해주세요."/>
    	</li>
        
        <li>
          	<button class="log_btn">쿠폰 등록</button>
        </li>
    </ul>
	</div>

</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>