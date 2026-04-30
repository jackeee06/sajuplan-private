<?php
$sub_menu = '900060';
include_once('./_common.php');

auth_check($auth[$sub_menu], "w");

check_admin_token();

$_POST = array_map('trim', $_POST);

$at_type1 = $_POST['at_type1']; // 회원가입 축하
$at_type2 = $_POST['at_type2']; // 회원정보찾기
$at_type3 = $_POST['at_type3']; // 회원가입 인증
$at_type4 = $_POST['at_type4']; // 상담사 접속 알림
$at_type5 = $_POST['at_type5']; // 입금계좌 안내
$at_type6 = $_POST['at_type6']; // 입금확인

//20250729 eun 알림톡 템플릿 추가 작업 시작
$at_type7 = $_POST['at_type7']; // 상담사 자동 부재중 전환
$at_type8 = $_POST['at_type8']; // 채팅 상담방 개설
//20250729 eun 알림톡 템플릿 추가 작업 마감

$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '회원가입 축하'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type1}' where at_type = '회원가입 축하' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '회원가입 축하', at_id = '{$at_type1}' ";
    sql_query($sql);
}



$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '회원정보찾기'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type2}' where at_type = '회원정보찾기' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '회원정보찾기', at_id = '{$at_type2}' ";
    sql_query($sql);
}






$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '회원가입 인증'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type3}' where at_type = '회원가입 인증' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '회원가입 인증', at_id = '{$at_type3}' ";
    sql_query($sql);
}



$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '상담사 접속 알림'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type4}' where at_type = '상담사 접속 알림' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '상담사 접속 알림', at_id = '{$at_type4}' ";
    sql_query($sql);
}



$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '입금계좌 안내'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type5}' where at_type = '입금계좌 안내' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '입금계좌 안내', at_id = '{$at_type5}' ";
    sql_query($sql);
}


$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '입금확인'";
$row = sql_fetch($sql);
if ($row['as_id']) { 
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type6}' where at_type = '입금확인' ";
    sql_query($sql);
} 
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '입금확인', at_id = '{$at_type6}' ";
    sql_query($sql);
}

//20250729 eun 알림톡 템플릿 추가 작업 시작
$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '상담사 자동 부재중 전환'";
$row = sql_fetch($sql);
if ($row['as_id']) {
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type7}' where at_type = '상담사 자동 부재중 전환' ";
    sql_query($sql);
}
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '상담사 자동 부재중 전환', at_id = '{$at_type7}' ";
    sql_query($sql);
}

$sql = "select as_id from {$g5['wz_alimtalk_tplsel_table']} where at_type = '채팅 상담방 개설'";
$row = sql_fetch($sql);
if ($row['as_id']) {
    $sql = "update {$g5['wz_alimtalk_tplsel_table']} set at_id = '{$at_type8}' where at_type = '채팅 상담방 개설' ";
    sql_query($sql);
}
else {
    $sql = "insert into {$g5['wz_alimtalk_tplsel_table']} set at_type = '채팅 상담방 개설', at_id = '{$at_type8}' ";
    sql_query($sql);
}
//20250729 eun 알림톡 템플릿 추가 작업 마감

goto_url('./tpl_msg_list.php');
?>