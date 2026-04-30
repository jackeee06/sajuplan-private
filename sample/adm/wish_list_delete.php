<?php
$sub_menu = '350430';
include_once('./_common.php');

check_demo();

auth_check_menu($auth, $sub_menu, 'd');

check_admin_token();




$count = (isset($_POST['chk']) && is_array($_POST['chk'])) ? count($_POST['chk']) : 0;
if(!$count)
    alert($_POST['act_button'].' 하실 항목을 하나 이상 체크하세요.');

for ($i=0; $i<$count; $i++)
{
    // 실제 번호를 넘김
    $k = $_POST['chk'][$i];
    $wr_id = (int) $_POST['wr_id'][$k];
    $str_mb_id = sql_real_escape_string($_POST['mb_id'][$k]);

    
    //내역삭제
    $sql = " delete from g5_write_wish where wr_id = '{$wr_id}' ";
    sql_query($sql);


}

goto_url('./wish_list.php?'.$qstr);