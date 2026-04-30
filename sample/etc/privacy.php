<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "개인정보처리방침";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<div class="con_section">
<textarea style="width:100%; height:calc(100vh - 180px); padding:15px;" readonly="readonly"><?php echo get_text($config['cf_privacy']) ?></textarea>
</div>


<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once("../include/tail.sub.php");
?> 
