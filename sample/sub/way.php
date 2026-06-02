<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "사주플랜의 길";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 



<div><?php echo display_banner('사주플랜의길', 'mainbanner.10.skin.php'); ?></div>

<div class="counselor_list_wrap" >
        
	<div class="counselor_list bo_none" >
       <?php
	    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
	    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
	    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
		$itab="ai";
	    echo latest('theme/way', 'way', 2, 100);		// 최소설치시 자동생성되는 갤러리게시판
	    ?>
    </div>
            
</div>

<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
