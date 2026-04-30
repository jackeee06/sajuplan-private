<?php
$sub_menu = "300100";
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


// 상담사
$sql = " select count(*) as cnt {$sql_common} where mb_level='5' ";
$row = sql_fetch($sql);
$c_count = $row['cnt'];


//일반
$sql = " select count(*) as cnt {$sql_common} where mb_level ='2' ";

//echo $sql;

//exit;


$row = sql_fetch($sql);
$j_count = $row['cnt'];



$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '회원관리';
include_once('./admin.head.php');

$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

$colspan = 16;
?>

<style>
.member_social_provider { display:inline-block;}

/* 회원관리 테이블 리디자인 */
.ml_table { width:100%; border-collapse:collapse; font-size:13px; }
.ml_table thead th { background:#f8f8fc; color:#333; font-weight:600; padding:10px 8px; border-bottom:2px solid #8259f5; font-size:12px; white-space:nowrap; text-align:center; }
.ml_table tbody td { padding:9px 8px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; }
.ml_table tbody tr:hover { background:#f5f3ff; }
.ml_table .td_id { text-align:left; font-weight:500; max-width:160px; }
.ml_table .td_id .mb_id_text { display:block; color:#333; }
.ml_table .td_id .mb_name_text { display:block; font-size:11px; color:#888; margin-top:2px; }
.ml_table .td_contact { text-align:left; font-size:12px; color:#555; }
.ml_table .td_contact .hp_text { display:block; }
.ml_table .td_contact .tel_text { display:block; font-size:11px; color:#999; margin-top:1px; }
.ml_table .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:500; }
.ml_table .badge_normal { background:#e8f5e9; color:#2e7d32; }
.ml_table .badge_leave { background:#fce4ec; color:#c62828; }
.ml_table .badge_block { background:#fff3e0; color:#e65100; }
.ml_table .badge_counselor { background:#e8eaf6; color:#283593; }
.ml_table .badge_user { background:#f5f5f5; color:#616161; }
.ml_table .badge_admin { background:#fce4ec; color:#880e4f; }
.ml_table .td_path { font-size:11px; color:#777; max-width:80px; word-break:break-all; line-height:1.3; }
.ml_table .td_mng_btn a.btn { margin:1px; font-size:11px; }
.ml_table .td_check input[type="checkbox"] { width:16px; height:16px; cursor:pointer; }
.ml_table .td_yn { font-size:12px; }
.ml_table .txt_true { color:#2e7d32; font-weight:600; }
.ml_table .txt_false { color:#ccc; }
</style>

<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <span class="btn_ov01"><span class="ov_txt">총회원수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>명 </span></span>
    <a href="?sst=mb_intercept_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" data-tooltip-text="차단된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">차단 </span><span class="ov_num"><?php echo number_format($intercept_count) ?>명</span></a>
    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" data-tooltip-text="탈퇴된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">탈퇴  </span><span class="ov_num"><?php echo number_format($leave_count) ?>명</span></a>
    
    <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>
    
	<a href="?sst=&amp;sod=desc&amp;sfl=mb_level&amp;stx=5" class="btn_ov01" data-tooltip-text="상담사만 나열합니다."> <span class="ov_txt02">상담사</span><span class="ov_num"><?php echo number_format($c_count) ?>명</span></a>
    
    <a href="?sst=&amp;sod=desc&amp;sfl=mb_level&amp;stx=2" class="btn_ov01"  data-tooltip-text="탈퇴된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt02"> 일반</span><span class="ov_num"><?php echo number_format($j_count) ?>명</span></a>
        
    

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
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" required class="frm_input">
<input type="submit" class="btn_submit" value="검색">

</form>

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
    <table class="ml_table">
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>
        <th scope="col" style="width:36px;">
            <label for="chkall" class="sound_only">회원 전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col"><?php echo subject_sort_link('mb_id') ?>아이디 / 이름</a></th>
        <th scope="col">구분</th>
        <th scope="col">상태</th>
        <th scope="col"><?php echo subject_sort_link('mb_level', '', 'desc') ?>권한</a></th>
        <th scope="col">연락처</th>
        <th scope="col"><?php echo subject_sort_link('mb_email_certify', '', 'desc') ?>메일인증</a></th>
        <th scope="col"><?php echo subject_sort_link('mb_mailling', '', 'desc') ?>메일</a></th>
        <th scope="col"><?php echo subject_sort_link('mb_sms', '', 'desc') ?>SMS</a></th>
        <th scope="col"><?php echo subject_sort_link('mb_intercept_date', '', 'desc') ?>차단</a></th>
        <th scope="col" style="width:70px;">유입경로</th>
        <th scope="col" style="width:90px;">관리</th>
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
            $leave_msg = '탈퇴함';
        }
        else if ($row['mb_intercept_date']) {
            $mb_id = $mb_id;
            $intercept_msg = '차단됨';
            $intercept_title = '차단해제';
        }
        if ($intercept_title == '')
            $intercept_title = '차단하기';

        // 구분 배지
        if($row["mb_level"]=="5"){
            $type_badge = '<span class="badge badge_counselor">상담사</span>';
        }elseif($row["mb_level"]=="2"){
            $type_badge = '<span class="badge badge_user">일반</span>';
        }else{
            $type_badge = ($row["mb_level"] > 5) ? '<span class="badge badge_admin">관리자</span>' : '<span class="badge badge_user">Lv.'.$row["mb_level"].'</span>';
        }

        // 상태 배지
        if($leave_msg){
            $status_badge = '<span class="badge badge_leave">'.$leave_msg.'</span>';
        }else if($intercept_msg){
            $status_badge = '<span class="badge badge_block">'.$intercept_msg.'</span>';
        }else{
            $status_badge = '<span class="badge badge_normal">정상</span>';
        }
    ?>

    <tr>
        <td class="td_check">
            <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['mb_id'] ?>" id="mb_id_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?>님</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td class="td_id">
            <span class="mb_id_text">
                <?php echo $mb_id ?>
                <?php
                //소셜계정이 있다면
                $social_displayed = false;
                if(function_exists('social_login_link_account')){
                    if( $my_social_accounts = social_login_link_account($row['mb_id'], false, 'get_data') ){
                        echo '<span class="member_social_provider sns-wrap-over sns-wrap-32">';
                        foreach( (array) $my_social_accounts as $account){
                            if( empty($account) || empty($account['provider']) ) continue;
                            $provider = strtolower($account['provider']);
                            $provider_name = social_get_provider_service_name($provider);
                            echo '<span class="sns-icon sns-'.$provider.'" title="'.$provider_name.'">';
                            echo '<span class="ico"></span>';
                            echo '<span class="txt">'.$provider_name.'</span>';
                            echo '</span>';
                            $social_displayed = true;
                        }
                        echo '</span>';
                    }
                }
                if(!$social_displayed){
                    $check_mb_id = strtolower($row['mb_id']);
                    $provider = '';
                    if(strpos($check_mb_id, 'kakao_') === 0) $provider = 'kakao';
                    else if(strpos($check_mb_id, 'naver_') === 0) $provider = 'naver';
                    if($provider){
                        $provider_name = function_exists('social_get_provider_service_name') ? social_get_provider_service_name($provider) : ucfirst($provider);
                        echo '<span class="member_social_provider sns-wrap-over sns-wrap-32">';
                        echo '<span class="sns-icon sns-'.$provider.'" title="'.$provider_name.'">';
                        echo '<span class="ico"></span>';
                        echo '<span class="txt">'.$provider_name.'</span>';
                        echo '</span>';
                        echo '</span>';
                    }
                }
                ?>
            </span>
            <span class="mb_name_text"><?php echo get_text($row['mb_name']); ?></span>
        </td>
        <td><?php echo $type_badge; ?></td>
        <td><?php echo $status_badge; ?></td>
        <td><?php echo get_member_level_select("mb_level[$i]", 1, $member['mb_level'], $row['mb_level']) ?></td>
        <td class="td_contact">
            <span class="hp_text"><?php echo get_text($row['mb_hp']); ?></span>
            <?php if(get_text($row['mb_tel'])) { ?><span class="tel_text"><?php echo get_text($row['mb_tel']); ?></span><?php } ?>
        </td>
        <td class="td_yn"><?php echo preg_match('/[1-9]/', $row['mb_email_certify'])?'<span class="txt_true">Y</span>':'<span class="txt_false">N</span>'; ?></td>
        <td class="td_yn">
            <label for="mb_mailling_<?php echo $i; ?>" class="sound_only">메일수신</label>
            <input type="checkbox" name="mb_mailling[<?php echo $i; ?>]" <?php echo $row['mb_mailling']?'checked':''; ?> value="1" id="mb_mailling_<?php echo $i; ?>">
        </td>
        <td class="td_yn">
            <label for="mb_sms_<?php echo $i; ?>" class="sound_only">SMS수신</label>
            <input type="checkbox" name="mb_sms[<?php echo $i; ?>]" <?php echo $row['mb_sms']?'checked':''; ?> value="1" id="mb_sms_<?php echo $i; ?>">
        </td>
        <td class="td_yn">
            <?php if(empty($row['mb_leave_date'])){ ?>
            <input type="checkbox" name="mb_intercept_date[<?php echo $i; ?>]" <?php echo $row['mb_intercept_date']?'checked':''; ?> value="<?php echo $intercept_date ?>" id="mb_intercept_date_<?php echo $i ?>" title="<?php echo $intercept_title ?>">
            <label for="mb_intercept_date_<?php echo $i; ?>" class="sound_only">접근차단</label>
            <?php } ?>
        </td>
        <td class="td_path"><?php echo trim($row['mb_21']) ? nl2br(htmlspecialchars(mb_substr($row['mb_21'], 0, 50))) : '-'; ?></td>
        <td class="td_mng_btn"><?php echo $s_mod ?> <?php echo $s_grp ?></td>
    </tr>

    <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"12\" class=\"empty_table\">자료가 없습니다.</td></tr>";
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