<?php
$sub_menu = '350510';
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, "r");

// 등록일시 기간 필터 (YYYY-MM-DD)
$fr_date = (isset($_GET['fr_date']) && preg_match('/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/', $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match('/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/', $_GET['to_date'])) ? $_GET['to_date'] : '';

// 뒤집힌 경우 보정
if ($fr_date && $to_date && $fr_date > $to_date) {
    $tmp = $fr_date; $fr_date = $to_date; $to_date = $tmp;
}

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
if ($fr_date && $to_date) {
    $sql_search .= " 
    and 
     cp_datetime 
    between 
     '{$fr_date} 00:00:00' and '{$to_date} 23:59:59'";
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

$g5['title'] = '쿠폰관리';
include_once (G5_ADMIN_PATH.'/admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php'); // ← 추가
$colspan = 9;





$qstr1 = "sfl=$sfl&stx=$stx&fr_date=$fr_date&amp;to_date=$to_date";
$qstr = "$qstr1&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page";


?>
    <div class="local_ov">
        <span class="btn_ov01"><span class="ov_txt">전체 </span><span class="ov_num"> <?php echo number_format($total_count) ?> 개</span></span>
    </div>



    <div class="sch_text_date_wrap">

        <form name="fsearch" id="fsearch" class="local_sch01 local_sch" method="get">

            <div class="sch_text_date">

                <select name="sfl" title="검색대상">
                    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>회원아이디</option>
                    <option value="cp_subject"<?php echo get_selected($sfl, "cp_subject"); ?>>쿠폰이름</option>
                    <option value="cp_id"<?php echo get_selected($sfl, "cp_id"); ?>>쿠폰코드</option>
                </select>
                <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
                <input type="text" name="stx" value="<?php echo $stx ?>" id="stx"  class=" frm_input">
                <input type="submit" class="btn_submit" value="검색">
                <div class="sch_last" >
                    <strong STYLE="margin-left: 20px;">기간별검색</strong>
                    <input type="text" name="fr_date" value="<?php echo $fr_date; ?>" id="fr_date" class="frm_input" size="11" maxlength="10">
                    ~
                    <input type="text" name="to_date" value="<?php echo $to_date; ?>" id="to_date" class="frm_input" size="11" maxlength="10">
                    <input type="submit" class="btn_submit" value="검색">
                </div>

                <script>
                    $(function(){
                        $("#fr_date, #to_date").datepicker({
                            changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd",
                            showButtonPanel: true, yearRange: "c-99:c+99", maxDate: "+0d"
                        });
                    });
                </script>
            </div>
        </form>



        <a href="couponlist_excel.php?<?=$qstr?>"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>

    </div>

    <form name="fcouponlist" id="fcouponlist" method="post" action="./couponlist_delete.php" onsubmit="return fcouponlist_submit(this);">
        <input type="hidden" name="sst" value="<?php echo $sst; ?>">
        <input type="hidden" name="sod" value="<?php echo $sod; ?>">
        <input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
        <input type="hidden" name="stx" value="<?php echo $stx; ?>">
        <input type="hidden" name="page" value="<?php echo $page; ?>">
        <input type="hidden" name="token" value="">

        <div class="tbl_head01 tbl_wrap">
            <table>
                <caption><?php echo $g5['title']; ?></caption>
                <thead>
                <tr>
                    <th scope="col">
                        <label for="chkall" class="sound_only">쿠폰 전체</label>
                        <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
                    </th>
                    <th scope="col">등록일시</th>
                    <th scope="col">쿠폰종류</th>
                    <th scope="col">쿠폰코드</th>
                    <th scope="col">쿠폰이름</th>
                    <th scope="col">적용대상</th>
                    <th scope="col"><?php echo subject_sort_link('mb_id') ?>회원아이디</a></th>
                    <th scope="col"><?php echo subject_sort_link('cp_end') ?>사용기한</a></th>
                    <th scope="col">사용횟수</th>
                    <th scope="col">관리</th>
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
                        <td class="td_chk">
                            <input type="hidden" id="cp_id_<?php echo $i; ?>" name="cp_id[<?php echo $i; ?>]" value="<?php echo $row['cp_id']; ?>">
                            <input type="checkbox" id="chk_<?php echo $i; ?>" name="chk[]" value="<?php echo $i; ?>" title="내역선택">
                        </td>
                        <td><?=$row["cp_datetime"]?></td>
                        <td><?php echo $cp_method; ?></td>
                        <td><?php echo $row['cp_id']; ?></td>
                        <td class="td_left"><?php echo $row['cp_subject']; ?></td>
                        <td><?php echo $cp_target; ?></td>
                        <td class="td_name sv_use"><div><?php echo $row['mb_id']; ?></div></td>
                        <td class=""><?php echo substr($row['cp_start'], 2, 8); ?> ~ <?php echo substr($row['cp_end'], 2, 8); ?></td>
                        <td class=""><?php echo number_format($used_count); ?></td>
                        <td class="td_mng td_mng_s">
                            <a href="./couponform.php?w=u&amp;cp_id=<?php echo $row['cp_id']; ?>&amp;<?php echo $qstr; ?>" class="btn btn_03"><span class="sound_only"><?php echo $row['cp_id']; ?> </span>수정</a>
                        </td>
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
            <a href="./couponform.php" id="coupon_add" class="btn btn_01">쿠폰 추가</a>
        </div>

    </form>

<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, "{$_SERVER['SCRIPT_NAME']}?$qstr&amp;page="); ?>

    <script>
        function fcouponlist_submit(f)
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
include_once (G5_ADMIN_PATH.'/admin.tail.php');