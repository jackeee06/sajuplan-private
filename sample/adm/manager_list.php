<?php
$sub_menu = "350300";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');

$sql_common = " from {$g5['member_table']} ";

$sql_search = " where (1) ";
if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'mb_point' :
            $sql_search .= " ({$sfl} >= '{$stx}') ";
            break;
        case 'mb_level' :
            $sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        case 'mb_tel' :
        case 'mb_hp' :
            $sql_search .= " ({$sfl} like '%{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if ($is_admin != 'super')
    $sql_search .= " and mb_level <= '{$member['mb_level']}' ";

if (!$sst) {
    $sst = "mb_datetime";
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

// 탈퇴회원수
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_leave_date <> '' {$sql_order} ";
$row = sql_fetch($sql);
$leave_count = $row['cnt'];

// 차단회원수
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_intercept_date <> '' {$sql_order} ";
$row = sql_fetch($sql);
$intercept_count = $row['cnt'];

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '매니저관리';
include_once('./admin.head.php');

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

$colspan = 16;
?>

<style>
.td_left { text-align:left !important;}
.local_sch01 { width:100%; float:left;}
</style>


<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

<label for="sfl" class="sound_only">검색대상</label>
<select name="sfl" id="sfl">
    <option value="mb_name"<?php echo get_selected($sfl, "mb_name"); ?>>매니저 이름</option>
    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>매니저 아이디</option>
</select>
<label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" required class="required frm_input">
<input type="submit" class="btn_submit" value="검색">

</form>

<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get" style="border-top:1px solid #eee; padding-top:10px;">
<label for="sfl">연도</label>
<select name="sfl" id="sfl">
    <option value="2023">2023</option>
	<option value="2024">2024</option>
    <option value="2025">2025</option>
</select>

<span style="float:right; display:inline-block; line-height:30px;"><i class="xi-info" style="font-size:18px; vertical-align:-3px;"></i> 세차 건수를 선택하시면 상세내역을 확인할 수 있습니다.</span>
</form>



<form name="fmemberlist" id="fmemberlist" action="./member_list_update.php" onsubmit="return fmemberlist_submit(this);" method="post">
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
        <th scope="col">매니저</th>
        
        <th scope="col">1월</th>
        <th scope="col">2월</th>
        <th scope="col">3월</th>
        <th scope="col">4월</th>
        <th scope="col">5월</th>
        <th scope="col">6월</th>
        <th scope="col">7월</th>
        <th scope="col">8월</th>
        <th scope="col">9월</th>
        <th scope="col">10월</th>
        <th scope="col">11월</th>
        <th scope="col">12월</th>
    </tr>
    <tr>
    </tr>
    </thead>
    <tbody>

    <tr class="<?php echo $bg; ?>">
        <td class="td_left">김철수 (test03)</td>
        <td><a href="../adm/history_list.php" target="_blank">62</a></td>
        <td><a href="../adm/history_list.php" target="_blank">78</a></td>
        <td><a href="../adm/history_list.php" target="_blank">61</a></td>
        <td><a href="../adm/history_list.php" target="_blank">8</a></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    
    <tr class="<?php echo $bg; ?>">
        <td class="td_left">박영수 (test04)</td>
        <td><a href="../adm/history_list.php" target="_blank">65</a></td>
        <td><a href="../adm/history_list.php" target="_blank">112</a></td>
        <td><a href="../adm/history_list.php" target="_blank">70</a></td>
        <td><a href="../adm/history_list.php" target="_blank">23</a></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    
    <tr class="<?php echo $bg; ?>">
        <td class="td_left">홍길동 (test02)</td>
        <td><a href="../adm/history_list.php" target="_blank">52</a></td>
        <td><a href="../adm/history_list.php" target="_blank">78</a></td>
        <td><a href="../adm/history_list.php" target="_blank">65</a></td>
        <td><a href="../adm/history_list.php" target="_blank">16</a></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <!--
    <tr>
    	<td colspan="20" class="empty_table">자료가 없습니다.</td>
    </tr>
    -->
    </tbody>
    
    
    <tfoot>
    <tr class="tfoot">
        <th class="td_left">Total</th>
        <th>179</th>
        <th>268</th>
        <th>196</th>
        <th>47</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
        <th>-</th>
    </tr>
    </tfoot>
    
    </table>
</div>

<div class="btn_fixed_top">
</div>


</form>

<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

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
</script>

<?php
include_once ('./admin.tail.php');