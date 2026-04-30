<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

//if(G5_COMMUNITY_USE === false) {
    //define('G5_IS_COMMUNITY_PAGE', true);
    //include_once(G5_THEME_SHOP_PATH.'/shop.head.php');
    //return;
//}

include_once(G5_THEME_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');
?>

<link href="<?php echo G5_THEME_URL; ?>/css/mobile.css" rel="stylesheet" type="text/css" />

<header id="hd">
	
    
    
    <h1 id="hd_h1"><?php echo $g5['title'] ?></h1>

    <div class="to_content"><a href="#container">본문 바로가기</a></div>

    <?php
    if(defined('_INDEX_')) { // index에서만 실행
        include G5_MOBILE_PATH.'/newwin.inc.php'; // 팝업레이어
    } ?>

    <div id="hd_wrapper">

        
		<h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();">
            	<img src="<?php echo G5_IMG_URL ?>/head/icon_back.png" style="width:24px;"/>
                <span class="sound_only">뒤로가기</span>
            </a> 
            
            <span class="page_title"><?php echo get_head_title($g5['title']); ?></span>

			<?php include_once(G5_PATH.'/include/head_menu.php'); ?>
    	</h2>
        
       	
            
        
                    
			<?php if (defined('_SHOP_')) { ?>
            <?php } else { ?>
            <?php }?>

         	
        
        <!--  -->
        <?php //include_once(G5_PATH.'/include/slide_left.php'); ?>
                    

        

        <!-- 검색 -->
        


        
    </div>
</header>



<div id="wrapper">

    <div id="container">
    
    <?php if (!defined("_INDEX_")) { ?>
    	<!--
    	<h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();"><i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sound_only">뒤로가기</span></a> <?php echo get_head_title($g5['title']); ?>
    	</h2>
        -->
    <?php }
	