<?php
include_once("../common.php"); // 메뉴별 공통파일

$g5['title'] = "자주 묻는 질문";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<div class="con_section search_bar">
    <ul class="type_search">
    	<input class="input" type="text" placeholder="키워드검색">
        <i class="xi-search"></i>
    </ul>
</div>

<div class="toggle_list">
    <details>
		<summary>유튜브 구독 인증은 어떻게 하나요?</summary>            
		<div class="summary_con">유튜브 구독 인증 캡쳐본을 어플 내 문의게시판에 작성하여 주시면 확인 후 알약 적립을 도와드리겠습니다.</div>
	</details>
    
    <details>
		<summary>상담이 끊겼어요.</summary>            
		<div class="summary_con">상담연결이 잘 안되거나 상담 도중 연결이 끊긴다면 고객님의 데이터 상태를 확인해주세요.<br />와이파이 이용이 아닌 데이터로 이용해주시기 바라며 지속적인 문제 발생 시 어떤 선생님과 어떤 상담으로 이용 중이셨는지 문의게시판에 남겨주시면 상황에 따라 안내를 도와드리겠습니다.</div>
	</details>
    
</div>


<?php include_once("../include/pagination.php"); ?>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>