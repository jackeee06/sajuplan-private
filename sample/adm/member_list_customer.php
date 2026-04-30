<?php
$sub_menu = "350110";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');


$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


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


if ($fr_date && $to_date) {
    $sql_search .= " and mb_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}

if($mb_status=="1"){
	$sql_search .=" and mb_intercept_date <> ''";
}

if($mb_status=="2"){
	$sql_search .=" and mb_leave_date <> ''";
}

if (!$sst) {
    $sst = "mb_datetime";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

//echo $sql;
//exit;

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


// 상담사
$sql = " select count(*) as cnt {$sql_common} where mb_level='5' ";
$row = sql_fetch($sql);
$c_count = $row['cnt'];


//일반
$sql = " select count(*) as cnt {$sql_common} where mb_level ='2' ";
$row = sql_fetch($sql);
$j_count = $row['cnt'];



$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '고객리스트';
include_once('./admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

$colspan = 16;


$qstr = $qstr."&mb_status=".$mb_status."&fr_date=".$fr_date."&to_date=".$to_date;

?>

<style>
.gray_bg { background-color:#FC0 !important;}
</style>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총회원수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>명 </span></span>
    <a href="?mb_status=1" class="btn_ov01" data-tooltip-text="차단된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">차단 </span><span class="ov_num"><?php echo number_format($intercept_count) ?>명</span></a>
    <a href="?mb_status=2" class="btn_ov01" data-tooltip-text="탈퇴된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">탈퇴  </span><span class="ov_num"><?php echo number_format($leave_count) ?>명</span></a>
    
    <!--
    <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>
    
	<a href="?sst=&amp;sod=desc&amp;sfl=mb_level&amp;stx=5" class="btn_ov01" data-tooltip-text="상담사만 나열합니다."> <span class="ov_txt02">상담사</span><span class="ov_num"><?php echo number_format($c_count) ?>명</span></a>
    
    <a href="?sst=&amp;sod=desc&amp;sfl=mb_level&amp;stx=2" class="btn_ov01"  data-tooltip-text="탈퇴된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt02"> 일반</span><span class="ov_num"><?php echo number_format($j_count) ?>명</span></a>
    -->
</div>


<div class="sch_text_date_wrap">

<form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

<div class="sch_text_date">
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

<a href="#none;" onclick="window.open('member_list_customer_excel.php?<?=$qstr?>')"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>

</div>



<div class="local_desc01 local_desc">
    <p>
        회원자료 삭제 시 다른 회원이 기존 회원아이디를 사용하지 못하도록 회원아이디, 이름, 닉네임은 삭제하지 않고 영구 보관합니다.
    </p>
</div>


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
        <th scope="col" id="mb_list_chk" >
            <label for="chkall" class="sound_only">회원 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col" id="mb_list_join"><?php echo subject_sort_link('mb_datetime', '', 'desc') ?>가입일시</a></th>
        <th scope="col" id="mb_list_id"><?php echo subject_sort_link('mb_id') ?>아이디</a></th>
        <th scope="col" id="mb_list_name"><?php echo subject_sort_link('mb_name') ?>이름</a></th>
        <!--<th scope="col" id="mb_list_nick"><?php echo subject_sort_link('mb_nick') ?>닉네임</a></th>-->
        <th scope="col" id=""><?php echo subject_sort_link('mb_hp') ?>휴대폰</a></th>
        <th scope="col" id="mb_list_deny"><?php echo subject_sort_link('mb_level', '', 'desc') ?>권한</a></th>
		<th scope="col" id="mb_no"><?php echo subject_sort_link('mb_no', '', 'desc') ?>번호</a></th>
        <th scope="col" id="mb_list_point"><?php echo subject_sort_link('mb_point', '', 'desc') ?> 포인트</a></th>
        <th scope="col" class=""><?php echo subject_sort_link('mb_10', '', 'desc') ?> 성별</th>
        <th scope="col" class="">연령</th>
        <th scope="col" class="">결제건수</th>
        <th scope="col" class="">선불상담</th>
        <th scope="col" class="">후불상담</th>
        <th scope="col" class="">쿠폰다운</th>
        <th scope="col" class="">가입경과일</th>
        <th scope="col" class=""><?php echo subject_sort_link('org_source', '', 'desc') ?>가입출처</th>
        <th scope="col" id="mb_list_lastcall"><?php echo subject_sort_link('mb_today_login', '', 'desc') ?>최근접속일</a></th>
        
        <!--<th scope="col" id="mb_list_sms"><?php echo subject_sort_link('mb_sms', '', 'desc') ?>SMS수신</a></th>
        <th scope="col" id="mb_list_auth">이메일수신</th>
        <th scope="col" id="mb_list_open"><?php echo subject_sort_link('mb_open', '', 'desc') ?>공개</a></th
        <th scope="col" id="mb_list_auth"><?php echo subject_sort_link('mb_intercept_date', '', 'desc') ?>차단</a></th>-->
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
            $s_mod = '<a href="./member_form.php?'.$qstr.'&amp;w=u&amp;mb_id='.$row['mb_id'].'" class="btn btn_03">수정</a>';
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

        switch($row['mb_certify']) {
            case 'hp':
                $mb_certify_case = '휴대폰';
                $mb_certify_val = 'hp';
                break;
            case 'ipin':
                $mb_certify_case = '아이핀';
                $mb_certify_val = '';
                break;
            case 'simple':
                $mb_certify_case = '간편인증';
                $mb_certify_val = '';
                break;
            case 'admin':
                $mb_certify_case = '관리자';
                $mb_certify_val = 'admin';
                break;
            default:
                $mb_certify_case = '&nbsp;';
                $mb_certify_val = 'admin';
                break;
        }
    ?>

    <tr class="<?php echo $bg; ?>">
        <td headers="mb_list_chk" class="td_chk">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td headers="mb_list_join" class=""><?php echo substr($row['mb_datetime'],2,18); ?></td>
        <td headers="mb_list_id" class="">
            <?php echo $mb_id ?>
            <?php
            //소셜계정이 있다면
            $social_displayed = false;
            if(function_exists('social_login_link_account')){
                if( $my_social_accounts = social_login_link_account($row['mb_id'], false, 'get_data') ){
                    
                    echo '<div class="member_social_provider sns-wrap-over sns-wrap-32">';
                    foreach( (array) $my_social_accounts as $account){     //반복문
                        if( empty($account) || empty($account['provider']) ) continue;
                        
                        $provider = strtolower($account['provider']);
                        $provider_name = social_get_provider_service_name($provider);
                        
                        echo '<span class="sns-icon sns-'.$provider.'" title="'.$provider_name.'">';
                        echo '<span class="ico"></span>';
                        echo '<span class="txt">'.$provider_name.'</span>';
                        echo '</span>';
                        $social_displayed = true;
                    }
                    echo '</div>';
                }
            }
            
            // 위에서 표시 안됐고, mb_id가 소셜 형태면 직접 표시
            if(!$social_displayed){
                $check_mb_id = strtolower($row['mb_id']);
                $provider = '';
                if(strpos($check_mb_id, 'kakao_') === 0){
                    $provider = 'kakao';
                } else if(strpos($check_mb_id, 'naver_') === 0){
                    $provider = 'naver';
                } else if(strpos($check_mb_id, 'google_') === 0){
                    $provider = 'google';
                } else if(strpos($check_mb_id, 'apple_') === 0){
                    $provider = 'apple';
                }
                
                if($provider){
                    $provider_name = function_exists('social_get_provider_service_name') ? social_get_provider_service_name($provider) : ucfirst($provider);
                    echo '<div class="member_social_provider sns-wrap-over sns-wrap-32">';
                    echo '<span class="sns-icon sns-'.$provider.'" title="'.$provider_name.'">';
                    echo '<span class="ico"></span>';
                    echo '<span class="txt">'.$provider_name.'</span>';
                    echo '</span>';
                    echo '</div>';
                }
            }
            ?>
        </td>
        <td headers="mb_list_name" class=""><?php echo get_text($row['mb_name']); ?></td>
        <!--<td headers="mb_list_nick" class=""><div><?php echo $mb_nick ?></div></td>-->
        <td>
			<?php echo format_phone(str_replace("-","",($row['mb_hp']))); ?></td>

        <td headers="mb_list_auth" class="">
            <?php echo get_member_level_select("mb_level[$i]", 1, $member['mb_level'], $row['mb_level']) ?>
        </td>
		<td headers="mb_list_auth" class="">
            <?php echo $row['mb_1'] ?>
        </td>
        <td headers="mb_list_point" class=""><a href="point_list.php?sfl=mb_id&amp;stx=<?php echo $row['mb_id'] ?>"><?php echo number_format($row['mb_point']) ?></a></td>
        <td class=""><?php echo $row['mb_10'] ?></td>
        <td class="">
			<?
			if($row["mb_birth"]){
				echo getAge($row["mb_birth"]);
			}else{
				echo "-";
			}
			?>
		</td>
        <td class=""><? echo get_member_pay_count($row["mb_id"]);?></td>

        <?php
        // 환불 건(usetm < 30 AND amt <= 상담사 분당요금) 제외한 누적결제 합산
        $acc_mb1 = sql_escape_string($row["mb_1"]);
        $acc_hp  = preg_replace('/[^0-9]/', '', $row["mb_hp"]);
        $acc_hp_esc = sql_escape_string($acc_hp);
        $acc_conds = [];
        if ($acc_mb1 !== '') $acc_conds[] = "membid = '{$acc_mb1}'";
        if ($acc_hp_esc !== '') $acc_conds[] = "REPLACE(`from`, '-', '') = '{$acc_hp_esc}'";
        $acc_070 = 0;
        $acc_060 = 0;
        if (!empty($acc_conds)) {
            $acc_w = implode(' OR ', $acc_conds);
            $sql_acc = "SELECT
                COALESCE(SUM(CASE WHEN preflag='Y' AND reason='DISCONNECT'
                    AND NOT (usetm < 30 AND amt <= COALESCE((SELECT cm.mb_4 FROM g5_member cm WHERE cm.mb_1 = platform_consulting.csrid LIMIT 1), 0))
                    THEN amt ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN reason='END_CHAT' THEN amt ELSE 0 END), 0) as s070,
                COALESCE(SUM(CASE WHEN (preflag='' OR preflag IS NULL) AND reason='DISCONNECT'
                    AND NOT (usetm < 30 AND amt <= COALESCE((SELECT cm.mb_4 FROM g5_member cm WHERE cm.mb_1 = platform_consulting.csrid LIMIT 1), 0))
                    THEN amt ELSE 0 END), 0) as s060
                FROM platform_consulting WHERE ({$acc_w}) AND csrid != ''";
            $acc_r = sql_fetch($sql_acc);
            $acc_070 = (int)($acc_r['s070'] ?? 0);
            $acc_060 = (int)($acc_r['s060'] ?? 0);
        }
        ?>
        <td class=""><?php echo number_format($acc_070); ?></td>
        <td class=""><?php echo number_format($acc_060); ?></td>

        <td class="">
		
			<?
			$csql = "select count(*) as ct from g5_shop_coupon where mb_id='".$row["mb_id"]."'";
			//echo $csql;
			$coupon_count =  sql_fetch($csql);
			echo (int)$coupon_count["ct"];
			?>
		
		</td>
        <td class=""><?=get_join_dur($row["mb_id"])?></td>
        <td class=""><?php echo $row['org_source']?$row['org_source']:'신규앱'; ?></td>
        <td headers="mb_list_lastcall" class="td_date"><?php echo substr($row['mb_today_login'],2,8); ?></td>
        <!--
        <td headers="mb_list_sms">
            <label for="mb_sms_<?php echo $i; ?>" class="sound_only">SMS수신</label>
            <input type="checkbox" name="mb_sms[<?php echo $i; ?>]" <?php echo $row['mb_sms']?'checked':''; ?> value="1" id="mb_sms_<?php echo $i; ?>">
        </td>
        <td headers="mb_list_mailr">
            <label for="mb_mailling_<?php echo $i; ?>" class="sound_only">메일수신</label>
            <input type="checkbox" name="mb_mailling[<?php echo $i; ?>]" <?php echo $row['mb_mailling']?'checked':''; ?> value="1" id="mb_mailling_<?php echo $i; ?>">
        </td>
        <!--
        <td headers="mb_list_open">
            <label for="mb_open_<?php echo $i; ?>" class="sound_only">정보공개</label>
            <input type="checkbox" name="mb_open[<?php echo $i; ?>]" <?php echo $row['mb_open']?'checked':''; ?> value="1" id="mb_open_<?php echo $i; ?>">
        </td>
        
        <td headers="mb_list_deny">
            <?php if(empty($row['mb_leave_date'])){ ?>
            <input type="checkbox" name="mb_intercept_date[<?php echo $i; ?>]" <?php echo $row['mb_intercept_date']?'checked':''; ?> value="<?php echo $intercept_date ?>" id="mb_intercept_date_<?php echo $i ?>" title="<?php echo $intercept_title ?>">
            <label for="mb_intercept_date_<?php echo $i; ?>" class="sound_only">접근차단</label>
            <?php } ?>
        </td>
        -->
        <td headers="mb_list_mng" class="td_mng td_mng_s"><?php echo $s_mod ?><?php echo $s_grp ?></td>
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