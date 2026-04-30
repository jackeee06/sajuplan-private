<?php
include_once("../include/head.sub.php");
include_once("../include/head_main.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<div class="top_nav">
	<a href="index.php"><ul>소원성취 홈</ul></a>
	<a href="my_today.php"><ul>오늘의운세</ul></a>
	<a href="wish.php"><ul>소원다락방</ul></a>
	<a href="column_list.php"><ul class="on">사주문칼럼</ul></a>
	<a href="store.php"><ul>스토어</ul></a>
</div>



<div class="sub_nav">
	<a href="column_list.php"><ul>전체</ul></a>
	<a href="column_list.php"><ul>사주</ul></a>
	<a href="column_list.php"><ul>심리</ul></a>
	<a href="column_list.php"><ul>건강</ul></a>
	<a href="column_list_02.php"><ul class="on">꿈해몽</ul></a>
</div>

<div class="con_section search_bar">
    <ul class="type_search">
    	<input class="input" type="text" placeholder="키워드검색">
        <i class="xi-search"></i>
    </ul>
</div>

<div class="toggle_list">
    <details>
		<summary>웨딩드레스를 입고 신랑과 나란히 서서 결혼식을 올리면</summary>            
		<div class="summary_con">결사나 계모임, 동창회 등에서 어떤 책임을 맡게 된다.</div>
	</details>
    
    <details>
		<summary>결혼식 축사를 읽으면</summary>            
		<div class="summary_con">어떤 결사나 모임에서 선언문이나 계약 사항을 보고할 일의 비유이다.</div>
	</details>
    
    <details>
		<summary>관을 상여에 얹고 장례 행렬을 이루면</summary>            
		<div class="summary_con">자타의 사업성과를 매스컴을 통해서 광고선전할 일이 있으며, 따르는 장례행렬은 그 업적을 기리거나 추종하는 사람들이다.</div>
	</details>
    
    <details>
		<summary>결혼식장으로 걸어 들어간 꿈</summary>            
		<div class="summary_con">다음날 만나는 사람과 인사를 주고 받거나 결사·집회 등에 참석하게 된다.</div>
	</details>
    
    <details>
		<summary>결혼식에 참석한 부모와 내빈을 보는 꿈</summary>            
		<div class="summary_con">부모는 협조자를 뜻하며 내빈은 계약·결사·집회의 당사자들을 상징한다.</div>
	</details>
    
    <details>
		<summary>식장 문을 닫거나 나와 버리는 꿈</summary>            
		<div class="summary_con">회담이 결렬됨을 의미한다</div>
	</details>
</div>


<?php include_once("../include/pagination.php"); ?>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>