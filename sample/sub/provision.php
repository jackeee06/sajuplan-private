<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "이용약관";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

 
<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 
<style>
.etc {width:100%; padding:15px;}
.etc textarea { width:100%; height:calc(100vh - 160px); border:none;}
</style>

<div class="etc" style="">
    <textarea readonly><?php echo get_text($config['cf_stipulation']) ?>
	</textarea>
</div>

<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 

<?
include_once(G5_THEME_PATH.'/tail.php');
?> 
