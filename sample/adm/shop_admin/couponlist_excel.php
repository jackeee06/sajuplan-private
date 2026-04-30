<?php
$sub_menu = '350510';
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, "r");
############################################

########################################################3

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Coupon_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

#############################################################




$sql_common = " from {$g5['g5_shop_coupon_table']} ";

$sql_search = " where (1) ";
if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'mb_id' :
            $sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '%{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if (!$sst) {
    $sst  = "cp_no";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt
            {$sql_common}
            {$sql_search}
            {$sql_order} ";
$row = sql_fetch($sql);

$total_count = $row['cnt'];



$sql = " select *
            {$sql_common}
            {$sql_search}
            {$sql_order}";
$result = sql_query($sql);



?>

<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <thead>
    <tr>
		<th scope="col">등록일시</th>
        <th scope="col">쿠폰종류</th>
        <th scope="col">쿠폰코드</th>
        <th scope="col">쿠폰이름</th>
        <th scope="col">적용대상</th>
        <th scope="col">회원아이디</th>
        <th scope="col">사용기한</th>
        <th scope="col">사용회수</th>
    </tr>
    </thead>
    <tbody>
    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        switch($row['cp_method']) {
            case '0':
                $row3 = get_shop_item($row['cp_target'], true);
                $cp_method = '개별상품할인';
                $cp_target = get_text($row3['it_name']);
                break;
            case '1':
                $sql3 = " select ca_name from {$g5['g5_shop_category_table']} where ca_id = '{$row['cp_target']}' ";
                $row3 = sql_fetch($sql3);
                $cp_method = '카테고리할인';
                $cp_target = get_text($row3['ca_name']);
                break;
            case '2':
                $cp_method = '주문금액할인';
                $cp_target = '주문금액';
                break;
            case '3':
                $cp_method = '배송비할인';
                $cp_target = '배송비';
                break;
			 case '4':
                $cp_method = '포인트추가';
                $cp_target = '포인트';
                break;
        }

        $link1 = '<a href="./orderform.php?od_id='.$row['od_id'].'">';
        $link2 = '</a>';

        // 쿠폰사용회수
        $sql = " select count(*) as cnt from {$g5['g5_shop_coupon_log_table']} where cp_id = '{$row['cp_id']}' ";
        $tmp = sql_fetch($sql);
        $used_count = $tmp['cnt'];

        $bg = 'bg'.($i%2);
    ?>

    <tr class="<?php echo $bg; ?>">
		<td><?=$row["cp_datetime"]?></td>
        <td><?php echo $cp_method; ?></td>
        <td><?php echo $row['cp_id']; ?></td>
        <td class="td_left"><?php echo $row['cp_subject']; ?></td>
        <td><?php echo $cp_target; ?></td>
        <td class="td_name sv_use"><div><?php echo $row['mb_id']; ?></div></td>
        <td class=""><?php echo substr($row['cp_start'], 2, 8); ?> ~ <?php echo substr($row['cp_end'], 2, 8); ?></td>
        <td class=""><?php echo number_format($used_count); ?></td>
      
    </tr>

    <?php
    }

    if ($i == 0)
        echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';
    ?>
    </tbody>
    </table>
</div>
