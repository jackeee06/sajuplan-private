<?
include_once('./_common.php');
#######################################

	
		$sql = "select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state='CONN'";
		$rst = sql_fetch($sql);
		$ct = $rst["ct"];
		?>
		<div class="counselor_tap_title">현재 <span class="orange" style="font-weight:700;"><?=$ct?>명</span>이 상담 진행중입니다.</div>

		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
			$itab = "ing";
		    echo latest('theme/counselor_latest', 'counselor',7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>