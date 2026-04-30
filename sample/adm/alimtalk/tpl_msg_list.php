<?php
$sub_menu = '900060';
include_once('./_common.php');

auth_check($auth[$sub_menu], "r");

if(!sql_query(" DESCRIBE {$g5['wz_alimtalk_tplmsg_table']} ", false)) {
    sql_query(" CREATE TABLE IF NOT EXISTS `{$g5['wz_alimtalk_tplmsg_table']}` (
                    `at_id` int(11) NOT NULL AUTO_INCREMENT,
                    `at_tplcode` varchar(30) NOT NULL,
                    `at_subject` varchar(255) NOT NULL,
                    `at_msg` text NOT NULL,
                    `at_btn_name` varchar(255) NOT NULL,
                    `at_btn_url` varchar(255) NOT NULL,
                    PRIMARY KEY (`at_id`)
                )
                COMMENT='알림톡 템플릿'
                ENGINE=MyISAM  DEFAULT CHARSET=utf8;", true);

    sql_query(" INSERT INTO `{$g5['wz_alimtalk_tplmsg_table']}` (`at_id`, `at_tplcode`, `at_subject`, `at_msg`) VALUES
    (1, 'register_form_update', '회원가입 축하', '안녕하세요. #{이름}님\r\n".$config['cf_title']." 회원이 되신것을 진심으로 환영합니다.'),
    (2, 'orderformupdate', '제품주문', '#{이름}님 주문해주셔서 고맙습니다.\r\n#{주문번호}\r\n#{주문금액}원\r\n".$config['cf_title']."'),
    (4, 'order_payment_bank', '입금확인', '#{이름}님 입금 감사합니다.\r\n#{입금액}원\r\n주문번호:\r\n#{주문번호}\r\n".$config['cf_title']."'),
    (5, 'order_shipping', '배송안내', '#{이름}님 배송합니다.\r\n택배:#{택배회사}\r\n운송장번호:\r\n#{운송장번호}\r\n".$config['cf_title']."'),
    (6, 'orderbankinfo', '입금요청', '#{이름}님의 입금계좌입니다.\r\n#{입금액}\r\n#{입금계좌}\r\n".$config['cf_title']."');", true);

    $db_reload = true;
}

if(!sql_query(" DESCRIBE {$g5['wz_alimtalk_tplsel_table']} ", false)) {
    sql_query(" CREATE TABLE IF NOT EXISTS `{$g5['wz_alimtalk_tplsel_table']}` (
                    `as_id` int(11) NOT NULL AUTO_INCREMENT,
                    `at_id` int(11) NOT NULL,
                    `at_type` varchar(30) NOT NULL,
                    PRIMARY KEY (`as_id`),
                    KEY `at_id` (`at_id`)
                )
                COMMENT='알림톡 템플릿 선택'
                ENGINE=MyISAM  DEFAULT CHARSET=utf8;", true);
    
    sql_query(" INSERT INTO {$g5['wz_alimtalk_tplsel_table']} (`as_id`, `at_id`, `at_type`) VALUES
                (1, 1, '회원가입 축하'),
                (2, 2, '제품주문'),
                (3, 4, '입금확인'),
                (4, 5, '배송안내'),
                (10, 6, '입금요청'); ");
    
    $db_reload = true;
}

// 2017-08-22 추가
$query = "show columns from `{$g5['wz_alimtalk_tplmsg_table']}` like 'at_button1_name' ";
$res = sql_fetch($query);
if (empty($res)) {
    sql_query(" ALTER TABLE `{$g5['wz_alimtalk_tplmsg_table']}` 
                    ADD `at_button1_name` varchar(255) NOT NULL,
                    ADD `at_button1_type` varchar(255) NOT NULL,
                    ADD `at_button1_url_1` varchar(255) NOT NULL,
                    ADD `at_button1_url_2` varchar(255) NOT NULL,
                    ADD `at_button2_name` varchar(255) NOT NULL,
                    ADD `at_button2_type` varchar(255) NOT NULL,
                    ADD `at_button2_url_1` varchar(255) NOT NULL,
                    ADD `at_button2_url_2` varchar(255) NOT NULL,
                    ADD `at_button3_name` varchar(255) NOT NULL,
                    ADD `at_button3_type` varchar(255) NOT NULL,
                    ADD `at_button3_url_1` varchar(255) NOT NULL,
                    ADD `at_button3_url_2` varchar(255) NOT NULL,
                    ADD `at_button4_name` varchar(255) NOT NULL,
                    ADD `at_button4_type` varchar(255) NOT NULL,
                    ADD `at_button4_url_1` varchar(255) NOT NULL,
                    ADD `at_button4_url_2` varchar(255) NOT NULL,
                    ADD `at_button5_name` varchar(255) NOT NULL,
                    ADD `at_button5_type` varchar(255) NOT NULL,
                    ADD `at_button5_url_1` varchar(255) NOT NULL,
                    ADD `at_button5_url_2` varchar(255) NOT NULL
                    ; ", true);

    $db_reload = true;
}

// 2018-01-26 추가
sql_query("ALTER TABLE `{$g5['wz_alimtalk_tplmsg_table']}` CHANGE `at_tplcode` `at_tplcode` VARCHAR(30) NOT NULL ; ");
sql_query("ALTER TABLE `{$g5['wz_alimtalk_tplsel_table']}` CHANGE `at_type` `at_type` VARCHAR(30) NOT NULL ; ");

if ($db_reload) { 
    alert("DB를 갱신합니다.", './tpl_msg_list.php'); 
}

$sql_common = " from {$g5['wz_alimtalk_tplmsg_table']} ";

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
    $sst  = "at_id";
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

unset($arr_data);
$arr_data = array();
$sql = " select *
            {$sql_common}
            {$sql_search}
            {$sql_order}
            limit {$from_record}, {$rows} ";
$result = sql_query($sql);
while($row = sql_fetch_array($result)) { 
    $arr_data[] = $row;
}
$cnt_data = count($arr_data);

// 선택정보
unset($arr_sel);
$arr_sel = array();
$query = "select * from {$g5['wz_alimtalk_tplmsg_table']} order by at_id desc ";
$res = sql_query($query);
while($row = sql_fetch_array($res)) { 
    $arr_sel[] = $row;
}
$cnt_sel = count($arr_sel);

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '알림톡 템플릿 관리';
include_once (G5_ADMIN_PATH.'/admin.head.php');

$colspan = 6;
?>

<style>
.txt-at-type {color:blue}

.local_sch03 strong { width:180px;}
</style>

<div class="local_ov01 local_ov">
    <?php echo $listall; ?>
    <span class="btn_ov01"><span class="ov_txt">전체</span><span class="ov_num"> <?php echo number_format($total_count); ?>건</span></span>
</div>

<form name="fsearch" id="fsearch" class="local_sch01 local_sch" method="get">
<select name="sfl" title="검색대상">
    <option value="at_tplcode"<?php echo get_selected($_GET['sfl'], "at_tplcode"); ?>>템플릿코드</option>
    <option value="at_subject"<?php echo get_selected($_GET['sfl'], "at_subject"); ?>>템플릿명</option>
    <option value="at_msg"<?php echo get_selected($_GET['sfl'], "at_msg"); ?>>메시지내용</option>
</select>
<label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" required class="required frm_input">
<input type="submit" class="btn_submit" value="검색">
</form>




<form name="frmsel" id="frmsel" class="local_sch03 local_sch" method="post" action="tpl_msg_list_update.php">

<div>실제적용할 템플릿을 선택하고 적용하기 버튼을 클릭하시면 해당 템플릿으로 메시지가 발송됩니다.</div>

<div>
    <strong>회원가입 축하</strong>
    <select name="at_type1" id="at_type1" title="회원가입">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '회원가입 축하' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>
<div>
    <strong>회원정보찾기</strong>
    <select name="at_type2" id="at_type2" title="회원정보찾기">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '회원정보찾기' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>

<div>
    <strong>회원가입 인증</strong>
    <select name="at_type3" id="at_type3" title="회원가입 인증">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '회원가입 인증' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>


<div>
    <strong>상담사 접속 알림</strong>
    <select name="at_type4" id="at_type4" title="상담사 접속 알림">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '상담사 접속 알림' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>


<div>
    <strong>입금계좌 안내</strong>
    <select name="at_type5" id="at_type5" title="입금계좌 안내">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '입금계좌 안내' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>


<div>
    <strong>입금확인</strong>
    <select name="at_type6" id="at_type6" title="입금확인">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) { 
            for ($z = 0; $z < $cnt_sel; $z++) { 
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '입금확인' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>
<!--20250729 eun 알림톡 템플릿 작업 시작-->
<div>
    <strong>상담사 자동 부재중 전환</strong>
    <select name="at_type7" id="at_type7" title="상담사 자동 부재중 전환">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) {
            for ($z = 0; $z < $cnt_sel; $z++) {
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '상담사 자동 부재중 전환' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>


<div>
    <strong>채팅 상담방 개설</strong>
    <select name="at_type8" id="at_type8" title="채팅 상담방 개설">
        <option value="">--템플릿선택--</option>
        <?php
        if ($cnt_sel > 0) {
            for ($z = 0; $z < $cnt_sel; $z++) {
                $sql = "select at_id from {$g5['wz_alimtalk_tplsel_table']} where at_id = '{$arr_sel[$z]['at_id']}' and at_type = '채팅 상담방 개설' ";
                $row = sql_fetch($sql);
                echo '<option value="'.$arr_sel[$z]['at_id'].'" '.($row['at_id'] ? 'selected=selected' : '').'>'.$arr_sel[$z]['at_subject'].'('.$arr_sel[$z]['at_tplcode'].')'.'</option>';
            }
        }
        ?>
    </select>
</div>
    <!--20250729 eun 알림톡 템플릿 작업 마감-->


<div class="sch_last">
    <strong></strong>
    <input type="submit" class="btn_submit" value="적용하기">
</div>
</form>





<form name="frm" id="frm" method="post" action="./tpl_msg_list_delete.php" onsubmit="return frm_submit(this);">
<input type="hidden" name="sst" value="<?php echo $sst; ?>">
<input type="hidden" name="sod" value="<?php echo $sod; ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
<input type="hidden" name="stx" value="<?php echo $stx; ?>">
<input type="hidden" name="page" value="<?php echo $page; ?>">

<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col style="width:20px;"/>
        <col style="width:50px;"/>
        <col style="width:150px;"/>
        <col style="width:130px;"/>
        <col style="width:auto;"/>
        <col style="width:70px;"/>
    </colgroup>
    <thead>
    <tr>
        <th scope="col">
            <label for="chkall" class="sound_only">템플릿 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col">No.</th>
        <th scope="col">템플릿코드</th>
        <th scope="col">템플릿명</th>
        <th scope="col">메세지</th>
        <th scope="col">관리</th>
    </tr>
    </thead>
    <tbody>
    <?php
    if ($cnt_data > 0) { 
        for ($z = 0; $z < $cnt_data; $z++) { 

        // 템플릿선택정보
        $sql2 = " select group_concat(at_type) as at_type from {$g5['wz_alimtalk_tplsel_table']} where at_id = '".$arr_data[$z]['at_id']."' group by at_id ";
        $row2 = sql_fetch($sql2);
        $at_type = $row2['at_type'];
        
        $num = number_format($total_count - ($page - 1) * $rows - $z); 
        $bg = 'bg'.($z%2);
        ?>

        <tr class="<?php echo $bg; ?>">
            <td class="td_chk">
                <input type="hidden" id="at_id_<?php echo $z; ?>" name="at_id[<?php echo $z; ?>]" value="<?php echo $arr_data[$z]['at_id']; ?>">
                <input type="checkbox" id="chk_<?php echo $z; ?>" name="chk[]" value="<?php echo $z; ?>" title="내역선택">
            </td>
            <td class="td_alignc"><?php echo $num; ?></td>
            <td class="td_alignc"><?php echo $arr_data[$z]['at_tplcode'] . ($at_type ? '<br /><span class="txt-at-type">('.$at_type.')</span>' : ''); ?></td>
            <td class="td_alignc"><?php echo $arr_data[$z]['at_subject']; ?></td>
            <td class="td_addr"><?php echo conv_content($arr_data[$z]['at_msg'], ''); ?></td>
            <td class="td_mng td_mng_m">
                <a href="./tpl_msg_form.php?w=u&amp;at_id=<?php echo $arr_data[$z]['at_id']; ?>&amp;<?php echo $qstr; ?>" class="btn btn_03"><span class="sound_only"><?php echo $arr_data[$z]['at_id']; ?> </span>수정</a>
            </td>
        </tr>

        <?php
        }
    }

    if ($z == 0)
        echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';
    ?>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <a href="./tpl_msg_form.php" class="btn btn_01">템플릿 추가</a>
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn_02 btn">
</div>

</form>

<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, "{$_SERVER['SCRIPT_NAME']}?$qstr&amp;page="); ?>

<script>
function frm_submit(f)
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
?>