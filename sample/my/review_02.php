<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>
<div class="title">상담후기</div>


<div class="con_section">
    
    <ul class="sub_tap sub_tap_2">
	    <button class="sub_tap_btn"><a href="../my/review.php">작성가능한 후기</a></button>
        <button class="sub_tap_btn on"><a href="../my/review_02.php">작성완료한 후기</a></button>
    </ul>
	
</div>


<div class="con_section" >
    <ul class="review_wrap">	
    	<li class="review_info">상담일자 : 2023. 03. 15</li>
        </li>        
            	<!-- 후기 내용 -->
                <li class="review_con">
                	<!-- 사진후기일 경우 Class : photo_review -->
                	<p class="photo_review">
                		힘낼 수 있는 용기 주셔서 감사합니다.<br />
                        견뎌낼 수 있는 힘이 나네요.<br />
                        감사합니다.
                        
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
                
                <li class="review_user counsel"> 
                	<p class="review_re_con">
                    궁금한 점을 자세히 잘 말씀해 주셔서 저도 상담이 너무 좋았어요. 지금도 너무 잘하시고 계시니깐 걱정 안하셔도 된답니다. 언제나 화이팅입니다 : )
                    
                    <!-- 후기사진: Background-image처리 -->
                        <span style=" background-image:url(../img/sample/column_02.png);"></span>
                    </p>
                    
                    <p class="review_user_img" style=" background-image:url(../img/sample/partner_28.png);"></p>
                    
                    <p class="review_user_score">
                    	<span class="review_user_id">바리공주공주</span>                        
                        <span id="myBtn" class="singo_btn">신고</span>
                    </p>
                </li>
          </ul>
</div>


<!-- The Modal -->
<div id="myModal" class="modal">

	<!-- Modal content -->
  	<div class="modal-content">
    	<span class="close"><i class="xi-close"></i></span>
        <ul class="pop_title">신고</ul>
        
    	<div class="form_warp">
        	<h4>신고하신 내용은 담당자에게 접수됩니다.</h4>
		    <ul>

    			<li class="mbot_15">
		        	<input type="radio" name="booking" id="booking_1">
    				<label for="booking_1"></label>	
                    욕설 및 불퇘한 언행 사용
    			</li>
                
                <li class="mbot_15">
		        	<input type="radio" name="booking" id="booking_2">
    				<label for="booking_2"></label>	
                    비방 및 비하로 인한 명예훼손
    			</li>
                
                <li class="mbot_15">
		        	<input type="radio" name="booking" id="booking_3">
    				<label for="booking_3"></label>	
                    성희롱 및 청소년에게 부적절한 언행 사용
    			</li>
                
                <li class="mbot_15">
		        	<input type="radio" name="booking" id="booking_4">
    				<label for="booking_4"></label>	
                    기타
                    <p class="p_left_28"><textarea class="small" placeholder="사유를 입력해주세요."></textarea></p>
    			</li>

                <li class="btn_div">
		          	<button class="cancel_btn close">취소</button>

                	<a href="../index.php" class="ok_btn">신고하기</a>
		        </li>

		    </ul>
		</div>
  	</div>

</div>





<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>