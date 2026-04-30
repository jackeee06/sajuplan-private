<?php

include_once("./_common.php"); // 메뉴별 공통파일
//20250805
$g5['title'] = '전화상담 내역';

include_once(G5_THEME_MOBILE_PATH.'/head.php');

##############################################################





$sca = $_REQUEST["sca"];







$sql_common = " from platform_consulting a left join g5_write_c_history b on(a.no=b.wr_10) ";



$sql_search = " where (1) and reason='DISCONNECT' and csrid='".$member["mb_1"]."'";



if($sca){

    $sql_search .=" and b.wr_1='".$sca."'";

}





if (!$sst) {

    $sst = "a.wr_datetime";

    $sod = "desc";

}



$sql_order = " order by {$sst} {$sod} ";



$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";



//echo $sql;



$row = sql_fetch($sql);

$total_count = $row['cnt'];



$rows = 5;

$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산

if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)

$from_record = ($page - 1) * $rows; // 시작 열을 구함







$sql = " select a.*, b.wr_1, b.wr_2, b.wr_content {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";



//echo $sql;

//echo "<br>";



$result = sql_query($sql);



$colspan = 3;



?>





    <!-- 여기 아래부터 모든 HTML 요소 구성 시작 -->

    <style>
        .history_list { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

        .history_card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 2px 12px rgba(0,0,0,.07);
            overflow: hidden;
        }

        .history_card_head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px 12px;
            border-bottom: 1px solid #f0f0f0;
        }

        .history_badge_done {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 13px;
            font-weight: 700;
            color: #8259f5;
        }
        .history_badge_done::before {
            content: '';
            display: inline-block;
            width: 8px; height: 8px;
            border-radius: 50%;
            background: #8259f5;
        }

        .history_review_btn {
            font-size: 12px;
            color: #8259f5;
            background: #f3eeff;
            border-radius: 20px;
            padding: 4px 10px;
            font-weight: 600;
            white-space: nowrap;
        }
        .history_review_wait {
            font-size: 12px;
            color: #aaa;
            background: #f5f5f5;
            border-radius: 20px;
            padding: 4px 10px;
            font-weight: 500;
        }

        .history_card_body { padding: 14px 16px; }

        .history_info_grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 8px;
        }
        .history_info_item { display: flex; flex-direction: column; gap: 3px; }
        .history_info_item.full { grid-column: 1 / -1; }
        .history_info_item dt {
            font-size: 11px;
            color: #aaa;
            font-weight: 500;
        }
        .history_info_item dd {
            font-size: 13px;
            color: #333;
            font-weight: 500;
            word-break: break-all;
        }

        .history_card_foot {
            padding: 0 16px 16px;
        }
        .history_memo_btn {
            display: block;
            width: 100%;
            text-align: center;
            padding: 11px 0;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            background: #8259f5;
            color: #fff;
        }
        .history_view_btn {
            display: block;
            width: 100%;
            text-align: center;
            padding: 11px 0;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            background: #f3eeff;
            color: #8259f5;
        }

        .history_empty {
            text-align: center;
            padding: 60px 20px;
            color: #bbb;
            font-size: 14px;
        }
    </style>

    <div class="history_list">
        <?php
        for ($i=0; $row=sql_fetch_array($result); $i++) {

            $minfo = get_mbid($row["membid"]);

            $vsql = "select * from g5_write_c_history where wr_10='".$row["no"]."'";
            $vrow = sql_fetch($vsql);

            $asql = "select * from g5_write_review where wr_10='".$row["no"]."'";
            $arow = sql_fetch($asql);
        ?>
        <div class="history_card">
            <!-- 헤더 -->
            <div class="history_card_head">
                <span class="history_badge_done">상담 완료</span>
                <?php if(!$arow["wr_id"]){ ?>
                    <span class="history_review_wait">후기 작성 대기</span>
                <?php } else { ?>
                    <a href="/bbs/board.php?bo_table=review&wr_id=<?=$arow["wr_id"]?>">
                        <span class="history_review_btn">후기답변 달기 &rsaquo;</span>
                    </a>
                <?php } ?>
            </div>

            <!-- 본문 -->
            <div class="history_card_body">
                <dl class="history_info_grid">
                    <div class="history_info_item">
                        <dt>고객명</dt>
                        <dd><?=$minfo["mb_name"]?></dd>
                    </div>
                    <div class="history_info_item">
                        <dt>상담시작</dt>
                        <dd><?=$row["start"]?></dd>
                    </div>
                    <div class="history_info_item">
                        <dt>상담종료</dt>
                        <dd><?=$row["end"]?></dd>
                    </div>
                    <?php if($vrow["wr_id"]){ ?>
                    <div class="history_info_item">
                        <dt>상담분류</dt>
                        <dd><?=$vrow["wr_1"]?></dd>
                    </div>
                    <div class="history_info_item">
                        <dt>상담주제</dt>
                        <dd><?=$vrow["wr_2"]?></dd>
                    </div>
                    <div class="history_info_item full">
                        <dt>상담내용</dt>
                        <dd><?=$vrow["wr_content"]?></dd>
                    </div>
                    <?php } ?>
                </dl>
            </div>

            <!-- 버튼 -->
            <div class="history_card_foot">
                <?php if(!$vrow["wr_id"]){ ?>
                    <a class="history_memo_btn" href="/bbs/write.php?bo_table=c_history&no=<?=$row["no"]?>&md=conmy">고객상담 메모</a>
                <?php } else { ?>
                    <a class="history_view_btn" href="/bbs/write.php?bo_table=c_history&w=u&wr_id=<?=$vrow["wr_id"]?>&no=<?=$row["no"]?>&md=conmy">상담 내용 보기</a>
                <?php } ?>
            </div>
        </div>
        <?php
            $k++;
        }
        if ($i == 0)
            echo "<div class='history_empty'>상담 내역이 없습니다.</div>";
        ?>

        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>
    </div>
    <!-- 여기 아래부터 모든 HTML 요소 구성 끝 -->





<?php

include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');

?>