<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "회계자금관리";  
include_once(G5_THEME_PATH.'/head_business.php');
//include_once('../include/sub_top_business.php');
 
?> 
<!-- CSS for Modern 1-->
<link href="<?php echo G5_THEME_URL ?>/asset/css/index_modern_1.css" rel="stylesheet">

<style>
.sub_tap a:nth-child(5) ul { background-color:#fff; color:rgba(21,50,83,.9); font-weight:600;}
</style> 
 
 
<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<article style=" display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap; text-align:center !important;">
	<div style="font-size:100px; text-align:center; width:100%; margin-top:50px;">
    	<i class="xi-spinner-1 xi-spin"></i>
    </div>
    <div style="font-size:20px; min-height:300px; text-align:center; width:100%;">
		준비중입니다.
    </div>
</article>


<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 

<?
include_once(G5_THEME_PATH.'/tail.php');
?> 
