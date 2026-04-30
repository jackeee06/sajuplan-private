<?php
$sub_menu = '200900';
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');

$g5['title'] = '관광지, 지역홍보 바로가기';
include_once('./admin.head.php');
?>


<div class="service_wrap">
	<ul>
    	<img src="<?php echo G5_ADMIN_URL ?>/img/tour_icon_01.png" alt="">
        관광지 바로가기
    </ul>
    <ul>
    	<img src="<?php echo G5_ADMIN_URL ?>/img/tour_icon_02.png" alt="">
        관광지 글쓰기
    </ul>
    <ul>
    	<img src="<?php echo G5_ADMIN_URL ?>/img/tour_icon_03.png" alt="">
        지역홍보 바로가기
    </ul>
    <ul>
    	<img src="<?php echo G5_ADMIN_URL ?>/img/tour_icon_04.png" alt="">
        지역홍보 글쓰기
    </ul>
</div>

<?php
include_once('./admin.tail.php');