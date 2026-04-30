<?php
include_once('../common.php');
// 페이지 제목
$g5['title'] = "상담내역";
include_once(G5_THEME_MOBILE_PATH.'/head.php');
##############################################################


if(!$member["mb_id"]){
    alert('로그인하셔야합니다.','/bbs/login.php?url='.$_SERVER["REQREST_URI"]);
}

$cnum = $member["mb_1"];

$sql_common = " from platform_consulting ";

$sql_search = " where (1) and membid='".$cnum."' and (reason='DISCONNECT' or reason='END_CHAT') ";


if (!$sst) {
    $sst = "wr_datetime";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
///echo $sql;
$result = sql_query($sql);


?>


<div class=" con_section_b_bot">


    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {

        $cinfo= get_csrid($row["csrid"]);
        /// 만약 상담사 정보있으면 상담사 프로필 가져오기
        if($cinfo["mb_id"]){
            $sql = "select * from g5_write_counselor where mb_id='".$cinfo["mb_id"]."'";
            $crow = sql_fetch($sql);
        }
        $minfo= get_mbid($row["membid"]);
        $img = get_con_img($cinfo["mb_id"], '70', '70');



        ?>

        <div class="history_wrap">
            <div class="history_date"><?=$row["wr_datetime"]?></div>
            <div class="history_con">
                <div class="history_img" style="background-image:url(<?=$img?>);"></div>
                <div class="history_info_wrap">
                    <ul class="history_info">
                        <li class="history_info_01"><span><?=$crow["ca_name"]?>상담</span></li>
                        <li class="history_info_02">
                            <?=$cinfo["mb_nick"]?>
                            <!-- 상담사 고유번호 -->
                            <?php include(G5_PATH.'/include/counselor_num.php'); ?>
                        </li>
                        <li class="history_info_03"><?=$crow["ca_name"]?>상담 <span class="f_600"><?echo gmdate("H:i:s", $row["usetm"]);?></span></li>
                        <li class="history_info_03">시작시간 : <span class="f_600"><?= $row['start'] ?></span></li>
                        <li class="history_info_03">완료시간 : <span class="f_600"><?= !empty($row['end'])
                                    ? $row['end'] : $row['end'] ?></span></li>
                    </ul>
                    <ul class="history_btn_wrap">
                        <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>" class="history_btn">다시상담하기</a>
                    </ul>
                </div>
            </div>
            <div class="history_pay">
                <ul class="history_pay_wrap">
                    <li class="history_pay_name"><img src="../img/common/icon_coin.png" />사용코인</li>
                    <li class="history_pay_price"><span class="f_800"><?=number_format($row["amt"])?></span>코인</li>
                </ul>

                <?
                $wr_id = "";
                $wr_id = get_is_review($row["no"]);
                if(!$wr_id){
                    ?>
                    <ul class="history_btn_wrap"><a href="../bbs/write.php?bo_table=review&csr_id=<?=$cinfo["mb_id"]?>&cno=<?=$row["no"]?>" class="history_btn review_ok">후기 작성하기 <i class="xi-angle-right"></i></a></ul>
                    <?
                }else{
                    ?>
                    <ul class="history_btn_wrap"><a href="../bbs/board.php?bo_table=review&wr_id=<?=$wr_id?>" class="history_btn review_no">후기 보러가기<i class="xi-angle-right"></i></a></ul>
                <?}?>
            </div>
        </div>


        <?php
    }
    if ($i == 0)
        echo "<div class='con_section empty_table'>전화상담내용이 없습니다.</div>";
    ?>

    <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
