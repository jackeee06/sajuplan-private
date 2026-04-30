<?php
include_once("./_common.php"); // 메뉴별 공통파일
$g5['title'] = "인기상담사";
include_once(G5_THEME_MOBILE_PATH.'/head.php');
##############################################################


$sql_common = " from {$g5['member_table']} a left join g5_write_counselor b on(a.mb_id=b.mb_id) ";
//20250731 EUN RDVC 추가 시작
$sql_search = " where (1) and mb_level='5' and (a.state='CONN' or a.state='IDLE' or a.state='RDVC' or a.state='RDCH')";
//20250731 EUN RDVC 추가 마감


if($sca){
    $sql_search .=" and b.ca_name='".$sca."'";
}


if (!$sst) {
    $sst = "mb_datetime";
    $sod = "asc";
}



//상담사상태 IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비
//$sql_order = " order by FIELD(a.state, 'CONN', 'IDLE', 'ABSE') desc, wr_datetime desc ";
//20250730 EUN 인기 정렬 시작
//$sql_order = "order by {$sst} {$sod} ";
//$sql_order =" order by rand()";
//$sql_order =" order by if(state in ('IDLE','RDVC', 'CONN', 'ABSE'), 0, 1), FIELD (state, 'IDLE','RDVC', 'CONN', 'ABSE', 'RDCH','')";
//20251212 시작
$sql_order = "
  ORDER BY
    CASE
      WHEN a.state IN ('IDLE','RDVC','RDCH','CONN','CNCH') THEN 0  
      WHEN a.state = 'ABSE' THEN 1                                 
      ELSE 2                                                      
    END,
    FIELD(a.state, 'IDLE','RDVC','RDCH','CONN','CNCH','ABSE','')
";
//20250730 EUN 인기 정렬 시작


$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함



$sql = " select a.*, b.* {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";


//echo $sql;



$result = sql_query($sql);




?>

<div class="top_nav" style="">
    <a href="/hot/list.php?sca=타로"><ul <?if($sca=="타로"){?>class="on"<?}?>>타로</ul></a>
    <a href="/hot/list.php?sca=신점"><ul <?if($sca=="신점"){?>class="on"<?}?>>신점</ul></a>
    <a href="/hot/list.php?sca=사주"><ul <?if($sca=="사주"){?>class="on"<?}?>>사주</ul></a>
    <a href="/hot/list.php?sca=심리"><ul <?if($sca=="심리"){?>class="on"<?}?>>심리</ul></a>
</div>

<div class="con_section search_bar" style="display:none;" >
    <ul class="type_search">
        <input class="input" type="text" placeholder="선생님 닉네임"/>
        <i class="xi-search"></i>
    </ul>

    <details class="type_search">
        <summary>
            <ul class="input">
                <span>해시태그</span>
                <i class="xi-search"></i>
            </ul>
        </summary>
    </details>

    <ul class="type_btn">
        <img src="../img/common/icon_sort.png"/>
    </ul>
</div>



<div class="counselor_list_wrap" >




    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {

        /// 프로필테이블에서 관련정보를 가져온다 //
        $row1 = sql_fetch("select * from g5_write_counselor where mb_id='".$row["mb_id"]."'");
        /// 프로필테이블에서 관련정보 가져오기 끝//

        $thumb = get_list_thumbnail('counselor', $row1['wr_id'], '170', '116', false, true);

        $simg = "";
        if($thumb['src']) {
            $simg = $thumb['src'];
        } else {
            $simg = '../img/common/noimage.png';
        }



        ?>

        <div class="counselor_list">
            <div class="counselor_list_item">
                <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
                    <ul class="counselor_img_wrap type_bg <?=$cate_bg[$row1['ca_name']]?>">

				<span class="list_scrap" onclick="scrap_submit('<?=$row1["wr_id"]?>')" style="cursor:pointer;">
				<?
                $sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $row1["wr_id"]);
                //202507228 스크랩 icon 변경 시작
                $scrap_img = "/img/common/list_icon_scrap.png";
                if($sflag==true){
                    $scrap_img = "/img/common/list_icon_scrap_on.png";
                    //202507228 스크랩 icon 변경 마감
                }
                ?>
				<img src="<?=$scrap_img?>" id="scrap_icon_<?=$row1["wr_id"]?>">
			</span>




                        <span class="icon_cate <?=$cate_bg[$row1['ca_name']]?>"><?=$row1["ca_name"]?></span>
                        <li class="counselor_img" style=" background-image:url(<?=$simg?>);">
                        </li>
                    </ul>
                </a>

                <ul class="counselor_con_wrap">
                    <div class="counselor_con_right">
                        <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
                            <li>
                                <div class="top">
                                    <div class="counselor_con_title">
                                        <?=$row["mb_nick"]?>
                                        <!-- 상담사 고유번호 -->
                                        <?
                                        $cinfo = $row;
                                        ?>
                                        <?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>
                                    </div>
                                    <div class="counselor_con_text"><?php echo $row1['wr_8'] ?></div>
                                </div>
                                <div class="counselor_con_price">
                                    <?=number_format($cinfo["mb_4"])?>원<span class="unit">(<?=$cinfo["mb_5"]?>초)</span>
                                </div>
                            </li>
                        </a>

                        <!--상담상태 버튼 Wrap Start -->
                        <?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>
                        <!--상담상태 버튼 Wrap End -->
                    </div>
                </ul>
            </div>
            <details class="counselor_list_info">
                <summary>
                    <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
                        <ul class="left">
                            <span class="tag">#<?php echo $row1['wr_9'] ?></span>
                            <span class="tag">#<?php echo $row1['wr_10'] ?></span>
                        </ul>
                    </a>

                    <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
                        <ul class="right">
                            <li class="right_item">최근 후기(<?=get_counselor_afcnt($row["mb_id"])?>)</li>
                            <li class="right_item gray">|</li>
                            <li class="right_item">문의<span>(<?=get_counselor_qa_new($row["mb_id"])?>)</span></li>
                        </ul>
                    </a>

                </summary>
            </details>

        </div>

        <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>




    <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

</div>



<script type="text/javascript">
    function scrap_submit(wr_id) {
//var param = $("form[name=f_scrap_popin]").serialize();
        $.ajax({
            url: g5_bbs_url+"/scrap_popin_update.php",
            type: "POST",
            data: {bo_table:'counselor', wr_id:wr_id},
            success:function(data){
                //20250726 eun 인기 탭에서 스크랩하면 오류뜨는 것 작업 시작
                //alert("성공");
                location.href = g5_bbs_url + "/scrap.php";
                //20250726 eun 인기 탭에서 스크랩하면 오류뜨는 것 작업 마감

                console.log(data);
                var a_comment = /<noscript>(([\s\S]+?[\s\S]))<\/p>/.exec(data);
                if (a_comment != null)
                {
                    var content = String(a_comment[1].trim());
                    content = content.substring(3,content.length);
                    alert(content);

                    $('#scrap_icon_'+wr_id).attr("src","/img/common/list_icon_scrap_on.png");
                }
            },
            error:function(data){
                alert("error");
            }
        });
    }
</script>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
