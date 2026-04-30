<?php
include_once('../common.php');

$a_auth      = trim($_POST['a_auth']);
$auth_num    = trim($_POST['auth_num']);
$recv_number = trim($_POST['mb_hp']);

$sql = "select count(*) as ct from sms_auth where a_hp='$recv_number' and a_num='$auth_num'";
$row = sql_fetch($sql);

if ($row["ct"] > 0){
	echo "Y";
}else{
	echo "N";
}
?>