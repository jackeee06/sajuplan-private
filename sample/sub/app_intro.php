<?php
//if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once "../common.php"; 
$g5['title'] = '';
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once(G5_THEME_MOBILE_PATH.'/head_main.php');

include_once(G5_THEME_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');

?>


<style>

header,
#container_title, 
.top,
.tail { display:none;}


</style>



<?php //include_once(G5_PATH.'/include/guide.php'); ?>

  <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">

  <!-- Demo styles -->
  <style>
    .swiper-container {
      width: 100%;
      height: 100vh;
	  padding:00px 0px;
    }
    .swiper-slide {
      text-align: center;
      /* Center slide text vertically */
      display: -webkit-box;
      display: -ms-flexbox;
      display: -webkit-flex;
      display: flex;
      -webkit-box-pack: center;
      -ms-flex-pack: center;
      -webkit-justify-content: center;
      justify-content: center;
      -webkit-box-align: center;
      -ms-flex-align: center;
      -webkit-align-items: center;
      align-items:left;
	  color:#fff;
	  font-size:16px;
	  font-weight:600;
	  height:100%;
    }
	
	.pass_btn {position:absolute; top:10px; right:15px; padding:4px 10px; border-radius:50px; background-color:rgba(0,0,0,.1); color:#777; font-size:12px; margin:0;}
  </style>

  <!-- Swiper -->
  <div class="swiper-container">
    <div class="swiper-wrapper">
      <div class="swiper-slide">
         	<a href="<?php echo G5_URL ?>">
 	           <p class="pass_btn">건너뛰기 <i class="xi-angle-right-thin"></i></p>
            </a>      
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_01.png" style=" height:100%;"/>
		</div>
        
        <div class="swiper-slide">
        	<a href="<?php echo G5_URL ?>">
 	           <p class="pass_btn">건너뛰기 <i class="xi-angle-right-thin"></i></p>
            </a> 
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_02.png" style="height:100%;"/>
		</div>
        
        <div class="swiper-slide">
        	<a href="<?php echo G5_BBS_URL ?>/login.php">
				<div style=" position:absolute; right:0; bottom:0; width:100%; height:60px; line-height:60px; background-color:#283c92; color:#fff; text-align:center; font-size:20px; font-weight:600; z-index:2;">
					로그인
				</div>
			</a>
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_03.png" style="height:100%;"/>
		</div>
    </div>
    <!-- Add Arrows -->
    <div class="swiper-button-next"></div>
    <div class="swiper-button-prev"></div>
  </div>

  <!-- Swiper JS -->
  <script src="<?php echo G5_JS_URL; ?>/swiper.min.js"></script>

  <!-- Initialize Swiper -->
  <script>
    var swiper = new Swiper('.swiper-container', {
      slidesPerView: 1,
      spaceBetween: 0,
      freeMode: true,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
    });
  </script>        	
            
        </ul>    	
    </div>





<?php
include_once(G5_THEME_PATH.'/tail.sub.php');
?>