<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "서비스 이용약관";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<div class="con_section">
<textarea style="width:100%; height:calc(100vh - 180px); padding:15px;" readonly="readonly"><?php echo get_text($config['cf_stipulation']) ?></textarea>
</div>


<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once("../include/tail.sub.php");
?> 
