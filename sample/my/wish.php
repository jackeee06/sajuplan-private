<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>
<div class="title">나의 소원함</div>

<div class="con_section con_section_b_bot_02">
	<!------ 공통내용 : 소원다락방  ------>
	<?php include_once("../today/wish_summary_con.php"); ?>
    
    <div class="btn_100 btn_pink_gr mtop_15">소원작성 하러가기</div>
</div>


<div class="con_section">
	<?php include_once("../today/wish_summary_end_con.php"); ?>
</div>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>