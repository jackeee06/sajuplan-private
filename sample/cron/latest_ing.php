#!/usr/bin/php -q
<?php
$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";

include_once($DOCUMENT_ROOT."/common.php"); // 메뉴별 공통파일
###############################################
	
$sql = "select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state='CONN'";
$rst = sql_fetch($sql);
$ct = $rst["ct"];
?>
<div class="counselor_tap_title">현재 <span class="orange" style="font-weight:700;"><?=$ct?>명</span>이 상담 진행중입니다.</div>

<div class="latest_wr">
	<?php
	$itab = "ing";
   echo latest('theme/counselor_latest', 'counselor',7, 23);		// 최소설치시 자동생성되는 갤러리게시판
	?>
</div>	
<div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>