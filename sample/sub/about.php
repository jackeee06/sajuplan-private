<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "이용안내";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<?php //include_once(G5_PATH.'/include/guide.php'); ?>
<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php //include_once(G5_PATH.'/include/guide.php'); ?>

  <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">

  <!-- Demo styles -->
  <style>
    .swiper-container {
      width: 100%;
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
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_01.png" style=" width:100%;"/>
		</div>
        
        <div class="swiper-slide">
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_02.png" style="width:100%;"/>
		</div>
        
        <div class="swiper-slide">
        	<img src="<?php echo G5_IMG_URL;?>/mobile/guide/img_03.png" style="width:100%;"/>
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




<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
