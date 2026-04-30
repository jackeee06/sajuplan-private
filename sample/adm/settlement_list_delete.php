<?php
$sub_menu = "350500";
include_once("./_common.php");

check_demo();

auth_check_menu($auth, $sub_menu, "d");

check_admin_token();

$msg = "";
for ($i=0; $i<count($chk); $i++)
{
    // 실제 번호를 넘김
    $k = $_POST['chk'][$i];

    $no = get_member($_POST['no'][$k]);

     $sql = "delete from g5_point_end where no='".$no."'";
	 sql_query($sql);
}


goto_url("./settlement_list.php?$qstr");