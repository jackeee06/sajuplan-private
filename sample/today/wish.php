<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "소원다락방";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 


<!-- 투데이 탭메뉴
<?php include_once("../include/today_tap.php"); ?>
 -->
 
<div class="con_section con_section_b_bot">
    <!-- 소원다락방 내용 : START -->
	<div class="wish_summary_before_con">
    	<!-- 소원다락방 이미지, 그래프 -->
        <img  src="../img/today/wish_before_img.png"/>
    </div>
</div>

<div class="con_section con_section_b_bot">
	<!------ 공통내용 : 소원다락방  ------>
	<?php include_once("../today/wish_summary_con.php"); ?>
</div>




<div class="con_section gray_wrap">
	<ul class="wish_wrap wish_event_wrap">
    	<h3>소원다락방 EVENT</h3>
        <li class="wish">
        	<p class="wish_img" style="background-image:url(../img/sample/wish.jpg);">D-47</p>
            
            <ul class="wish_text">
            	<li class="wish_date">2023. 01. 09 ~</li>                
                2023년, 활기차고 에너지 넘치는 한 해가 되게 해주세요!
            </ul>
            
            <ul class="wish_btn">            	
            	<span class="wish_btn_sign">참여<br />하기</span>
                <span class="wish_statu">153,539명이 참여 중</span>
            </ul>
        </li>
    </ul>
</div>



<div class="con_section">
	<ul class="wish_wrap">
    	<h3><span>홍길동</span>님 소원 목록</h3>
    	<li class="wish">
        	<p class="wish_img" style="background-image:url(../img/sample/partner_03.png);">D-90</p>
            <ul class="wish_text">
            	<li class="wish_date">2023. 01. 09 ~</li>                
                올해는 무조건 공무원 합격하게 해주세요!! 진짜 열심히 공부할게요. 꼭 되게 해주세요            	
            </ul>
            
            <ul class="wish_btn">
            	<span class="wish_btn_complete">완료</span>   
                <span class="wish_btn_del">삭제</span>          	
            </ul>
        </li>
        
        <li class="wish">
        	<p class="wish_img" style="background-image:url(../img/sample/partner_04.png);">D-87</p>
            <ul class="wish_text">
            	<li class="wish_date">2023. 01. 09 ~</li>
                다시 시작하는 금연, 올해는 진짜로 영원한 안녕을 할 수 있게 도와주세요.
            </ul>
            
            <ul class="wish_btn">
            	<span class="wish_btn_complete end">완료</span>   
                <span class="wish_btn_del">삭제</span>          	
            </ul>
        </li>
    </ul>
</div>

<div id="myBtn" class="bottom_btn">소원 작성</div>

<!-- The Modal -->
<div id="myModal" class="modal">

	<!-- Modal content -->
  	<div class="modal-content">
    	<span class="close"><i class="xi-close"></i></span>
        <ul class="pop_title">소원 등록하기</ul>
        
    	<div class="form_warp">
		    <ul>
		        <p class="input_title">기도 날짜</p>
    			<li class="input_div input_div_num">
		        	<input type="text" placeholder="예) 7"/> 일
    			</li>
        
		        <p class="input_title">소원 내용 작성</p>
    			<li class="input_div">
		        	<textarea placeholder="소원을 작성하고 하루 한 번 내 소원을 기도해보세요!(공백 제외 50자 내외 작성 가능)"></textarea>
    			</li>
        
		        <p class="input_title">사진첨부</p>
    			<li class="input_div">
		        	<input type="file">
    			</li>
        
		        <li>
        			<a href="wish.php">
		          	<button class="log_btn">소원 등록하기</button>
        		    </a>
		        </li>
		    </ul>
		</div>
  	</div>

</div>



<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
