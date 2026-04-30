<?php

include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = '상담내역';

include_once(G5_THEME_MOBILE_PATH.'/head.php');

##############################################################





$sca = $_REQUEST["sca"];

// 기본 변수 설정 (예시)
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$sca = isset($_GET['sca']) ? $_GET['sca'] : '';
$member = ['mb_1' => '17473']; // 예시 사용자 ID

// 우선순위 기준 서브쿼리: roomid별 최소 reason 랭크(END_CHAT=1, START_CHAT=2, 나머지=3)
$sql_rank = "
  SELECT 
    COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.roomid')), 
      CONCAT('no_', no)
    ) AS group_roomid,
    MIN(
      CASE reason
        WHEN 'END_CHAT' THEN 1
        WHEN 'START_CHAT' THEN 2
        ELSE 3
      END
    ) AS min_rank
  FROM platform_consulting
  WHERE (reason='DISCONNECT' OR reason='START_CHAT' OR reason='END_CHAT')
    AND csrid = '".$member["mb_1"]."'
";

if($sca === "채팅상담") {
    $sql_rank .= " AND (JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) = 'Y')";
} else if($sca === "전화상담") {
    $sql_rank .= " AND (JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) = 'N')";
}

$sql_rank .= "
  GROUP BY group_roomid
";

// 기본 조인 + 조건
$sql_common = "
  FROM platform_consulting a
  LEFT JOIN g5_write_c_history b ON (a.no = b.wr_10)
  JOIN ( $sql_rank ) rank_table ON
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.mrtn, '$.roomid')), CONCAT('no_', a.no)) = rank_table.group_roomid
    AND CASE a.reason
          WHEN 'END_CHAT' THEN 1
          WHEN 'START_CHAT' THEN 2
          ELSE 3
        END = rank_table.min_rank
";

$sql_search = "
  WHERE (reason='DISCONNECT' OR reason='START_CHAT' OR reason='END_CHAT')
    AND csrid = '".$member["mb_1"]."'
";

if($sca === "채팅상담") {
    $sql_search .= " AND (JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) = 'Y')";
} else if($sca === "전화상담") {
    $sql_search .= " AND (JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(mrtn, '$.chatflag')) = 'N')";
}

if(!isset($sst) || !$sst) {
    $sst = "a.wr_datetime";
    $sod = "desc";
}

$sql_order = " ORDER BY {$sst} {$sod} ";

// 총 개수 구하기
$sql_count = "
  SELECT COUNT(*) AS cnt
  $sql_common
  $sql_search
";
$row = sql_fetch($sql_count);
$total_count = $row['cnt'];

$rows = 5;
$total_page  = ceil($total_count / $rows);
if ($page < 1) $page = 1;
$from_record = ($page - 1) * $rows;

// 실제 데이터 조회
$sql = "
  SELECT a.*, b.wr_1, b.wr_2, b.wr_content,
    JSON_UNQUOTE(JSON_EXTRACT(a.mrtn, '$.roomid')) AS roomid,
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.mrtn, '$.roomid')), CONCAT('no_', a.no)) AS group_roomid
  $sql_common
  $sql_search
  $sql_order
  LIMIT $from_record, $rows
";

// 쿼리 확인용 출력
// echo nl2br(htmlspecialchars($sql));

// 실행
$result = sql_query($sql);

$colspan = 3;

// 이후 $result 처리 코드 작성
?>





<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 



<!--

<div class="fix_btn write_btn ">

   	<a href="./counselor_history_form.php" class="point_bg white" title="작성">상담내역 작성</a>

</div>

-->



<div class="con_section_03">



    <nav id="bo_cate">

        <h2>상담내역 카테고리</h2>

        <ul id="bo_cate_ul">

            <li><a href="/my/counselor_history.php" <?if($sca==""){?>id="bo_cate_on"<?}?>>전체</a></li>

            <li><a href="/my/counselor_history.php?&amp;sca=채팅상담" <?if($sca=="채팅상담"){?>id="bo_cate_on"<?}?>>채팅상담</a></li>

			<li><a href="/my/counselor_history.php?&amp;sca=전화상담" <?if($sca=="전화상담"){?>id="bo_cate_on"<?}?>>전화상담</a></li>

        </ul>

    </nav>

 



		<?

		    for ($i=0; $row=sql_fetch_array($result); $i++) {



				$minfo = get_mbid($row["membid"]);



				/// 상담내역 가져오기 //


				$vsql = "select * from g5_write_c_history where wr_10='".$row["no"]."'";

				$vrow = sql_fetch($vsql);


				/// 후기내역 가져오기 //				

				$asql = "select * from g5_write_review where wr_10='".$row["no"]."'";

				$arow = sql_fetch($asql);

		?>

    	<div class="c_history_wrap">	

			<!-- 후기 내용 -->

    	    <ul class="c_history_con">

        		

              <div class="c_history_title">

          <?if($row['reason'] != 'START_CHAT') { ?>
					<span class="point">상담 완료</span>
          <?} else { ?>
          <span class="point">상담 중</span>
          <? } ?>

					<?php if(!$arow["wr_id"]){?>

						<span class="c_history_state">후기작성대기</span>

					<?php }else{?>

							<a href="/bbs/board.php?bo_table=review&wr_id=<?=$arow["wr_id"]?>">
                                <span class="c_history_review" style="">후기답변 달기 &gt;</span></a>

					<?php }?>

                </div>        	

	            

                <div class="c_history_info">

                    <dl>

                    	<dt>고객명</dt>

                        <dd><?=$minfo["mb_name"]?></dd>

                    </dl>

                    

                    <dl>

                    	<dt>상담시작</dt>

                        <dd><?=$row["start"]?></dd>

                    </dl>

                    

                    <dl>

                    	<dt>상담종료</dt>

                        <dd><?=$row["end"]?></dd>

                    </dl>

                    

					<?if($vrow["wr_id"]){?>

                    <dl>

                    	<dt>상담분류</dt>

                        <dd><?=$vrow["wr_1"]?></dd>

                    </dl>

                    

                    <dl>

                    	<dt>상담주제</dt>

                        <dd><?=$vrow["wr_2"]?></dd>

                    </dl>

                    

                    <dl>

                    	<dt>상담내용</dt>

                        <dd><?=$vrow["wr_content"]?></dd>

                    </dl>  

					<?}?>

                </div>          

    	    </ul>

            

            <ul class="c_history_btn_wrap" style="">

          <? if($row['reason'] == 'START_CHAT') { ?>
          <a class="c_history_list_btn" href="/counsel/counsel_chat_test.php?token=<?=$row['roomid']?>2">채팅방 이동</a>   
          <? }else if(!$vrow["wr_id"]){?>
					<a class="c_history_list_btn" href="/bbs/write.php?bo_table=c_history&no=<?=$row["no"]?>&md=conmy">고객상담 메모</a>   
          <? }else{?>
					<a href="/bbs/write.php?bo_table=c_history&w=u&wr_id=<?=$vrow["wr_id"]?>&no=<?=$row["no"]?>&md=conmy" class="point_bo point white_bg">상담 내용보기</a>
				<? }?>

				<!-- 채팅상담일 경우 

            	<button class="point_bo point white_bg">채팅상담 내용보기</button>

                -->          	

            </ul>

            

		</div>

         

		  <?php

    $k++;

	}

    if ($i == 0)

        echo "<div style='text-align:center;'>자료가 없습니다.</div>";

    ?>





<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>



   

    	

  

       

    	

</div>

<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 





<?php

include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');

?>