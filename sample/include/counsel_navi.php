<?php
// 20250828 eun 심리 카테고리 노출 작업 시작
include_once(G5_LIB_PATH.'/counsel_flag.lib.php');
// ★ 심리(상담) 카테고리 노출 플래그 : Y=노출, N=비노출
//theme/basic/mobile/skin/board/counselor/list.skin.php 부분도 수정해야 함)
//$chk_f = 'Y';
if (!cs_show_simli() && (isset($_GET['sca']) && $_GET['sca'] === '심리')) {
    goto_url('../bbs/board.php?bo_table=counselor'); // 기본 목록으로 리다이렉트
    exit;
}
?>
<div class="top_nav" style="">
    <!--<a href="index.php"><ul>상담 홈</ul></a>-->
    <a href="../bbs/board.php?bo_table=counselor&sca=타로"><ul class="counsel_01">타로</ul></a>
    <a href="../bbs/board.php?bo_table=counselor&sca=신점"><ul class="counsel_02">신점</ul></a>
    <a href="../bbs/board.php?bo_table=counselor&sca=사주"><ul class="counsel_03">사주</ul></a>

    <?php if (cs_show_simli()) { ?>
        <a href="../bbs/board.php?bo_table=counselor&sca=심리"><ul class="counsel_04">심리</ul></a>
    <?php }
    // 20250828 eun 심리 카테고리 노출 작업 마감
    ?>
    <!--
    <a href="../counsel/pre.php"><ul class="counsel_pre">맛보기</ul></a>
    <a href="../counsel/mail.php"><ul class="counsel_email">이메일</ul></a>
    <a href="../counsel/review.php"><ul class="counsel_review">상담후기</ul></a>
    -->
</div>


<!---->
<!--<div class="top_nav" style="">-->
<!--	<a href="index.php"><ul>상담 홈</ul></a>-->
<!--	<a href="../bbs/board.php?bo_table=counselor&sca=타로"><ul class="counsel_01">타로</ul></a>-->
<!--	<a href="../bbs/board.php?bo_table=counselor&sca=신점"><ul class="counsel_02">신점</ul></a>-->
<!--	<a href="../bbs/board.php?bo_table=counselor&sca=사주"><ul class="counsel_03">사주</ul></a>-->
<!--	<a href="../bbs/board.php?bo_table=counselor&sca=심리"><ul class="counsel_04">심리</ul></a>-->
<!--	-->
<!--    <a href="../counsel/pre.php"><ul class="counsel_pre">맛보기</ul></a>-->
<!--	<a href="../counsel/mail.php"><ul class="counsel_email">이메일</ul></a>-->
<!--    -->
<!--	<a href="../counsel/review.php"><ul class="counsel_review">상담후기</ul></a>-->
<!--    -->
<!--</div>-->