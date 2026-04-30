<?php
$sub_menu = "350450";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';
$g5['title'] = '정산이력';
include_once('./admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
############################################################################################3

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
	$fr_date1 = "";
	$to_date1 = "";

	$fr_date1 = substr($fr_date,0,7);
	$to_date1 = substr($to_date,0,7);
    $sql_search .= " and month between '{$fr_date1}' and '{$to_date1}'";
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

// if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
//     echo $sql;
//     echo "<br>";
//     exit;
// }


$result = sql_query($sql);


$colspan = 16;






$qstr1 = "sfl=$sfl&stx=$stx&fr_date=$fr_date&amp;to_date=$to_date";
$qstr .= "$qstr1";


//echo $qstr;

?>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총건수</span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>
</div>



<div class="sch_text_date_wrap">

<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

<div class="sch_text_date">

<label for="sfl" class="sound_only">검색대상</label>
<select name="sfl" id="sfl">
    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>회원아이디</option>
</select>
<label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" class="frm_input">
<input type="submit" class="btn_submit" value="검색">


<div style=" display:inline-block; padding: 0 20px; font-weight:200; font-size:18px; "> |</div>

<div class="sch_last" style=" margin:0; ">
    <strong>기간별검색</strong>
    <input type="text" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date" class="frm_input" size="11" maxlength="10">
    <label for="fr_date" class="sound_only">시작일</label>
    ~
    <input type="text" name="to_date" value="<?php echo $to_date ?>" id="to_date" class="frm_input" size="11" maxlength="10">
    <label for="to_date" class="sound_only">종료일</label>
    <input type="submit" value="검색" class="btn_submit">
</div>
</div>
</form>



<script>
$(function(){
    $("#fr_date, #to_date").datepicker({ changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd", showButtonPanel: true, yearRange: "c-99:c+99", maxDate: "+0d" });
});
</script>


<div style=" display: flex; align-items: center;">

<!-- 월정산금액이 없으면 정산하지 않습니다. -->
<a href="#none;" onclick="pay_month();"><input type="button" class="btn btn_03" style=" width:95px; text-align:center;" value="월정산하기"></a>

<div style=" display:inline-block; padding: 0 10px; font-weight:100; font-size:18px; "><!--|--></div>

<a href="settlement_list_excel.php?<?=$qstr?>"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" width:95px; text-align:center;"></a>

</div>

</div>

<script>
function pay_month(){
	var cfm = confirm('월정산을 하시겠습니까?');
	if(cfm==true){
		var win = window.open("./pay_month.php", "PopupWin", "width=500,height=600");
	}
}
</script>


<form name="fmemberlist" id="fmemberlist" action="./settlement_list_delete.php" onsubmit="return fmemberlist_submit(this);" method="post">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="token" value="">

<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>
        <th scope="col" id="mb_list_chk" >
            <label for="chkall" class="sound_only">회원 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col" id="mb_list_id"><?php echo subject_sort_link('mb_id') ?>아이디</a></th>
        <th scope="col" id="">이름</th>
        <th scope="col" id="">닉네임</th>
        <th scope="col" id="mb_list_auth">해당월</th>
		<th scope="col">무료R%</th>
		<th scope="col">유료R%</th>
		<th scope="col">무료상담금액</th>
		<th scope="col">무료로열티</th>
		<th scope="col">유료상담금액</th>
		<th scope="col">유료로열티</th>
		<th scope="col">총매출</th>
		<th scope="col">부가세공제</th>
		<th scope="col">원천세공제</th>
		<th scope="col">회선비</th>
		<th scope="col">총정산금액</th>
    </tr>
    </thead>
    <tbody>

    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
      
		$minfo = get_member($row["mb_id"]);

        $bg = 'bg'.($i%2);

    ?>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="td_chk">
            <input type="hidden" name="no[<?php echo $i ?>]" value="<?php echo $row['no'] ?>" id="no_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"></label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td headers="mb_list_id" class="td_tel">
            <?php echo $row["mb_id"] ?>
        </td>
        <td headers="mb_list_id" class="td_tel">
            <?php echo $minfo["mb_name"] ?>
        </td>
        <td headers="mb_list_id" class="td_tel">
            <?php echo $minfo["mb_nick"] ?>
        </td>
		<td headers="mb_list_id" class="td_mng_l">
            <?php echo $row["month"] ?>
        </td>
		<td class="td_mng_l"><?php echo (int)$minfo['mb_19']; ?>%</td>
		<td class="td_mng_l"><?php echo (int)$minfo['mb_20']; ?>%</td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
		<td class="td_mng_l"></td>
      
    </tr>

    <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">    
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
</div>


</form>

<?php 
echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

<script>
function fmemberlist_submit(f)
{
    if (!is_checked("chk[]")) {
        alert(document.pressed+" 하실 항목을 하나 이상 선택하세요.");
        return false;
    }

    if(document.pressed == "선택삭제") {
        if(!confirm("선택한 자료를 정말 삭제하시겠습니까?")) {
            return false;
        }
    }

    return true;
}

if(document.pressed == "완전삭제") {
    if(!confirm("선택한 자료를 정말 완전히 삭제하시겠습니까?\n\n삭제된 회원은 복구 불가능합니다.")) {
        return false;
    }
}


</script>

<?php
include_once ('./admin.tail.php');