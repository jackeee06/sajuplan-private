<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

//if (G5_IS_MOBILE) {
    //include_once(G5_THEME_MOBILE_PATH.'/head.php');
    //return;
//}

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


	<style>

		#container_title.scrolled {
		  background-color: #000 !important;
		  transition: background-color 200ms linear;
		}


.navbar {
    position: fixed !important;
    top: 0 !important;
	z-index:999 !important;
	width:100%;
}
.navbar ul {
    list-style-type: none;
    padding: 0;
}
.navbar ul li {
    display: inline-block;
    width: 100px;
    color: white;
}

#container_title { background:none !important;}


.haed_menu .push,
.search { display:none;}

.haed_menu .home { display:block !important;}

	</style>


<script>
    $(document).ready(function(){
      $(window).scroll(function(){
        var scroll = $(window).scrollTop();
        if (scroll > 1) {
          $(".navbar").css("background" , "linear-gradient(to top, rgba(255,255,255,0), rgba(255,255,255,.6))"); // 스크롤 시
        }
        else{
          $(".navbar").css("background" , "rgba(255,255,255,.0)"); // 기본
        }
      })
    })
</script>
  
  
<header id="hd_roll" class="navbar">
    <!--<h1 id="hd_h1"><?php echo $g5['title'] ?></h1>-->

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
            
			<?php include(G5_PATH.'/include/head_menu.php'); ?>
    	</h2>
        
       	
            
        
                    
			<?php if (defined('_SHOP_')) { ?>
            <?php } else { ?>
            <?php }?>

         	
        
        <!--  -->
        <?php //include_once(G5_PATH.'/include/slide_left.php'); ?>
                    

        

        <!-- 검색 -->
        


        
    </div>
</header>
<!-- } 상단 끝 -->


	<script>
        try{
            $(document).scroll(function () {
               // var $nav = $("#container_title");
                var $header = $("#container_title");
                $header.toggleClass('scrolled', $(this).scrollTop() > $header.height());
            });
        }
        catch (e) {
            console.log(e);
        }
	</script>


<hr>

<!-- 콘텐츠 시작 { -->
<div id="wrapper">
    <div id="container_wr">
   
    <div id="container">
        <!--<?php if (!defined("_INDEX_")) { ?><h2 id="container_title"><span title="<?php echo get_text($g5['title']); ?>"><?php echo get_head_title($g5['title']); ?></span></h2><?php } ?>-->