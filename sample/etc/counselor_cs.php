<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>

<style>
.c_cs_con { text-align:center; font-size:16px; padding:30px 0;}
.c_cs_btn {padding:2px 12px; border-radius:50px;background-color: #fb285f; color:#fff; display:inline-block; margin-top:15px; font-size:14px;}

.c_cs_his {}
.c_cs_his .c_cs_his_item { font-size:16px; font-weight:600; border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:15px; position:relative;}
.c_cs_his .c_cs_his_item i { font-size:18px; vertical-align:-2px; color:#666; display:inline-block; margin-right:2px;}
.c_cs_his .c_cs_his_item .c_cs_his_date { margin-top:2px; font-size:12px; color:#999; font-weight:400;}
</style>

<div class="title">문의하기</div>

<div class="top_nav">
	<a href="./counselor_cs.php"><ul class="on">문의하기 홈</ul></a>
	<a href="./faq.php"><ul>자주묻는 질문</ul></a>
 	<a href="./qa_write.php"><ul>문의하기</ul></a>
</div>



<div class="con_section center c_cs_con con_section_b_bot_02">
    <ul>어플 이용방법</ul>
    
    <span class="c_cs_btn">MY</span>
</div>

<div class="con_section center c_cs_his">
    <h3 class="con_title">
    	문의내역
    </h3>
    <ul class="c_cs_his_item">
    	<i class="xi-lock"></i>어플 이용방법
        <p class="c_cs_his_date">2022-10-19 14:37:37</p>
    </ul>
</div>


<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
