<?php
include_once('../common.php');
// 페이지 제목 
$g5['title'] = "코인내역";
include_once(G5_THEME_MOBILE_PATH.'/head.php');

#####################################################################


if(!$member["mb_id"]){
    alert('로그인 하셔야합니다', '/bbs/login.php');
    exit;
}

$md = $_REQUEST["md"];

$nowday = date("Y-m",time())."-01 00:00:00";

$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';



$sql_common = " from g5_point ";

$sql_search = " where (1) and mb_id='".$member["mb_id"]."' ";


if($md){
    $sql_search .= " and p_gubun='".$md."' ";
}




if ($fr_date && $to_date) {
    $sql_search .= " and po_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}




if (!$sst) {
    $sst = "po_datetime";
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

//echo $sql;
//echo "<br>";

$result = sql_query($sql);


$qstr .= "&md=".$md;

?>

<?php
include_once(G5_PATH.'/include/counselor_settlement_navi.php');
?>

<style>
    #main_bn { width:100%; float:left;}
    #main_bn img { margin-bottom:15px; margin-top:10px;}

    #main_bn img { border-radius:10px;}

    .top_nav_01 {
        border-color: #465bf0 !important;
        color: #465bf0;
        font-weight: 600;
    }


    .price_tap {width:100%; float:left; margin-bottom:10px; display:flex; justify-content: space-between; align-items: center; margin:10px 0 10px;}
    .price_tap .price_tap_item {width:calc(33% - 5px); padding:10px 20px; font-size:16px; border-radius:6px; text-align:center; background-color:#e9e9e9; color:#999;}
    .price_tap .price_tap_item.on { background-color:#465bf0; color:#fff; font-weight:600}

</style>

<div class="con_section" style="border-bottom:10px solid #f5f5f5;">


    <ul class="level_info">
        <p class="level_info_title_02">이번달 누적 코인</p>

        <li class="mem_state counselor settlement">
            <p class="mem_state_title">전달</p>
            <p class="mem_state_con"><?=number_format(get_con_total_account_befre($member["mb_id"]))?>원</p>
            <p class="mem_state_title">이달</p>
            <p class="mem_state_con"><?=number_format(get_con_total_account($member["mb_id"]))?>원</p>
        </li>
    </ul>

</div>

<div class="con_section sub_section_100 c_coin_wrap" >

    <div class="price_tap" >
        <ul class="price_tap_item <?if($md=="")echo "on";?>"><a href="?">전체></a></ul>
        <ul class="price_tap_item <?if($md=="Y")echo "on";?>"><a href="?md=Y">유료</a></ul>
        <ul class="price_tap_item <?if($md=="N")echo "on";?>"><a href="?md=N">무료</ul>
    </div>



    <form name="fsearch" method="get">
        <div class="price_tap" >
            <input type="date" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date" class="frm_input hasDatepicker" size="11" maxlength="10" style="width:calc(50% - 40px);">
            <label for="fr_date" class="sound_only">시작일</label>
            ~
            <input type="date" name="to_date" value="<?php echo $to_date ?>" id="to_date" class="frm_input hasDatepicker" size="11" maxlength="10" style="width:calc(50% - 40px);">
            <label for="to_date" class="sound_only">종료일</label>

            <input type="submit" value="검색" class="btn_submit black_bg" style="width:60px; height:40px; border-radius: 6px;">
        </div>
    </form>
    <div ><?php echo display_banner('상담사-코인내역', 'mainbanner.10.skin.php'); ?></div>


    <div class="list_wrap">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">

            <tr>
                <th scope="col">일자</th>
                <th scope="col">상담유형</th>
                <th scope="col">고객명</th>
                <th scope="col">구분</th>
                <th scope="col">획득코인</th>
            </tr>


            <?
            for ($i=0; $row=sql_fetch_array($result); $i++) {

                if($row["po_rel_id"]){
                    $minfo = get_member($row["po_rel_id"]);
                }

                /// 상담내역 가져오기 //
                $vsql = "select * from platform_consulting where no='".$row["c_no"]."'";
                $vrow = sql_fetch($vsql);



                ?>
                <tr>
                    <td scope="row"><?=$row["po_datetime"]?></td>
                    <td><?=$row["po_content"]?></td>
                    <td><?=$minfo["mb_name"]?></td>
                    <td>
                        <?
                        if($vrow["no"]){
                            if($vrow["preflag"]=="Y"){
                                echo "선불";}else{echo "후불";
                            }
                        }
                        ?>
                    </td>
                    <td class="right">
					<span class="plus f_600">
					<?
                    //if($row["p_end"]=="N"){
                    echo number_format($row["po_point"]);
                    //}else{
                    //echo "0";
                    //}
                    ?>원</span>
                    </td>
                </tr>

                <?php
                $k++;
            }
            if ($i == 0)
                echo "<div style='text-align:center;'>자료가 없습니다.</div>";
            ?>



        </table>

        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>


    </div>

</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
