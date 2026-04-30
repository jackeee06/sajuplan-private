
<?php
include_once('./_common.php');
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
include_once(G5_LIB_PATH.'/counsel_flag.lib.php'); // ←20250909 추가

// 안전 이스케이프
if (!function_exists('sql_escape_string')) {
    function sql_escape_string($s){ return addslashes($s); }
}
// 클라이언트에서 오는 카테고리(없으면 전체)
$req_ca = isset($_POST['ca']) ? trim($_POST['ca']) : (isset($_GET['ca']) ? trim($_GET['ca']) : '');

// 숨김 카테고리 (전역 스위치 OFF면 ['심리'], ON이면 [])
$hidden = function_exists('cs_hidden_cats') ? cs_hidden_cats() : [];

// 공통 WHERE 구성
$where = [];
$where[] = "s.mb_id = '".sql_escape_string($member['mb_id'])."'";
$where[] = "s.bo_table = 'counselor'";     // 다른 보드 스크랩과 wr_id 충돌 방지
$where[] = "wr.wr_is_comment = 0";         // 부모글만

// 선택된 카테고리 요청이 있으면 적용
if ($req_ca !== '') {
    // 숨김 목록에 들어있는 카테고리는 eq 필터를 아예 추가하지 않음
    if (!(function_exists('cs_show_simli') && !cs_show_simli() && $req_ca === '심리')) {
        $where[] = "wr.ca_name = '".sql_escape_string($req_ca)."'";
    }
}

// 전역 스위치 OFF면 '심리' 등 숨김 카테고리 제외
if (!empty($hidden)) {
    $hidden_escaped = array_map('sql_escape_string', $hidden);
    $where[] = "wr.ca_name NOT IN ('".implode("','", $hidden_escaped)."')";
}
/*
  $sql_common = " from {$g5['scrap_table']} as s join g5_write_counselor as wr on s.wr_id= wr.wr_id
                join {$g5['member_table']} as m on (wr.mb_id = m.mb_id) where s.mb_id = '{$member['mb_id']}' ";*/
$sql_common = " from {$g5['scrap_table']} as s join g5_write_counselor as wr on s.wr_id= wr.wr_id
                join {$g5['member_table']} as m on (wr.mb_id = m.mb_id) where ".implode(' and ', $where);
$sql_order = " order by IF(m.state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE',''), s.ms_id desc ";
//20250726 eun 단골 정렬 수정 마갈

$sql = " select count(*) as cnt $sql_common ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$list = array();

$sql = " select *
            $sql_common
            $sql_order
            limit $from_record, $rows ";
$result = sql_query($sql);
//echo $sql;

for ($i=0; $row=sql_fetch_array($result); $i++) {

    $list[$i] = $row;

    // 순차적인 번호 (순번)
    $num = $total_count - ($page - 1) * $rows - $i;

    // 게시판 제목
    $sql2 = " select bo_subject from {$g5['board_table']} where bo_table = '{$row['bo_table']}' ";
    $row2 = sql_fetch($sql2);
    if (!$row2['bo_subject']) $row2['bo_subject'] = '[게시판 없음]';

    // 게시물 제목
    /*   $tmp_write_table = $g5['write_prefix'] . $row['bo_table'];


       $s_caname  = $_REQUEST["s_caname"];

       //$where = "";
       //if($s_caname){
           //$where .=" and ca_name='".$s_caname."'";
       //}

       $sql3 = " select * from $tmp_write_table where wr_id = '{$row['wr_id']}' {$where} ";

       //echo $sql3;


       $row3 = sql_fetch($sql3, FALSE);*/
    $row3 = $row; // wr.*가 이미 들어있음
    $subject = get_text(cut_str($row3['wr_subject'], 100));
    if (!$row3['wr_subject'])
        $row3['wr_subject'] = '[글 없음]';

    $list[$i]['num'] = $num;

    $list[$i]['mb_id'] = $row3["mb_id"];

    $list[$i]['ca_name'] = $row3["ca_name"];
    $list[$i]['wr_id'] = $row3["wr_id"];
    $list[$i]['subject'] = $row3["subject"];

    $list[$i]['wr_1'] = $row3["wr_1"];
    $list[$i]['wr_2'] = $row3["wr_2"];
    $list[$i]['wr_3'] = $row3["wr_3"];
    $list[$i]['wr_4'] = $row3["wr_4"];
    $list[$i]['wr_5'] = $row3["wr_5"];
    $list[$i]['wr_6'] = $row3["wr_6"];
    $list[$i]['wr_7'] = $row3["wr_7"];
    $list[$i]['wr_8'] = $row3["wr_8"];
    $list[$i]['wr_9'] = $row3["wr_9"];
    $list[$i]['wr_10'] = $row3["wr_10"];

    $list[$i]['num'] = $num;

    $list[$i]['opener_href'] = get_pretty_url($row['bo_table']);
    $list[$i]['opener_href_wr_id'] = get_pretty_url($row['bo_table'], $row['wr_id']);
    $list[$i]['bo_subject'] = $row2['bo_subject'];
    $list[$i]['subject'] = $subject;
    $list[$i]['del_href'] = './scrap_delete.php?ms_id='.$row['ms_id'].'&amp;page='.$page;
}


ob_start();?>
<ul id="" class="">
    <?php for ($i=0; $i<count($list); $i++) {
        $cinfo = get_member($list[$i]["mb_id"]);

        ?>

        <div class="counselor_list_wrap">
            <div class="counselor_list">
                <a href="<?php echo $list[$i]['del_href'];  ?>" onclick="del(this.href); return false;" class="scrap_del">
                    <i class="xi-close"></i><span class="sound_only">삭제</span></a>

                <!--20250728 eun 메인 상담사 수정 시작-->
                <div class="counselor_list_item" data-mb_id="<?=$list[$i]['mb_id']?>" data-state="<?=$list[$i]['state']?>">
                <!--20250728 eun 메인 상담사 수정 마감-->
                    <ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$i]['ca_name']]?>">
                        <span class="list_scrap" onclick="scrap_submit('<?=$list[$i]["wr_id"]?>')" style="cursor:pointer;">
                            <?
                            $sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $list[$i]["wr_id"]);
                            $scrap_img = "../../../img/common/list_icon_scrap.png";
                            if($sflag==true){
                                $scrap_img = "../../../img/common/list_icon_scrap_on.png";
                            }
                            ?>
                            <img src="<?=$scrap_img?>" id="scrap_icon_<?=$list[$i]["wr_id"]?>" alt="스크랩 아이콘">
                        </span>

                        <a href="<?php echo $list[$i]['opener_href_wr_id'] ?>" onclick="opener.document.location.href='<?php echo $list[$i]['opener_href_wr_id'] ?>'; return false;">
                            <?
                            $thumb = get_list_thumbnail('counselor', $list[$i]['wr_id'], '170', '116', false, true);
                            $bimg = "";
                            if($thumb['src']) {
                                $bimg = $thumb['src'];
                            } else {
                                $bimg = '../img/common/noimage.png';
                            }
                            ?>
                            <li class="counselor_img" style=" background-image:url(<?=$bimg?>);"></li>
                        </a>
                    </ul>

                    <ul class="counselor_con_wrap">
                        <div class="counselor_con_right">
                            <a href="<?php echo $list[$i]['opener_href_wr_id'] ?>" onclick="opener.document.location.href='<?php echo $list[$i]['opener_href_wr_id'] ?>'; return false;">
                                <li>
                                    <div class="top">
                                        <div class="counselor_con_title">
                                            <?php echo $list[$i]['subject'] ?>
                                            <!-- 상담사 고유번호 -->
                                            <?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>

                                            <i class="fa fa-star list_bottom_ic"></i>
                                            <span class="list_bottom_font"><?=get_dangol_cnt($list[$i]["wr_id"])?></span>

                                            <i class="fa fa-comment list_bottom_ic"></i>
                                            <span class="list_bottom_font"><?=get_counselor_afcnt($list[$i]["mb_id"])?></span>
                                        </div>
                                        <div class="counselor_con_text line2_text"><?php echo $list[$i]['wr_8'] ?></div>
                                    </div>
                                    <div class="counselor_con_price">
                                        <?=number_format($cinfo["mb_4"])?>원
                                        <span class="unit"><?=$cinfo["mb_5"]?>초당</span>
                                    </div>

                                    <div style="margin-top:2px;">
                                        <details class="counselor_list_info">
                                            <summary style="display:flex; justify-content:space-between; align-items:center;">
                                                <span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?=$list[$i]['ca_name']?></span>
                                                <a href="<?php echo $list[$i]['opener_href_wr_id'] ?>" onclick="opener.document.location.href='<?php echo $list[$i]['opener_href_wr_id'] ?>'; return false;">
                                                    <ul class="left">
                                                        <span class="tag"><?php echo $list[$i]['wr_9'] ?></span>,
                                                        <span class="tag"><?php echo $list[$i]['wr_10'] ?></span>
                                                    </ul>
                                                </a>
                                            </summary>

                                            <div class="counselor_review">
                                                <?
                                                //// 상담 후기 리스트 가져오기 ///
                                                $rsql = "select * from g5_write_review where wr_1='".$list[$i]["mb_id"]."' order by wr_datetime desc limit 0,3";
                                                $rst = sql_query($rsql);
                                                if($rst){
                                                    while($res=sql_fetch_array($rst)){
                                                        $minfo = get_member($res["mb_id"]);
                                                        ?>
                                                        <ul class="counselor_review_item">
                                                            <li class="counselor_review_con"><?=$res['wr_subject']?></li>
                                                            <li class="counselor_review_name point"><?=$minfo["mb_name"]?></li>
                                                        </ul>
                                                        <?
                                                    }
                                                }
                                                ?>
                                            </div>
                                        </details>
                                    </div>
                                </li>
                            </a>
                        </div>
                    </ul>
                </div>

                <?php
                 include(G5_PATH.'/include/counselor_board_state_btn.php'); 
                 ?>

            </div><!-- // counselor_list -->
        </div><!-- // counselor_list_wrap -->

    <?php } ?>
    <?php if ($i == 0) echo "<li class=\"empty_list\">단골상담사가 없습니다.</li>"; ?>
</ul>



<?php echo get_paging($config['cf_mobile_pages'], $page, $total_page, "?$qstr&amp;page="); ?>

<?php $html = ob_get_clean();
echo json_encode(['html' => $html]);
?>