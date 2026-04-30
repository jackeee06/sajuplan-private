<!--20250728 eun 급상승 상담사 리스트 페이지 작업 시작-->

<?php
include_once('./_common.php');
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');

$g5['title'] = '급상승 상담사';
include_once(G5_PATH.'/head.php');

// 250801 wb moved to ajax.rising_counselor_list.php

include_once($member_skin_path.'/rising_counselor.skin.php');
include_once(G5_PATH.'/tail.php');
?>
<!--20250728 eun 급상승 상담사 리스트 페이지 작업 마감-->