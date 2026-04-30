<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    define('G5_IS_COMMUNITY_PAGE', true);
    include_once(G5_THEME_SHOP_PATH.'/shop.head.php');
    return;
}

include_once(G5_THEME_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');
?>


<link rel="stylesheet" href="../css/head_roll.css" type="text/css">

<style>
.head { background-color:transparent;}
.head_block { display:none;}

.head .haed_menu {
    width: 50px;
    height: 100%;
	margin-right:0;
}

.head .haed_menu img {width: 24px;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);}
</style>


<div class="head">
	<a href="#" onclick="history.go(-1); return false;" class="btn_back">
    <ul class="back">
   		<img src="../img/head/back.png">
    </ul>
    </a>
    
    <ul class="title">바리공주</ul>

</div>

<?php include_once("../include/head_snb_con.php"); ?>

<!-- 좌측 슬라이드 메뉴 -->


<div class="head_block"></div>

<div id="wrapper">

