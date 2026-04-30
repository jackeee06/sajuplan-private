<?php
$sub_menu = "350120";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');


$sql_common = " from {$g5['member_table']} ";

$sql_search = " where (1) and mb_level = '5'  ";
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



$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '상담사 리스트';
include_once('./admin.head.php');

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";

//echo $sql;


$result = sql_query($sql);

$colspan = 16;
?>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총건수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>
    
    <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>
    
    <span class="btn_ov01"><span class="ov_txt02">이벤트1 </span><span class="ov_num"> <?php echo number_format($total_count) ?>명 </span></span>
    <span class="btn_ov01"><span class="ov_txt02">이벤트2 </span><span class="ov_num"> <?php echo number_format($total_count) ?>명 </span></span>
    <span class="btn_ov01"><span class="ov_txt02">이벤트3 </span><span class="ov_num"> <?php echo number_format($total_count) ?>명 </span></span>
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

<form name="fmemberlist" id="fmemberlist" action="./counselor_list_update.php" onsubmit="return fmemberlist_submit(this);" method="post">
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
        <th scope="col" id="mb_list_chk" >가입일</th>
        <th scope="col" id="mb_list_chk" >상담유형</th>
        <th scope="col" id="mb_list_id">이름/ID</th>
        <th scope="col" id="mb_list_auth">닉네임</th>
		<th scope="col" id="mb_list_grp">상담사번호</th>

        <th scope="col" id="mb_list_grp">상태</th>
        <th scope="col" id="mb_list_grp">상담상태</th>
        <th scope="col" id="mb_list_grp">누적상담수</th>
        <th scope="col" id="mb_list_grp">AI추천</th>
        <th scope="col" id="mb_list_grp">이벤트</th>
        <th scope="col" id="mb_list_mng">관리</th>
    </tr>
    </thead>
    <tbody>

	<?php

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
	
    ?>

    <tr class="<?php echo $bg; ?>">
        <td class="td_num">
			<?=$row["mb_no"]?>
			<input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
          
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">

		</td>
        <td class="td_datetime"><?=$row["mb_datetime"]?></td>
        <td>타로</td>
        <td headers="mb_list_id">
		<?php echo get_text($row['mb_name']); ?> / <?php echo $mb_id ?>
        </td>
        <td headers="mb_list_id">
            <?php echo get_text($row['mb_nick']); ?>
        </td>
		<td headers="mb_list_grp" class="td_mng"><?=$row["mb_no"]?></td>
       
        <td headers="mb_list_auth">
            <?php
            if ($leave_msg || $intercept_msg) echo $leave_msg.' '.$intercept_msg;
            else echo "정상";
            ?>
        </td>
        <td headers="mb_list_grp" class="td_mng">
			<?
			//IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비
				echo $s_state[$row["state"]] ;
			?>
		</td>
        <td headers="mb_list_grp" class="td_mng"><?=get_counselor_counter_all($row["mb_id"])?></td>
        <td headers="mb_list_grp">
        	<label for="ev_4">
            	<input id="ev_4" type="checkbox" name="ev_4[<?php echo $i ?>]" value="Y" <?if($row["ev_4"]=="Y"){echo "checked";}?>/>
            </label>
        </td>
        <td headers="mb_list_grp">
        	<label for="event1">
            	<input id="event1" type="checkbox" name="ev_1[<?php echo $i ?>]" value="Y" <?if($row["ev_1"]=="Y"){echo "checked";}?>/>
                <span>1</span>
            </label>
        	<label for="event2" style="display:inline-block; margin-left:10px;">
            	<input id="event2" type="checkbox" name="ev_2[<?php echo $i ?>]" value="Y" <?if($row["ev_2"]=="Y"){echo "checked";}?>/>
                <span>2</span>
            </label>
        	<label for="event3" style="display:inline-block; margin-left:10px;">
            	<input id="event3" type="checkbox" name="ev_3[<?php echo $i ?>]" value="Y" <?if($row["ev_3"]=="Y"){echo "checked";}?>/>
                <span>3</span>
            </label>
        </td>

        <td headers="mb_list_mng" class="td_mng td_mng_m">
		<?
		/// 해당 프로필이있는지 확인
		$sql1 = "select * from g5_write_counselor where mb_id='".$row["mb_id"]."'";
		//echo $sql1;
		//echo "<br>";
		$mrow=sql_fetch($sql1);
		$purl = "";
		$w = "";
		if($mrow["wr_id"]){
			$purl = "&wr_id=".$mrow["wr_id"]."&tmb_id=".$row["mb_id"];
			$w= "u";
		}else{
			$purl = "&tmb_id=".$row["mb_id"];
			$w = "";
		}

		?>
			<a href="./member_form.php?sst=&sod=&sfl=&stx=&page=&w=u&mb_id=<?=$row["mb_id"]?>"  target="_blank" class="btn btn_03">상담사 정보</a>			
		</td>
    </tr>




    <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>
    </tbody>
    </table>
</div>
</div>

<div class="btn_fixed_top">
    <?php if ($is_admin == 'super') { ?>
    <input type="submit" name="act_button" value="일괄저장" onclick="document.pressed=this.value" class="btn btn_02">
    <?php } ?>    
</div>


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
    return true;

}


</script>

<?php
include_once ('./admin.tail.php');