<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "오늘의 운세";  

//include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>


<style>
.con_div {    background-image: url(../../../img/today/today_bg.png); background-size: cover; background-position-y: 60px;}
	
.today { background:none;}	
</style>


<div class=" today">
  <ul class="today_con">
    	<li class="today_date">8월 6일(화)</li>
        <li class="today_name"><span><?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>님</span></li>
        <li class="today_cmt">자신의 신념을 가지고 목표를 세운 곳을 향해 묵묵히 가면 운기가 트이는 날입니다!</li>
    </ul>	
</div>




<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>