<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<style>

/* 스토어 CSS */

/* 스토어 감싸는 BLOCK */
.list_type_gall {width:100%; float:left; display: flex; flex-flow: row wrap; justify-content: space-between; text-align:left;}
.list_type_gall .store_3 {width: calc(33% - 10px); margin-bottom:15px; position:relative;} /* 가로 3개로 나열 */
.list_type_gall .store_2 {width: calc(50% - 7px); margin-bottom:15px; position:relative;} /* 가로 2개로 나열 */

.gall_item {width:100%; float:left;}
.gall_item .gall_item_img {width: 100%; padding-bottom: 100%; border-radius: 8px; border: 1px solid #eee; background-position: center; background-size: cover; position: relative;} /* 제품이미지 : Background Image처리 */
.gall_item .gall_item_img .gall_item_icon { position:absolute; top:10px; right:10px; width:45px; height:45px; line-height:45px; font-weight:800; font-size:12px; background-color:#fb285f; color:#fff; text-align:center; border-radius:50%; }

.gall_item .gall_item_info {margin-top:10px;}
.gall_item .gall_item_info .gall_item_brand {font-size:12px; color:#999; margin-bottom:2px;}
.gall_item .gall_item_info .gall_item_name {font-size:14px; font-weight:600; color:#000; margin-bottom:4px;}
.gall_item .gall_item_info .gall_item_text {font-size:14px;}
.gall_item .gall_item_info .gall_item_text span { color:#999; display:inline-block; font-size:12px; margin-right:4px;}

.gall_item .gall_item_info .gall_item_text .gall_item_text_02 span { display:inline-block; margin-left:6px;}
.gall_item .gall_item_info .gall_item_text .gall_item_text_03 span { display:inline-block; margin-right:6px;}

.gall_item .gall_item_info .gall_item_text .gall_item_text_02 span img,
.gall_item .gall_item_info .gall_item_text .gall_item_text_03 span img {width:12px; vertical-align:-1px;}

</style>

<div class="title">선생님 꿀팁</div>

<a href="../etc/counselor_view.php">
<div class="con_section">
    <ul class="list_type_gall">
    	<!--  글01 -->
        <li class="store_2">
            <div class="gall_item">
            	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="gall_item_img" style=" background-image: url(../img/sample/good_01.png); "><p class="gall_item_icon">NEW</p></ul>
	            <ul class="gall_item_info">
                	<li class="gall_item_name">상담취소율을 낮추고 만족도는 높이는 꿀팁</li>
                	<li class="gall_item_text">
                        <span>#고객만족</span>
                        <span>#시간약속</span>
                        <span>#신뢰</span>
                    </li>
                </ul>
            </div>            
		</li>
        
        <!--  글01 -->
        <li class="store_2">
            <div class="gall_item">
            	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="gall_item_img" style=" background-image: url(../img/sample/good_01.png); "><p class="gall_item_icon">NEW</p></ul>
	            <ul class="gall_item_info">
                	<li class="gall_item_name">상담취소율을 낮추고 만족도는 높이는 꿀팁</li>
                	<li class="gall_item_text">
                        <span>#고객만족</span>
                        <span>#시간약속</span>
                        <span>#신뢰</span>
                    </li>
                </ul>
            </div>            
		</li>
        
        <!--  글01 -->
        <li class="store_2">
            <div class="gall_item">
            	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="gall_item_img" style=" background-image: url(../img/sample/good_01.png); "></ul>
	            <ul class="gall_item_info">
                	<li class="gall_item_name">상담취소율을 낮추고 만족도는 높이는 꿀팁</li>
                	<li class="gall_item_text">
                        <span>#고객만족</span>
                        <span>#시간약속</span>
                        <span>#신뢰</span>
                    </li>
                </ul>
            </div>            
		</li>
        
        <!--  글01 -->
        <li class="store_2">
            <div class="gall_item">
            	<!-- 제품이미지 : Background Image처리  -->
           	    <ul class="gall_item_img" style=" background-image: url(../img/sample/good_01.png); "></ul>
	            <ul class="gall_item_info">
                	<li class="gall_item_name">상담취소율을 낮추고 만족도는 높이는 꿀팁</li>
                	<li class="gall_item_text">
                        <span>#고객만족</span>
                        <span>#시간약속</span>
                        <span>#신뢰</span>
                    </li>
                </ul>
            </div>            
		</li>
        
    </ul>
</div>

<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
