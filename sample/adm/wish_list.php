<?php
$sub_menu = "350999";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');
###############################################################3



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

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$mb = array();
if ($sfl == 'mb_id' && $stx)
    $mb = get_member($stx);

$g5['title'] = '소원다락방';
include_once ('./admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
$colspan = 9;






$qstr1 = "sfl=$sfl&stx=$stx&fr_date=$fr_date&amp;to_date=$to_date";
$qstr = "$qstr1&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page";



?>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">전체 </span><span class="ov_num"> <?php echo number_format($total_count) ?> 건 </span></span>
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

<a href="wish_list_excel.php?<?=$qstr?>"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>

</div>





<form name="fpointlist" id="fpointlist" method="post" action="./wish_list_delete.php" onsubmit="return fpointlist_submit(this);">
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
        <th scope="col">
            <label for="chkall" class="sound_only">포인트 내역 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col">작성일</th>
        <th scope="col">아이디</th>
        <th scope="col">이름(작성자)</th>
		 <th scope="col">내용</th>
        <th scope="col">기도기간(일)</th>
        <th scope="col">진행상태(일)</th>
        <th scope="col">적립포인트</th>
        <th scope="col">확인</th>
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

    <tr class="<?php echo $bg; ?>">
        <td class="">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <input type="hidden" name="wr_id[<?php echo $i ?>]" value="<?php echo $row['wr_id'] ?>" id="wr_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo $row['wr_subject'] ?> 내역</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td class="td_center"><?=substr($row["wr_datetime"],0,10)?></td>
        <td class="td_center"><?=$row["mb_id"]?></td>
        <td class="td_center"><?=$minfo["mb_name"]?></td>
		 <td class="td_center"><?=nl2br($row["wr_content"])?></td>
        <td class="td_center"><?=$end_day?></td>
        <td class="td_center sv_use"><?=$wish_ing?>/<?=$end_day?></td>
        <td class="td_center sv_use"><?=$row["wr_2"]?$row["wr_2"]:'0'?></td>
        <td class="td_num td_pt"><a href="../bbs/board.php?bo_table=wish&wr_id=<?=$row["wr_id"]?>" target="_blank" class="btn btn_03">확인</a></td>
    </tr>

    <?php
    }

    if ($i == 0)
        echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';
    ?>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
</div>

</form>


<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, "{$_SERVER['SCRIPT_NAME']}?$qstr&amp;page="); ?>

<script>
function fpointlist_submit(f)
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
</script>

<?php
include_once ('./admin.tail.php');