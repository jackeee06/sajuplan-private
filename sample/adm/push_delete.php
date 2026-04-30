<?php
$sub_menu = '900050';
include_once('./_common.php');

check_demo();

auth_check($auth[$sub_menu], 'd');

check_admin_token();

$count = count($_POST['chk']);
if(!$count)
    alert($_POST['act_button'].' 하실 항목을 하나 이상 체크하세요.');

for ($i=0; $i<$count; $i++)
{
    // 실제 번호를 넘김
    $k = $_POST['chk'][$i];
    $idx= (int) $_POST['idx'][$k];
    $kind = sql_real_escape_string($_POST['kind'][$k]);

    $sql = " select * from member_push where idx = '{$idx}' ";
    $row = sql_fetch($sql);

    if(!$row['idx'])
        continue;

    $sql = " delete from member_push where idx = '{$idx}' ";
    sql_query($sql);
}

goto_url('./push_list.php?'.$qstr);
?>