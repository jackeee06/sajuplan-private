<?php
include_once("../include/head.sub.php");
include_once("../include/head_main.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<style>
/*
.tail,
tail_block { display:none !important;}
*/
</style>

<div class="top_nav" style="">
	<a href="index.php"><ul>소원성취 홈</ul></a>
	<a href="my_today.php"><ul>오늘의운세</ul></a>
	<a href="wish.php"><ul>소원다락방</ul></a>
	<a href="column_list.php"><ul>사주플랜칼럼</ul></a>
	<a href="store.php"><ul class="on">스토어</ul></a>
</div>

<a href="store_view.php">
<div class="con_section">
    <ul class="store_wrap">
    	<!-- 제품01 -->
        <li class="store_2">
            <div class="store_item">
            	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_01.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>
                </ul>
            </div>            
		</li>
        
        <!-- 제품02 -->
   		<li class="store_2">
            <div class="store_item">
           		<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_02.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>
                    
                </ul>
            </div>            
		</li>
        
        
        <!-- 제품03 -->
   		<li class="store_2">
            <div class="store_item">
           		<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_03.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>
                    
                </ul>
            </div>            
		</li>

    	<!-- 제품01 -->
   		<li class="store_2">
            <div class="store_item">
           		<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_01.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>
                    
                </ul>
            </div>            
		</li>
        
        <!-- 제품02 -->
   		<li class="store_2">
            <div class="store_item">
           		<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_02.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>                    
                </ul>
            </div>            
		</li>
        
        <!-- 제품03 -->
   		<li class="store_2">
           <div class="store_item">
           	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="store_item_img" style=" background-image: url(../img/sample/good_03.png); "></ul>
	            <ul class="store_item_info">
                	<li class="store_item_name">사주패키지</li>
                	<li class="store_item_text">
                        <span class="store_item_text_01"><img src="../img/head/point.png" /> 900개</span>
                        <p class="store_item_text_02">
                        	<span><img src="../img/common/list_icon_review.png" /> 6</span>
                        	<span><img src="../img/common/list_icon_average.png" /> 5.0</span>
                        </p>
                    </li>
                </ul>
            </div>            
		</li>
    </ul>
</div>
</a>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>