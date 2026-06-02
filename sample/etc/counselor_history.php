<?php
include_once("../include/head.sub.php");
include_once("../include/head.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<style>
.c_his {width:100%; float:left; padding-bottom:15px; margin-bottom:15px; border-bottom:1px solid #eee;}
.c_his .c_his_title { width:100%; float:left;font-size:18px; font-weight:600; margin-bottom:6px;}
.c_his .c_his_title .c_his_text { font-weight:400;}
.c_his .c_his_title .c_his_review { padding:2px 8px; font-size:12px; font-weight:600; border-radius:50px; border:1px solid #9f58f5; color:#9f58f5; display:inline-block; margin-left:4px;}


.c_his .c_his_con { width:100%; float:left; position:relative; padding-right:80px;}
.c_his .c_his_con .c_his_btn { position:absolute; top:50%; transform:translateY(-50%); right:0; width:70px; padding:10px 0; text-align:center; font-size:12px; color:#fff; border-radius:8px; }

.c_his .c_his_con dl { display:flex; font-size:14px; margin-top:6px;}
.c_his .c_his_con dt { width:80px; color:#333;}
.c_his .c_his_con dd { color:#626262;}


.c_his_wait .c_his_title { color:#fb285f} /*대기*/
.c_his_wait .c_his_con .c_his_btn { background-color:#fb285f;}

.c_his_complete .c_his_title { color:#9f58f5} /*완료*/
.c_his_complete .c_his_con .c_his_btn { background-color:#9f58f5;}

.c_his_end .c_his_title { color:#000} /*완료*/
.c_his_end .c_his_con .c_his_btn { background-color:#686868;}

</style>


<a href="../etc/counselor_list.php">

<div class="title">상담내역</div>

<div class="con_section date_search">
	<ul>
        	<li class="input_date">
            	2022-05-03
                <i class="xi-calendar-check"></i>
            </li>
            
            <li class="input_date_line">~</li>
            
            <li class="input_date">
            	날짜 선택
                <i class="xi-calendar-check"></i>
            </li>
            
            <li class="input_search"><i class="xi-search"></i></li>
    </ul>
</div>


<div class="con_section">
    
    <ul class="sub_tap sub_tap_4">
	    <button class="sub_tap_btn on">전체</button>
        <button class="sub_tap_btn">상담</button>
        <button class="sub_tap_btn">예약</button>
        <button class="sub_tap_btn">부재중</button>
    </ul>
	
    
</div>



<div class="con_section">
    
    <ul class="c_his c_his_complete">
    	<li class="c_his_title">상담완료<span class="c_his_text">(상담종료)</span><span class="c_his_review">리뷰작성완료</span>
        </li>
        
        <li class="c_his_con">
        	<dl>
        		<dt>고객</dt><dd>사주플랜(thesaju@naver.com)</dd>
        	</dl> 
            <dl>
        		<dt>상담일</dt><dd>2022-11-28 12:56</dd>
        	</dl>
            <dl>
        		<dt>종료일</dt><dd>2022-11-28 12:57:55</dd>
        	</dl>
            <dl>
        		<dt>상담유형</dt><dd>채팅</dd>
        	</dl>
            
            <p class="c_his_btn">상담내용<br />확인하기</p>
        </li>
    </ul>
    
    <ul class="c_his c_his_end">
    	<li class="c_his_title">예약취소<span class="c_his_text">(사용자취소)</span>
        </li>
        
        <li class="c_his_con">
        	<dl>
        		<dt>고객</dt><dd>김현지(sksksu@naver.com)</dd>
        	</dl>
            <dl>
        		<dt>상담일</dt><dd>2022-11-28 12:56</dd>
        	</dl>
            <dl>
        		<dt>상담유형</dt><dd>음성</dd>
        	</dl>
            
            <p class="c_his_btn">상담가능<br />알림발송</p>
        </li>
    </ul>
    
    <ul class="c_his c_his_wait">
    	<li class="c_his_title">예약대기<span class="c_his_text">(2022-11-29 11:17)</span>
        </li>
        
        <li class="c_his_con">
        	<dl>
        		<dt>고객</dt><dd>김현지(sksksu@naver.com)</dd>
        	</dl>
            <dl>
        		<dt>상담일</dt><dd>2022-11-28 12:56</dd>
        	</dl>
            <dl>
        		<dt>상담유형</dt><dd>음성</dd>
        	</dl>
            
            <p class="c_his_btn">예약<br />확정/취소</p>
        </li>
    </ul>
    
</div>

</a>

<?php
//include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
