<?php
ob_start();
$sub_menu = "350450";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');

while (ob_get_level()) { ob_end_clean(); }

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel; charset=utf-8');
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Settlement_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

echo "\xEF\xBB\xBF"; // BOM - 엑셀 한글 깨짐 방지


$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


$sql_common = " from g5_point_end ";

$sql_search = " where (1) ";

if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'kind' :
            $sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '%{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if ($fr_date && $to_date) {
    $fr_date1 = substr($fr_date, 0, 7);
    $to_date1 = substr($to_date, 0, 7);
    $sql_search .= " and month between '{$fr_date1}' and '{$to_date1}'";
}

if (!$sst) {
    $sst  = "wr_datetime";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

$sql = " select * {$sql_common} {$sql_search} {$sql_order}";
$result = sql_query($sql);

// CSV 헤더
echo '"아이디","이름","닉네임","해당월","무료R%","유료R%","무료정산비","유료정산비","정산비전체","부가세공제","원천세공제","회선비","총정산금액"' . "\n";

for ($i=0; $row=sql_fetch_array($result); $i++) {
    $minfo = get_member($row["mb_id"]);

    $cols = array(
        $row["mb_id"],
        $minfo["mb_name"],
        $minfo["mb_nick"],
        $row["month"],
        $minfo["mb_19"],
        $minfo["mb_20"],
        number_format($row["price_free"]),
        number_format($row["price_paid"]),
        number_format($row["price_tot"]),
        number_format($row["vat_amount"]),
        number_format($row["withholding_tax"]),
        number_format($row["reply_fee"]),
        number_format($row["price"])
    );

    $line = array();
    foreach($cols as $col){
        $line[] = '"' . str_replace('"', '""', $col ?? '') . '"';
    }
    echo implode(',', $line) . "\n";
}

exit;
