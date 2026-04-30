<?php
$sub_menu = "350100";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'w');

$mb = array(
'mb_certify' => null,
'mb_adult' => null,
'mb_sms' => null,
'mb_intercept_date' => null,
'mb_id' => null,
'mb_name' => null,
'mb_nick' => null,
'mb_point' => null,
'mb_email' => null,
'mb_homepage' => null,
'mb_hp' => null,
'mb_tel' => null,
'mb_zip1' => null,
'mb_zip2' => null,
'mb_addr1' => null,
'mb_addr2' => null,
'mb_addr3' => null,
'mb_addr_jibeon' => null,
'mb_signature' => null,
'mb_profile' => null,
'mb_memo' => null,
'mb_leave_date' => null,
'mb_1' => null,
'mb_2' => null,
'mb_3' => null,
'mb_4' => null,
'mb_5' => null,
'mb_6' => null,
'mb_7' => null,
'mb_8' => null,
'mb_9' => null,
'mb_10' => null,
'mb_12' => null,
'mb_13' => null,
);

$sound_only = '';
$required_mb_id_class = '';
$required_mb_password = '';

if ($w == '')
{
    $required_mb_id = 'required';
    $required_mb_id_class = 'required alnum_';
    $required_mb_password = 'required';
    $sound_only = '<strong class="sound_only">필수</strong>';

    $mb['mb_mailling'] = 1;
    $mb['mb_open'] = 1;
    $mb['mb_level'] = $config['cf_register_level'];
    $html_title = '관리';
}
else if ($w == 'u')
{
    $mb = get_member($mb_id);
    if (!$mb['mb_id'])
        alert('존재하지 않는 회원자료입니다.');

    if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level'])
        alert('자신보다 권한이 높거나 같은 회원은 수정할 수 없습니다.');

    $required_mb_id = 'readonly';
    $html_title = '관리';

    $mb['mb_name'] = get_text($mb['mb_name']);
    $mb['mb_nick'] = get_text($mb['mb_nick']);
    $mb['mb_email'] = get_text($mb['mb_email']);
    $mb['mb_homepage'] = get_text($mb['mb_homepage']);
    $mb['mb_birth'] = get_text($mb['mb_birth']);
    $mb['mb_tel'] = get_text($mb['mb_tel']);
    $mb['mb_hp'] = get_text($mb['mb_hp']);
    $mb['mb_addr1'] = get_text($mb['mb_addr1']);
    $mb['mb_addr2'] = get_text($mb['mb_addr2']);
    $mb['mb_addr3'] = get_text($mb['mb_addr3']);
    $mb['mb_signature'] = get_text($mb['mb_signature']);
    $mb['mb_recommend'] = get_text($mb['mb_recommend']);
    $mb['mb_profile'] = get_text($mb['mb_profile']);
    $mb['mb_1'] = get_text($mb['mb_1']);
    $mb['mb_2'] = get_text($mb['mb_2']);
    $mb['mb_3'] = get_text($mb['mb_3']);
    $mb['mb_4'] = get_text($mb['mb_4']);
    $mb['mb_5'] = get_text($mb['mb_5']);
    $mb['mb_6'] = get_text($mb['mb_6']);
    $mb['mb_7'] = get_text($mb['mb_7']);
    $mb['mb_8'] = get_text($mb['mb_8']);
    $mb['mb_9'] = get_text($mb['mb_9']);
    $mb['mb_10'] = get_text($mb['mb_10']);
    $mb['mb_12'] = get_text($mb['mb_12']);
    $mb['mb_13'] = get_text($mb['mb_13']);
}
else
    alert('제대로 된 값이 넘어오지 않았습니다.');

// 본인확인방법
switch($mb['mb_certify']) {
    case 'simple':
        $mb_certify_case = '간편인증';
        $mb_certify_val = 'simple';
        break;
    case 'hp':
        $mb_certify_case = '휴대폰';
        $mb_certify_val = 'hp';
        break;
    case 'ipin':
        $mb_certify_case = '아이핀';
        $mb_certify_val = 'ipin';
        break;
    case 'admin':
        $mb_certify_case = '관리자 수정';
        $mb_certify_val = 'admin';
        break;
    default:
        $mb_certify_case = '';
        $mb_certify_val = 'admin';
        break;
}

// 지번주소 필드추가
if(!isset($mb['mb_addr_jibeon'])) {
    sql_query(" ALTER TABLE {$g5['member_table']} ADD `mb_addr_jibeon` varchar(255) NOT NULL DEFAULT '' AFTER `mb_addr2` ", false);
}

// 건물명필드추가
if(!isset($mb['mb_addr3'])) {
    sql_query(" ALTER TABLE {$g5['member_table']} ADD `mb_addr3` varchar(255) NOT NULL DEFAULT '' AFTER `mb_addr2` ", false);
}

// 중복가입 확인필드 추가
if(!isset($mb['mb_dupinfo'])) {
    sql_query(" ALTER TABLE {$g5['member_table']} ADD `mb_dupinfo` varchar(255) NOT NULL DEFAULT '' AFTER `mb_adult` ", false);
}

// 이메일인증 체크 필드추가
if(!isset($mb['mb_email_certify2'])) {
    sql_query(" ALTER TABLE {$g5['member_table']} ADD `mb_email_certify2` varchar(255) NOT NULL DEFAULT '' AFTER `mb_email_certify` ", false);
}

// 본인인증 내역 테이블 정보가 dbconfig에 없으면 소셜 테이블 정의
if( !isset($g5['member_cert_history']) ){
    $g5['member_cert_history_table'] = G5_TABLE_PREFIX.'member_cert_history';
}
// 멤버 본인인증 정보 변경 내역 테이블 없을 경우 생성
if(isset($g5['member_cert_history_table']) && !sql_query(" DESC {$g5['member_cert_history_table']} ", false)) {
    sql_query(" CREATE TABLE IF NOT EXISTS `{$g5['member_cert_history_table']}` (
                    `ch_id` int(11) NOT NULL auto_increment,
                    `mb_id` varchar(20) NOT NULL DEFAULT '',
                    `ch_name` varchar(255) NOT NULL DEFAULT '',
                    `ch_hp` varchar(255) NOT NULL DEFAULT '',
                    `ch_birth` varchar(255) NOT NULL DEFAULT '',
                    `ch_type` varchar(20) NOT NULL DEFAULT '',
                    `ch_datetime` datetime NOT NULL default '0000-00-00 00:00:00',
                    PRIMARY KEY (`ch_id`),
                    KEY `mb_id` (`mb_id`)
                ) ", true);
}

$mb_cert_history = '';
if (isset($mb_id) && $mb_id) {
    $sql = "select * from {$g5['member_cert_history_table']} where mb_id = '{$mb_id}' order by ch_id asc";
    $mb_cert_history = sql_query($sql);
}

if ($mb['mb_intercept_date']) $g5['title'] = "차단된 ";
else $g5['title'] .= "";
$g5['title'] .= '정기세차신청 '.$html_title;
include_once('./admin.head.php');

// add_javascript('js 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_javascript(G5_POSTCODE_JS, 0);    //다음 주소 js
?>

<form name="fmember" id="fmember" action="./service_form_update.php" onsubmit="return fmember_submit(this);" method="post" enctype="multipart/form-data">
<input type="hidden" name="w" value="<?php echo $w ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="token" value="">

<div class="tbl_frm01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col class="grid_4">
        <col>
        <col class="grid_4">
        <col>
    </colgroup>
    <tbody>
    <tr>
        <th scope="row">신청날짜</th>
        <td>2023-03-26</td>
        <th scope="row">상황</th>
        <td>
        	종료
        </td>
    </tr>
    <tr>
        <th scope="row">구분</th>
        <td>SUV·RV</td>
        <th scope="row">서비스</th>
        <td>프리미엄 (월 8회)</td>
    </tr>
    <tr>
        <th scope="row">차종</th>
        <td>티구안</td>
        <th scope="row">번호/컬러</th>
        <td>1234 / 실버</td>
    </tr>
    <tr>
        <th scope="row">고객</th>
        <td>홍길동 (test)</td>
        <th scope="row">연락처</th>
        <td>010-1234-5678</td>
    </tr>
    <tr>
        <th scope="row">세차장소</th>
        <td colspan="3" class="td_addr_line">대구 동구 경안로 790-11 123동 </td>
    </tr>
    <tr>
        <th scope="row">주차장소</th>
        <td colspan="3" class="td_addr_line">지상주차장 4,5호 통로쪽</td>
    </tr>
    <tr>
        <th scope="row">매니저</th>
        <td colspan="3">
            <input type="text" name="mb_addr3" id="mb_addr3" class="frm_input" size="10" value="test02" placeholder="ID">
            김철수(010-2222-3333)
        </td>
    </tr>
    </tr>
    <tr>
        <th scope="row">키 전달방법</th>
        <td colspan="3">문 열어놓겠습니다.</td>
    </tr>
    <tr>
        <th scope="row">기타사항</th>
        <td colspan="3">꼼꼼하게 해주세요</td>
    </tr>



    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <a href="./service_list.php?<?php echo $qstr ?>" class="btn btn_02">목록</a>
    <input type="submit" value="확인" class="btn_submit btn" accesskey='s'>
</div>
</form>

<script>
function fmember_submit(f)
{
    if (!f.mb_icon.value.match(/\.(gif|jpe?g|png)$/i) && f.mb_icon.value) {
        alert('아이콘은 이미지 파일만 가능합니다.');
        return false;
    }

    if (!f.mb_img.value.match(/\.(gif|jpe?g|png)$/i) && f.mb_img.value) {
        alert('회원이미지는 이미지 파일만 가능합니다.');
        return false;
    }

    return true;
}
</script>
<?php
run_event('admin_service_form_after', $mb, $w);

include_once('./admin.tail.php');