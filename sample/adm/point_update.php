<?php
$sub_menu = "350430";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'w');

check_admin_token();

$mb_id = isset($_POST['mb_id']) ? strip_tags(clean_xss_attributes($_POST['mb_id'])) : '';
$po_point = isset($_POST['po_point']) ? strip_tags(clean_xss_attributes($_POST['po_point'])) : 0;
$po_content = isset($_POST['po_content']) ? strip_tags(clean_xss_attributes($_POST['po_content'])) : '';
$expire = isset($_POST['po_expire_term']) ? preg_replace('/[^0-9]/', '', $_POST['po_expire_term']) : '';

$mb = get_member($mb_id);

if (!$mb['mb_id'])
    alert('존재하는 회원아이디가 아닙니다.', './point_list.php?'.$qstr);

if (isset($_SERVER['REMOTE_ADDR']) && $_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
    if (($po_point < 0) && ($po_point * (-1) > $mb['mb_point']))  // eun 회사 내 서버에서는 해당 부분 적용 안 되게 할 경우 이거 주석처리하기
        alert('포인트를 깎는 경우 현재 포인트보다 작으면 안됩니다.', './point_list.php?'.$qstr);
}
else {
    if (($po_point < 0) && ($po_point * (-1) > $mb['mb_point']))
        alert('포인트를 깎는 경우 현재 포인트보다 작으면 안됩니다.', './point_list.php?'.$qstr);
}


insert_point($mb_id, $po_point, $po_content, '@passive', $mb_id, $member['mb_id'].'-'.uniqid(''), $expire);

goto_url('./point_list.php?'.$qstr);