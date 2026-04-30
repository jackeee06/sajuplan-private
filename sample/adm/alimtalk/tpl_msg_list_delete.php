<?php
$sub_menu = '900060';
include_once('./_common.php');

auth_check($auth[$sub_menu], 'd');

check_admin_token();

$count = count($_POST['chk']);
if(!$count)
    alert('선택삭제 하실 항목을 하나이상 선택해 주세요.');

for ($i=0; $i<$count; $i++)
{
    // 실제 번호를 넘김
    $k = $_POST['chk'][$i];

    $sql = " delete from {$g5['wz_alimtalk_tplmsg_table']} where at_id = '{$_POST['at_id'][$k]}' ";
    sql_query($sql);
}

goto_url('./tpl_msg_list.php');
?>
