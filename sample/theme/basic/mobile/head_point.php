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


<header id="hd" class="point_bg">
	
    
    
    <h1 id="hd_h1"><?php echo $g5['title'] ?></h1>

    <div class="to_content"><a href="#container">본문 바로가기</a></div>

    <?php
    if(defined('_INDEX_')) { // index에서만 실행
        include G5_MOBILE_PATH.'/newwin.inc.php'; // 팝업레이어
    } ?>

    <div id="hd_wrapper">

        
		<h2 id="container_title" class="top pink_bg white" title="<?php echo get_text($g5['title']); ?>" style="border-bottom:none;">
    		<a href="javascript:history.back();">
            	<img src="<?php echo G5_IMG_URL ?>/head/icon_back_w.png" style="width:24px;"/>
                <span class="sound_only">뒤로가기</span>
            </a> 
            
            <span class="page_title"><?php echo get_head_title($g5['title']); ?></span>

			
            
            <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
				<?php include_once(G5_PATH.'/include/head_counselor_point.php'); ?>
			<? } else { ?>
				<?php include_once(G5_PATH.'/include/head_menu_point.php'); ?>
			<?php } ?>
            
            
    	</h2>
        
       	
            
        
                    
			<?php if (defined('_SHOP_')) { ?>
            <?php } else { ?>
            <?php }?>

         	
        
        <!--  -->
        <?php //include_once(G5_PATH.'/include/slide_left.php'); ?>
                    

        

        <!-- 검색 -->
        


        
    </div>
</header>


<?php   if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){?>
    <style>
        /* 헤더가 아래를 덮어도 배경은 터치 통과 */
        #hd_wrapper,
        #container_title {
            pointer-events: none;
        }

        /* 헤더 안 실제 클릭 요소만 다시 살리기 */
        #hd,
        #hd_wrapper,
        #container_title,
        #hd_login_msg {
            pointer-events: none;
        }

        #hd a, #hd button, #hd input,
        #hd_wrapper a, #hd_wrapper button, #hd_wrapper input,
        #container_title a, #container_title button,
        #hd_login_msg a {
            pointer-events: auto;
        }
        #container{
            padding-top: calc(0px + env(safe-area-inset-top)); /* 70px은 실제 헤더 높이에 맞춰 조정 */
        }


    </style>
<?php }?>

<div id="wrapper">

    <div id="container">

    <?php if (!defined("_INDEX_")) { ?>
    	<!--
    	<h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();"><i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sound_only">뒤로가기</span></a> <?php echo get_head_title($g5['title']); ?>
    	</h2>
        -->
    <?php }
	