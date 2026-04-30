<?php
include_once("../include/head.sub.php");
include_once("../include/head_main.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<style>
.con_section_b_bot { border-color:#fff !important;}
</style>


<div class="top_nav">
	<a href="index.php"><ul class="on">소원성취 홈</ul></a>
	<a href="my_today.php"><ul>오늘의운세</ul></a>
	<a href="wish.php"><ul>소원다락방</ul></a>
	<a href="column_list.php"><ul>사주문칼럼</ul></a>
	<a href="store.php"><ul>스토어</ul></a>
</div>


<!------ 소원다락방  ------>
<?php include_once("../today/wish_summary.php"); ?>


<!------ 공통내용 : 추천선생님  ------>
<?php include_once("../counsel/rec_list.php"); ?>


<div class="con_section charm_down_wrap">
  <h3 class="con_title">
   	   부적 다운로드
	</h3>
    
	<ul class="charm_down">
   		<li class="charm_down_item">
        	<a href="../img/sample/today_down.jpg" download>
            <p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">쾌변기원</p>
            </a>
        </li>
        <li class="charm_down_item">
   	    	<a href="../img/sample/today_down.jpg" download>
            <p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">고백성공하자</p>
            </a>
        </li>
        <li class="charm_down_item">
        	<a href="../img/sample/today_down.jpg" download>
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">대박기원</p>
            </a>
        </li>
        <li class="charm_down_item">
        	<a href="../img/sample/today_down.jpg" download>
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">합격기원</p>
            </a>
        </li>
        <li class="charm_down_item">
        	<a href="../img/sample/today_down.jpg" download>
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">승진기원</p>
            </a>
        </li>
        <li class="charm_down_item">
        	<a href="../img/sample/today_down.jpg" download>
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">건강기원</p>
            </a>
        </li>
    </ul>
</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>