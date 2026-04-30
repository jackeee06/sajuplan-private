<?php
$sub_menu = "350999";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');
###############################################################3

########################################################3

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Wish_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

#############################################################



$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';



$sql_common = " from g5_write_wish ";

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


if ($fr_date && $to_date) {
    $sql_search .= " and wr_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}



if (!$sst) {
    $sst  = "wr_datetime";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt
            {$sql_common}
            {$sql_search}
            {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select *
            {$sql_common}
            {$sql_search}
            {$sql_order}
            limit {$from_record}, {$rows} ";
$result = sql_query($sql);




$qstr1 = "sfl=$sfl&stx=$stx&fr_date=$fr_date&amp;to_date=$to_date";
$qstr = "$qstr1&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page";



?>




<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>

        <th scope="col">작성일</th>
        <th scope="col">아이디</th>
        <th scope="col">이름(작성자)</th>
		 <th scope="col">내용</th>
        <th scope="col">기도기간(일)</th>
        <th scope="col">진행상태(일)</th>
        <th scope="col">적립포인트</th>
    </tr>
    </thead>
    <tbody>


    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
       

		$minfo = get_member($row["mb_id"]);


		$end_day = $row["wr_subject"];
		if($end_day==""){
			$end_day = "1";
		}

		$wish_ing= $row["wr_1"];
		if($wish_ing==""){
			$wish_ing = "1";
		}

    ?>

    <tr >

        <td class="td_center"><?=substr($row["wr_datetime"],0,10)?></td>
        <td class="td_center"><?=$row["mb_id"]?></td>
        <td class="td_center"><?=$minfo["mb_name"]?></td>
		 <td class="td_center"><?=nl2br($row["wr_content"])?></td>
        <td class="td_center"><?=$end_day?>일</td>
        <td class="td_center sv_use"><?=$wish_ing?>일/<?=$end_day?>일</td>
        <td class="td_center sv_use"><?=$row["wr_2"]?$row["wr_2"]:'0'?></td>
       
    </tr>

    <?php
    }

    if ($i == 0)
        echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';
    ?>
    </tbody>
    </table>
</div>