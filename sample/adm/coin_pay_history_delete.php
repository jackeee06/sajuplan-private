<?php
$sub_menu = "350420";
include_once('./_common.php');

check_demo();

if ($is_admin != 'super')
    alert('최고관리자만 접근 가능합니다.');

check_admin_token();


for ($i=0; $i<count($chk); $i++)
{
   
    $k = $_POST['chk'][$i];

    $no = $_POST['no'][$k];

	
	$dsql = "delete from saju_payment where no='".$no."'";
	$result = sql_query($dsql);


}

goto_url('./coin_pay_history.php?'.$qstr);