<?php
$sub_menu = "350300";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '상담현황';
include_once('./admin.head.php');

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

$colspan = 16;
?>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총건수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>
    <!--
    <a href="?sst=mb_intercept_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01"> <span class="ov_txt">차단 </span><span class="ov_num"><?php echo number_format($intercept_count) ?>명</span></a>
    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" > <span class="ov_txt">탈퇴  </span><span class="ov_num"><?php echo number_format($leave_count) ?>명</span></a>
    
    <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>
    
	<a href="?sst=mb_intercept_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" > <span class="ov_txt02">상담사</span><span class="ov_num"><?php echo number_format($intercept_count) ?>명</span></a>
    
    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" > <span class="ov_txt02"> 일반</span><span class="ov_num"><?php echo number_format($leave_count) ?>명</span></a>
    -->
</div>

<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

<label for="sfl" class="sound_only">검색대상</label>
<select name="sfl" id="sfl">
    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>회원아이디</option>
    <option value="mb_nick"<?php echo get_selected($sfl, "mb_nick"); ?>>닉네임</option>
    <option value="mb_name"<?php echo get_selected($sfl, "mb_name"); ?>>이름</option>
    <option value="mb_level"<?php echo get_selected($sfl, "mb_level"); ?>>권한</option>
    <option value="mb_email"<?php echo get_selected($sfl, "mb_email"); ?>>E-MAIL</option>
    <option value="mb_tel"<?php echo get_selected($sfl, "mb_tel"); ?>>전화번호</option>
    <option value="mb_hp"<?php echo get_selected($sfl, "mb_hp"); ?>>휴대폰번호</option>
    <option value="mb_point"<?php echo get_selected($sfl, "mb_point"); ?>>포인트</option>
    <option value="mb_datetime"<?php echo get_selected($sfl, "mb_datetime"); ?>>가입일시</option>
    <option value="mb_ip"<?php echo get_selected($sfl, "mb_ip"); ?>>IP</option>
    <option value="mb_recommend"<?php echo get_selected($sfl, "mb_recommend"); ?>>추천인</option>
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
    <div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>
        <th scope="col" id="mb_list_chk" >번호</th>
        <th scope="col" id="mb_list_chk" >날짜</th>
        <th scope="col" id="mb_list_chk" >구분</th>
        <th scope="col" id="mb_list_chk" >사용자코드</th>
        <th scope="col" id="mb_list_id">회원정보<br />(닉네임/ID)</th>
        <th scope="col" id="mb_list_auth">상담사<Br />
        (닉네임/핸드폰)</th>
        <th scope="col" id="mb_list_grp">시작시간 / 종료시간</th>
        <th scope="col" id="mb_list_grp">이용시간</th>
        <th scope="col" id="mb_list_grp">과금 금액</th>
    </tr>
    </thead>
    <tbody>

	<?php
	/*
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        // 접근가능한 그룹수
        $sql2 = " select count(*) as cnt from {$g5['group_member_table']} where mb_id = '{$row['mb_id']}' ";
        $row2 = sql_fetch($sql2);
        $group = '';
        if ($row2['cnt'])
            $group = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'">'.$row2['cnt'].'</a>';

        if ($is_admin == 'group') {
            $s_mod = '';
        } else {
            //$s_mod = '<a href="./member_form.php?'.$qstr.'&amp;w=u&amp;mb_id='.$row['mb_id'].'" class="btn btn_03">등록하기</a>';
			$s_mod = '<a href="../bbs/write.php?w=u&bo_table=counselor&wr_id=21" target="_blank" class="btn btn_03">등록하기</a>';
        }
        $s_grp = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'" class="btn btn_02">그룹</a>';

        $leave_date = $row['mb_leave_date'] ? $row['mb_leave_date'] : date('Ymd', G5_SERVER_TIME);
        $intercept_date = $row['mb_intercept_date'] ? $row['mb_intercept_date'] : date('Ymd', G5_SERVER_TIME);

        $mb_nick = get_sideview($row['mb_id'], get_text($row['mb_nick']), $row['mb_email'], $row['mb_homepage']);

        $mb_id = $row['mb_id'];
        $leave_msg = '';
        $intercept_msg = '';
        $intercept_title = '';
        if ($row['mb_leave_date']) {
            $mb_id = $mb_id;
            $leave_msg = '<span class="mb_leave_msg">탈퇴함</span>';
        }
        else if ($row['mb_intercept_date']) {
            $mb_id = $mb_id;
            $intercept_msg = '<span class="mb_intercept_msg">차단됨</span>';
            $intercept_title = '차단해제';
        }
        if ($intercept_title == '')
            $intercept_title = '차단하기';

        $address = $row['mb_zip1'] ? print_address($row['mb_addr1'], $row['mb_addr2'], $row['mb_addr3'], $row['mb_addr_jibeon']) : '';

        $bg = 'bg'.($i%2);
	*/
    ?>

    <tr class="<?php echo $bg; ?>">
        <td class="td_num">3</td>
        <td class="td_datetime">2024-07-23 00:00:00</td>
        <td>070</td>
        <td>B0003188</td>
        <td >
            닉네임3<br />testtest3@gmail.com
        </td>
        <td>
        	김신점<br />
            010-0000-0000
        </td>
		
        <td>
        	2024-07-23 00:00:00<br />
            2024-07-23 00:00:00<br />
        </td>
        <td>0,000초</td>
        <td class="td_mng">00,000</td>
    </tr>
    
    <tr class="<?php echo $bg; ?>">
        <td class="td_num">2</td>
        <td class="td_datetime">2024-07-23 00:00:00</td>
        <td>060</td>
        <td>B0003190</td>
        <td>
            닉네임2<br />testtest2@gmail.com
        </td>
        <td>
        	홍사주<br />
            010-0000-0000
        </td>
		
        <td>
        	2024-07-23 00:00:00<br />
            2024-07-23 00:00:00<br />
        </td>
        <td>0,000초</td>
        <td class="td_mng">00,000</td>
    </tr>
    
    <tr class="<?php echo $bg; ?>">
        <td class="td_num">1</td>
        <td>2024-07-23 00:00:00</td>
        <td>채팅</td>
        <td>B0003205</td>
        <td>
            닉네임1<br />test1@gmail.com
        </td>
        <td>
        	이 심리<br />
            010-0000-0000
		</td>
		
        <td>
        	2024-07-23 00:00:00<br />
            2024-07-23 00:00:00<br />
        </td>
        <td>0,000초</td>
        <td class="td_mng">00,000</td>
    </tr>

    <?php
	/*
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
	*/
    ?>
    </tbody>
    </table>
</div>
</div>

<div class="btn_fixed_top">
    <input type="submit" name="act_button" value="선택수정" onclick="document.pressed=this.value" class="btn btn_02">
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
    <input type="submit" name="act_button" value="완전삭제" onclick="document.pressed=this.value" class="btn btn_02">
    <?php if ($is_admin == 'super') { ?>
    <a href="./member_form.php" id="member_add" class="btn btn_01">회원추가</a>
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

if(document.pressed == "완전삭제") {
    if(!confirm("선택한 자료를 정말 완전히 삭제하시겠습니까?\n\n삭제된 회원은 복구 불가능합니다.")) {
        return false;
    }
}


</script>

<?php
include_once ('./admin.tail.php');