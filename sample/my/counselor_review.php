<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = '후기관리';

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>


<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 



<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">

<div style="width:100%; float:left; padding:100px 0; font-size:18px; font-weight:600; text-align:center;">
	<i class="xi-spinner-2 xi-spin" style="font-size:100px; color:#999;"></i>
    <p style="margin-top:20px;">준비중입니다.</p>
</div>

<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>