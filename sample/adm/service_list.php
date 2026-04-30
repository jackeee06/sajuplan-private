<?php
$sub_menu = "350100";
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

$g5['title'] = '정기세차신청';
include_once('./admin.head.php');

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

$colspan = 16;
?>

<style>
.tbl_head01 tbody tr:nth-child(even) { background:#fff;}

.td_left { text-align:left !important;}
</style>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건</span></span>
    <a href="?sst=mb_intercept_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01"> <span class="ov_txt"> 신청</span><span class="ov_num"><?php echo number_format($intercept_count) ?>건</span></a>
    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" > <span class="ov_txt"> 이용</span><span class="ov_num"><?php echo number_format($leave_count) ?>건</span></a>
    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" > <span class="ov_txt"> 종료</span><span class="ov_num"><?php echo number_format($leave_count) ?>건</span></a>
</div>

<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

<label for="sfl" class="sound_only">검색대상</label>
<select name="sfl" id="sfl">
    <option value="mb_name"<?php echo get_selected($sfl, "mb_name"); ?>>고객 이름</option>
    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>고객 아이디</option>
    <option value="mb_hp"<?php echo get_selected($sfl, "mb_hp"); ?>>고객 연락처</option>
    <option value="mb_name"<?php echo get_selected($sfl, "mb_name"); ?>>매니저 이름</option>
    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>매니저 아이디</option>
    <option value="mb_hp"<?php echo get_selected($sfl, "mb_hp"); ?>>매니저 연락처</option>
    <option value="mb_tel"<?php echo get_selected($sfl, "mb_tel"); ?>>차종</option>
    <option value="mb_tel"<?php echo get_selected($sfl, "mb_tel"); ?>>차 번호</option>
</select>
<label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" required class="required frm_input">
<input type="submit" class="btn_submit" value="검색">

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
        <th scope="col" id="mb_list_chk" rowspan="2" >
            <label for="chkall" class="sound_only">회원 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col" rowspan="2" id="mb_list_cert">신청날짜</th>
        <th scope="col" id="mb_list_id">구분</th>
        <th scope="col" id="mb_list_id">차종</th>
        <th scope="col" id="mb_list_cert">서비스</th>
        <th scope="col" rowspan="2" id="mb_list_cert">고객(ID)<br />연락처</th>
        <th scope="col" rowspan="2" id="mb_list_cert">상황</th>
        <th scope="col" rowspan="2" id="mb_list_cert">매니저(ID)<br />연락처</th>
        <th scope="col" rowspan="2" id="mb_list_cert" style="width:160px;">관리</th>
    </tr>
    <tr>
        <th scope="col" id="mb_list_name">번호</th>
        <th scope="col" id="mb_list_nick">컬러</th>
        <th scope="col">월 비용(원)</th>
    </tr>
    </thead>
    <tbody>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="td_chk" rowspan="2">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
            2023-03-26
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            SUV·RV
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            티구안
        </td>
        <td headers="mb_list_cert"  class="td_mbcert">
        	프리미엄 (월 8회)
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
        	홍길동(test)
            <Br />
            010-1234-5678
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert"><span class="state_rec">신청</span></td>
        <td headers="mb_list_cert"  rowspan="2"  class="td_mbcert">-</td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert td_left">
        	<a onclick="window.open('/bbs/board.php?bo_table=service&wr_id=4', '상세정보', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_03">상세정보</a>
            <a onclick="window.open('/bbs/board.php?bo_table=history', 'window_name', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_02">세차내역</a>
        </td>
    </tr>
    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_name" class="td_mbname02">1234</td>
        <td headers="mb_list_nick" class="td_name02 sv_use">실버</td>
        <td headers="mb_list_nick">-</td>
    </tr>
    
        <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="td_chk" rowspan="2">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
            2023-03-26
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            중형차
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            K5
        </td>
        <td headers="mb_list_cert" class="td_mbcert">
        	베이직 (월 4회)
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
        	이현우(test03)
            <Br />
            010-8520-8500
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert"><span class="state_ing">이용</span></td>
        <td headers="mb_list_cert"  rowspan="2"  class="td_mbcert">김철수(test02)<br />010-2222-3333</td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert td_left">
        	<a onclick="window.open('/bbs/board.php?bo_table=service&wr_id=4', '상세정보', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_03">상세정보</a>
            <a onclick="window.open('/bbs/board.php?bo_table=history', 'window_name', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_02">세차내역</a>
        </td>
    </tr>
    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_name" class="td_mbname02">6363</td>
        <td headers="mb_list_nick" class="td_name02 sv_use">실버</td>
        <td headers="mb_list_nick">50,000</td>
    </tr>
    
        <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="td_chk" rowspan="2">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
            2023-03-26
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            소형차
        </td>
        <td headers="mb_list_id" class="td_name02 sv_use">
            모닝
        </td>
        <td headers="mb_list_cert" class="td_mbcert">
        	라이트 (월 2회)
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert">
        	홍길동(test)
            <Br />
            010-1234-5678
        </td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert"><span class="state_end">종료</span></td>
        <td headers="mb_list_cert"  rowspan="2"  class="td_mbcert">박민수(test04)<br />010-8888-9999</td>
        <td headers="mb_list_cert"  rowspan="2" class="td_mbcert td_left">
        	<a onclick="window.open('/bbs/board.php?bo_table=service&wr_id=4', '상세정보', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_03">상세정보</a>
            <a onclick="window.open('/bbs/board.php?bo_table=history', 'window_name', 'width=530, height=800, top=50, left=100,  location=no, status=no, scrollbars=yes');" class="btn btn_02">세차내역</a>
        </td>
    </tr>
    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_name" class="td_mbname02">1255</td>
        <td headers="mb_list_nick" class="td_name02 sv_use">실버</td>
        <td headers="mb_list_nick">30,000</td>
    </tr>

    <tr>
    	<td colspan="20" class="empty_table">자료가 없습니다.</td>
    </tr>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <!--<input type="submit" name="act_button" value="선택수정" onclick="document.pressed=this.value" class="btn btn_02">-->
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
    <?php if ($is_admin == 'super') { ?>
    <a href="./service_form.php" id="member_add" class="btn btn_01">정기세차 추가</a>
    <?php } ?>

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