<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "상담후기";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>


<?php //include_once(G5_PATH.'/include/counsel_navi.php'); ?>


<div class="con_section_03" >

	<div class="review_top" style="">
    	<ul class="review_top_img"><img src="../img/sample/review_top.png" style=""/></ul>
        <ul class="review_top_noti" style="">
        	<i class="xi-check point" style=""></i> 본인인증 완료 및 5분 이상 상담한 고객님에 한하여 후기 작성이 가능합니다.
        </ul>
    </div>
    
    <div class="review_sort" style="">
    	<ul class="review_sort_item" style="">
        	<span class="review_sort_btn">베스트순</span>
        	<span class="review_sort_btn on">최신순</span>
        </ul>
        <ul class="review_sort_photo">
        	<input type="checkbox" id="ing_counsel" />
	        <label for="ing_counsel">사진후기만 보기</label>
        </ul>
    </div>
    
  <div class="review_wrap">	
                 
                <ul class="review_user counsel_info"> 
                    <a href="../bbs/board.php?bo_table=counselor&wr_id=2">
                    <li class="review_user_img type_bg tarot">
                    	<p class="review_user_img_item" style=" background-image:url(../data/file/counselor/1935571771_uAzYUfps_df6bc1e6b0d58bab59b2308190429fdb746b4ab2.png);"></p>
                    </li>
                    </a>
                    
                    <li class="review_user_score">
                    	<a href="../bbs/board.php?bo_table=counselor&wr_id=2">
                        <p class="review_user_id">
                       	  <span class="cate point">타로</span>
                            타로몽
                        </p>
                        </a>
                        <p class="singo_btn">신고</p>
                    </li>
                </ul>
                
              <!-- 작성자 정보 -->
           	  <ul class="review_user">
				  <li class="review_user_score">
                   	  <p class="review_user_id">홍길동 <img src="../img/common/icon_mem_ok.png" /></p>
                  </li>
                    
                  <!-- 작성자 이메일, 평점 -->
                  <li class="review_user_score">
                      <span class="review_info">전화상담</span>
                      <span class="review_info">상담시간 10~30분</span>
                      <span class="review_info">2024-07-03</span>
                  </li>
              </ul>
                
                                
              <!-- 후기 내용 -->
              <ul class="review_con">
                	<!-- 사진후기일 경우 Class : photo_review -->
               	  <li class="review_con_text">
                		<p class="review_text">
	                        <span class="review_txt">	                            
	                            감사합니다.<br />
                                감사합니다.<br />
        		                감사합니다.
                            </span>
                            <span class="review_topic">상담주제: 속마음</span>
                        </p>
                        <!-- 후기사진: Background-image처리 -->
                        <p class="review_photo"><img src="../img/sample/view_01.jpg"/></p>
                    </li>
                  
                </ul>
                
                
                <ul class="review_user counsel point_02_bo"> 
					<li class="review_re_name">타로몽</li>
                    <li class="review_re_con">
                    언제나 화이팅입니다 : )
                    </li>
                </ul>
                
                
  </div>
</div>





<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
