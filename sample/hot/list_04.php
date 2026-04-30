<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "인기상담사"; 

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>
<div class="top_nav" style="">
	<!--<a href="index.php"><ul>상담 홈</ul></a>-->
	<a href="list.php"><ul>타로</ul></a>
	<a href="list_02.php"><ul>신점</ul></a>
	<a href="list_03.php"><ul>사주</ul></a>
	<a href="list_04.php"><ul class="on">심리</ul></a>
	<!--<a href="pre.php"><ul>맛보기</ul></a>
	<a href="mail.php"><ul>이메일</ul></a>
	<a href="review.php"><ul>상담후기</ul></a>-->
</div>


<div class="con_section search_bar" style="display:none;" >
    <ul class="type_search">
    	<input class="input" type="text" placeholder="선생님 닉네임"/>
        <i class="xi-search"></i>
    </ul>
    
  	<ul class="type_search">
    	<input class="input" input type="text" placeholder="해시태그"/>
        <i class="xi-search"></i>
    </ul>
    
    <ul class="type_btn">
   	  <img src="../img/common/icon_sort.png"/>
    </ul>
</div>

<div class="counselor_list_wrap">
        	<div class="counselor_list">

        	    <div class="counselor_list_item">
                	
                    <ul class="counselor_img_wrap">
                    	<a href="https://sajumoon.co.kr/bbs/board.php?bo_table=counselor&amp;wr_id=2" onclick="opener.document.location.href='https://sajumoon.co.kr/bbs/board.php?bo_table=counselor&amp;wr_id=2'; return false;">
                    	<li class="counselor_img" style=" background-image:url(../../../img/common/noimage.png);"></li>
                    	<span class="icon_cate simli">심리</span>
                    	<span class="list_scrap"><img src="../../../img/common/list_icon_scrap.png"></span>
                        </a>
                    </ul>
                    
                    <ul class="counselor_con_wrap">
               	    	<a href="https://sajumoon.co.kr/bbs/board.php?bo_table=counselor&amp;wr_id=2" onclick="opener.document.location.href='https://sajumoon.co.kr/bbs/board.php?bo_table=counselor&amp;wr_id=2'; return false;">
                        <li class="counselor_con_title">
                        	상담사
                            <!-- 상담사 고유번호 -->
                    		<?php include(G5_PATH.'/include/counselor_num.php'); ?>

                        </li>
                        <li class="counselor_con_text">상담사 소개</li>
                      	<li class="counselor_con_price">
                   	      	<img src="../../../img/common/icon_price.png" title="">
                      	    0,000원<span class="unit">(00초)</span>
                      	</li>
                        </a>
                        
                      	<!--상담상태 버튼 Wrap Start -->
    					<?php include(G5_PATH.'/include/counselor_state_btn.php'); ?>
						<!--상담상태 버튼 Wrap End -->
                  	</ul>
                    
    	          </div> 
                  
                  <details class="counselor_list_info">
            <summary>
            	<a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
	        	<ul class="left">
                	<span class="tag">#태그1<?php echo $row1['wr_9'] ?></span>
                    <span class="tag">#태그2<?php echo $row1['wr_10'] ?></span>
    	        </ul>
                </a>
                
                <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">  
                	<ul class="right">
           	  		      <li class="right_item">
                          	  <img src="../../../img/common/icon_review.png">최근 후기
                              <span>(<?=get_counselor_afcnt($list[$i]["mb_id"])?>)</span>
                          </li>
                          <li class="right_item gray">|</li>
	                      <li class="right_item">
                              문의
                              <span>(<?=get_counselor_counter($list[$i]["mb_id"])?>)</span>
                              
                          </li>
    	                  <!--<li class="right_item"><img src="../../../img/common/select_02.png"></li>-->             
            	      </ul>
                </a>
            </summary>
		</details>
                
        	</div>
        </div>
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
