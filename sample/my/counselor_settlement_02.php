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

$nowday = date("Y-m",time())."-01 00:00:00";


$sql_common = " from g5_point_end ";

$sql_search = " where (1) and mb_id='".$member["mb_id"]."'";


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
//echo $sql;
//echo "<br>";
$result = sql_query($sql);

?>


<?php
include_once(G5_PATH.'/include/counselor_settlement_navi.php');
?>

<style>
#main_bn { width:100%; float:left;}
#main_bn img { margin-bottom:15px; margin-top:10px; border-radius:10px;}

.top_nav {
    margin-bottom: 20px;
}
.top_nav_02 {
    border-color: #8259f5 !important;
    color: #8259f5;
    font-weight: 600;
}
.top_nav a ul {
    font-size: 1.1em;
}

/* 상단 누적 코인 한줄 표기 */
.coin_summary_box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #8259f5, #6b3fe4);
    border-radius: 12px;
    padding: 16px 20px;
    margin: 30px 15px 10px;
    color: #fff;
    white-space: nowrap;
}
.coin_summary_box .coin_title {
    font-size: 13px;
    font-weight: 600;
    text-align: center;
}
.coin_summary_box .coin_value {
    font-size: 17px;
    font-weight: 700;
    text-align: center;
    margin-top: 2px;
}
.coin_summary_box .coin_divider {
    width: 1px;
    height: 36px;
    background: rgba(255,255,255,0.3);
    margin: 0 10px;
    flex-shrink: 0;
}
.coin_summary_box .coin_item {
    flex: 1;
    text-align: center;
}

/* 리스트 스타일 */
.list_wrap {
    padding: 0 15px 20px;
}
.list_wrap table {
    width: 100%;
    border-collapse: collapse;
}
.list_wrap thead th {
    padding: 12px 6px;
    font-size: 12px;
    font-weight: 700;
    color: #8259f5;
    background: #f3efff;
    border-bottom: 2px solid #8259f5;
    border-right: 1px solid #e0d8f5;
    text-align: center;
    white-space: nowrap;
}
.list_wrap thead th:last-child {
    border-right: none;
}
.list_wrap tbody td {
    padding: 12px 6px;
    font-size: 13px;
    color: #444;
    border-bottom: 1px solid #f0f0f0;
    border-right: 1px solid #f0f0f0;
    text-align: center;
    vertical-align: middle;
}
.list_wrap tbody td:last-child {
    border-right: none;
}
.list_wrap tbody tr:hover {
    background: #faf8ff;
}
.list_wrap tbody tr:last-child td {
    border-bottom: none;
}
.coin_amount {
    font-weight: 700;
    color: #8259f5;
    white-space: nowrap;
}
.coin_amount.minus {
    color: #e8426c;
}
.right { text-align: right; }
.no_data_row td {
    text-align: center;
    padding: 40px 0 !important;
    color: #bbb;
    font-size: 14px;
}
</style>

<!-- 상단 누적 코인 (한줄) -->
<div class="coin_summary_box">
    <div class="coin_item">
        <div class="coin_title">이번달 누적 코인</div>
    </div>
    <div class="coin_divider"></div>
    <div class="coin_item">
        <div class="coin_title">전달</div>
        <div class="coin_value"><?=number_format(get_con_total_account_befre($member["mb_id"]))?>원</div>
    </div>
    <div class="coin_divider"></div>
    <div class="coin_item">
        <div class="coin_title">이달</div>
        <div class="coin_value"><?=number_format(get_con_total_account($member["mb_id"]))?>원</div>
    </div>
</div>

<div class="con_section sub_section_100 c_coin_wrap">

    <div style="padding:0 15px;"><?php echo display_banner('상담사-코인내역', 'mainbanner.10.skin.php'); ?></div>

    <div class="list_wrap">
        <table border="0" cellpadding="0" cellspacing="0">
            <thead>
            <tr>
                <th scope="col">일자</th>
                <th scope="col">은행</th>
                <th scope="col">정산비전체</th>
                <th scope="col">부가세공제</th>
                <th scope="col">원천세공제</th>
                <th scope="col">회선비</th>
                <th scope="col">총정산금액</th>
            </tr>
            </thead>
            <tbody>
            <?php
            $minfo = get_member($member["mb_id"]);
            $ims = explode("|", $minfo["mb_8"]);
            $bank = $ims[0];
            $bname = $ims[1];
            $bacc = $ims[2];

            for ($i=0; $row=sql_fetch_array($result); $i++) {
                $price_val = (int)$row["price"];
                $amount_class = $price_val < 0 ? 'coin_amount minus' : 'coin_amount';
                $has_detail = ($row["month"] >= '2026-02' && $row["price_tot"] > 0);
            ?>
            <tr>
                <td><?= $row["month"] ?></td>
                <td><?= $bank ?></td>
                <td class="right"><?= $has_detail ? number_format($row["price_tot"]) : '-' ?></td>
                <td class="right"><?= $has_detail ? number_format($row["vat_amount"]) : '-' ?></td>
                <td class="right"><?= $has_detail ? number_format($row["withholding_tax"]) : '-' ?></td>
                <td class="right"><?= $has_detail ? number_format($row["reply_fee"]) : '-' ?></td>
                <td class="right">
                    <span class="<?= $amount_class ?>"><?= number_format($price_val) ?>원</span>
                </td>
            </tr>
            <?php } ?>

            <?php
            if ($i == 0) {
                echo "<tr class='no_data_row'><td colspan='7'>자료가 없습니다.</td></tr>";
            }
            ?>
            </tbody>
        </table>

        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>
    </div>

</div>



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
