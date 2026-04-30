<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "개인정보처리방침";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 
<!-- CSS for Modern 1-->
<link href="<?php echo G5_THEME_URL ?>/asset/css/index_modern_1.css" rel="stylesheet">

 
<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 
<style>
.etc {width:100%; padding:20px;}
.etc textarea { width:100%; height:calc(100vh - 160px); border:none;}
</style>

<div class="etc" style="">
	<textarea readonly><?php echo get_text($config['cf_privacy']) ?>
	</textarea>
</div>

<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 

<?
include_once(G5_THEME_PATH.'/tail.php');
?> 
