<?php
include_once("../include/head.sub.php");
include_once("../include/head_main.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<!--
<div class="top_nav">
	<a href="index.php"><ul>소원성취 홈</ul></a>
	<a href="my_today.php"><ul class="on">오늘의운세</ul></a>
	<a href="wish.php"><ul>소원다락방</ul></a>
	<a href="column_list.php"><ul>사주문칼럼</ul></a>
	<a href="store.php"><ul>스토어</ul></a>
</div>
-->

<!--
<link rel="stylesheet" href="../css/head_bg_no.css" type="text/css">
-->

<div class="con_section today">
  <ul class="today_con">
    	<li class="today_date">2월 3일(금)</li>
        <li class="today_name">홍길동님</span></li>
        <li class="today_cmt">오랫동안 뜸했던 친구에게 연락이 온다면 적극적으로 만남을 전개해봐도 좋겠습니다.</li>
    </ul>	
</div>

<div class="con_section today_sol">
	<ul class="today_sol_con">
    	<li class="today_sol_title">
        	오늘의 처방전
            <span class="today_sol_img">
           		<img src="../img/today/today_mini_bg_img.png"/>
            </span>
        </li>
        <li class="today_sol_text">저녁에 소주 한 잔을 하며 못다한 이야기를 나눠보세요.</li>    	
    </ul>
</div>



<!------ 공통내용 : 추천선생님  ------>
<?php include_once("../counsel/rec_list.php"); ?>


<div class="con_section charm_down_wrap">
  <h3 class="con_title">
   	   부적 다운로드
	</h3>
    
	<ul class="charm_down">
   		<li class="charm_down_item">
            <p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">쾌변기원</p>
        </li>
        <li class="charm_down_item">
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">고백성공하자</p>
        </li>
        <li class="charm_down_item">
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">대박기원</p>
        </li>
        <li class="charm_down_item">
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">합격기원</p>
        </li>
        <li class="charm_down_item">
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">승진기원</p>
        </li>
        <li class="charm_down_item">
   	    	<p class="charm_img" style=" background-image:url(../img/sample/today_down.jpg); ">
            	<span><img src="../img/common/icon_down.png" /></span>
            </p>
            <p style=" margin-top:6px;">건강기원</p>
        </li>
    </ul>
</div>

<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>