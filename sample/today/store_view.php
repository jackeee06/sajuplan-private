<?php
include_once("../include/head.sub.php");
include_once("../include/head_roll_store.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<!-- VIEW : START -->
<div class="store_view">
	<!-- PHOTO : START -->
	<ul class="photo" style=" background-image:url(../img/sample/good_01.png);">
	</ul>
    <!-- PHOTO : END -->
    
    <!-- PROFILE : START -->
    <ul class="profile">
        <!-- 이름 -->
        <li class="pro_title">사주패키지</li>
        <li class="pro_review">
        	
            <span><img src="../img/common/list_icon_review.png"> 6</span>
        	<span><img src="../img/common/list_icon_average.png"> 5.0</span>
        </li>
    </ul>
</div>

<div class="store_view">
    
    <!-- TAP : START -->
	<ul class="view_tap">
		<li class="view_tap_menu">
        	<p href="#tab1" class="view_tap_btn on">상세설명</p>
            <p href="#tab2" class="view_tap_btn">후기</p>
        </li>
        
 
        <li id="tab1" class="panel introduce">
        	
            개인사주풀이와 부적까지 한번에!<br /><br />
            사주풀이와 부적을 한번에 받아보고 싶으셨던 고객분들을 위해 사주문가 드디어 사주풀이와 고민 해결책 부적을 함께 받아보실수 있도록 사주풀이 패키지를 출시하게 되었습니다.<br /><br />
            
            
            더이상 오래 기다릴 필요 없이 사주풀이와 부적까지 한 번에 받아 고민을 해결해보세요!<br /><br />
            사주문 부적은 당사자 길일에 맞춰 기도를 하고 부적을 쓴답니다.<br />
            모두 수작업으로 오직 한 사람만을 위한 부적이 만들어지며 정성과 노력이 들어있는 부적입니다. <br />
            간절한 마음에 사주문 부적이 더해진다면 더욱 빛을 발하게 될겁니다.<br /><br />
            
            지금 바로 사주풀이 패키지를 만나보세요!<br />
        
        </li>


        
      <li id="tab2" class="panel review">
            
            <!-- 후기1 -->
			<ul class="review_wrap">	
            
            	<!-- 후기 내용 -->
                <li class="review_con">
                	<!-- 사진후기일 경우 Class : photo_review -->
                	<p class="photo_review">
                		만족합니다.
                        
                        <!-- 후기사진: Background-image처리 -->
                        <span style=" background-image:url(../img/sample/column_02.png);"></span>
                    </p>
                </li>
                
                <!-- 작성자 정보 -->
            	<li class="review_user">
                	<!-- 작성자 고객레벨 -->
                	<p class="review_user_img" style=" background-image:url(../img/common/level_1.png);"></p>
                    
                    <!-- 작성자 이메일, 평점 -->
                    <p class="review_user_score">
                    	<!-- 이메일 -->
                    	<span class="review_user_id">***yy@naver.comm</span>
                        <!-- 평점 -->
                        <span class="review_user_star">
	                        <ion-icon name="star"></ion-icon>
    	        	        <ion-icon name="star"></ion-icon>
        		            <ion-icon name="star"></ion-icon>
    	    	            <ion-icon name="star"></ion-icon>
	            	        <ion-icon name="star-half"></ion-icon>
                        </span>                        
                    </p>
                </li>                
          </ul>
          
          <ul class="review_wrap">	
				<li class="review_con">
                	<p class="photo_review">
                		패키지가 맘에 들어요.
                        
                        <!-- 후기사진: Background-image처리 -->
                        <span style=" background-image:url(../img/sample/column_03.png);"></span>
                    </p>
                </li>
                
            	<li class="review_user">
                	<p class="review_user_img" style=" background-image:url(../img/common/level_3.png);"></p>
                    <p class="review_user_score">
                    	<span class="review_user_id">***yy@naver.comm</span>
                        <span class="review_user_star">
	                        <ion-icon name="star"></ion-icon>
    	        	        <ion-icon name="star"></ion-icon>
        		            <ion-icon name="star"></ion-icon>
    	    	            <ion-icon name="star"></ion-icon>
	            	        <ion-icon name="star-half"></ion-icon>
                        </span>                        
                    </p>
                </li>                
          </ul>
          
        </li>
	</ul>
    <!-- TAP : END -->
    
</div>


<a href="store_order.php">
<div class="bottom_btn">결제하기</div>
</a>

<script id="src">
$(function(){
    // ul 에 li 를 클릭했을때
    $(".view_tap_btn").click(function(){
        // a 에 있는 모든 클래스 selected 를 삭제
        $(".view_tap_btn").removeClass("on");
        // 그리고 현재의 요소에만 selected 클래스 추가.
        $(this).addClass("on");
        // 탭의 변경에 맞쳐 패널의 표시,비표시를 변경합니다.모든 패널을 비표시합니다.
        $(".panel").hide();
        // $(this).attr("href") 로 클릭된 a 태그의 href 속성을 가져와 같은 이름의 id 속성을 가진 패널을 보여줍니다.
        // 즉 현재의 클릭된 요소만 보여줍니다.
        //$($(this).attr("href")).show();
        //$($(this).attr("href")).css("opacity","0.5").show();
        $($(this).attr("href")).fadeIn("slow");
        //$($(this).attr("href")).animate({    opacity: 1  }, 500, "swing", function() {    });
        // 탭에 a 요소로 되어 있어서 클릭했을때 발생하는 click 이벤트를 설정, 이동하지 못하게 합니다.
        return false;
    });

    //기본설정
    $(".panel").hide();
    $($('.view_tap_btn.on').attr("href")).fadeIn("slow");
})
</script>

<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
