<?php
$sub_menu = "350440";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';
$g5['title'] = '누적 매출';
include_once('./admin.head.php');
############################################################################################3

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


$colspan = 16;
?>

<style>
.anchor { margin-bottom:10px;}
.anchor li:nth-child(2) a {border: 1px solid #465bf0; background: #465bf0; color:#fff;}
</style>

<ul class="anchor">
    <li><a href="./revenue_list_day.php">일별</a></li>
    <li><a href="./revenue_list_month.php">월별</a></li>
</ul>


<style>
.anchor a { width:100px; text-align:center;}
</style>


<div style="display:flex; justify-content: space-between;">

<div style="display:flex; align-items: center;">

<form name="fvisit" id="fvisit" class="local_sch01 local_sch" method="get">
<div class="sch_last" style=" margin:0; ">
    <strong>기간별검색</strong>
    <select style="width:100px;">
    	<option>2024</option>
    	<option>2025</option>
    	<option>2026</option>
    	<option>2027</option>
    	<option>2028</option>
    	<option>2029</option>
    </select>
</div>
</form>


</div>

<a href="settlement_list.php?<?=$qstr?>"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>

</div>




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
        <th scope="col" id="mb_list_chk" rowspan="2">날짜</th>
        <th scope="col" id="mb_list_id" colspan="3">타로</th>
        <th scope="col" id="mb_list_id" colspan="3">신점</th>
        <th scope="col" id="mb_list_id" colspan="3">사주</th>
        <th scope="col" id="mb_list_id" colspan="3">심리</th>
        <th scope="col" id="mb_list_id" colspan="2">합계</th>
    </tr>
    <tr>
        <th scope="col" id="mb_list_id">건수</th>
        <th scope="col" id="">금액(원)</th>
        <th scope="col" id="">비율(%)</th>
        <th scope="col" id="mb_list_id">건수</th>
        <th scope="col" id="">금액(원)</th>
        <th scope="col" id="">비율(%)</th>
        <th scope="col" id="mb_list_id">건수</th>
        <th scope="col" id="">금액(원)</th>
        <th scope="col" id="">비율(%)</th>
        <th scope="col" id="mb_list_id">건수</th>
        <th scope="col" id="">금액(원)</th>
        <th scope="col" id="">비율(%)</th>
        <th scope="col" id="mb_list_auth">건수</th>
		<th scope="col" id="mb_list_grp">금액</th>
    </tr>
    </thead>
    <tbody>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-01</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-02</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-03</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-04</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-05</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-06</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-07</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-08</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-09</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-10</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-11</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="">2024-12</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">0,000</td>
        <td headers="mb_list_id" class="right">123,000</td>
        <td headers="mb_list_id" class="">10.5</td>
        
        <td headers="mb_list_id" class="right">00,000</td>
        <td headers="mb_list_id" class="right">123,00000</td>
    </tr>


    </tbody>
    </table>
</div>

<!--
<div class="btn_fixed_top">    
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
</div>
-->

</form>

<?php //echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

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