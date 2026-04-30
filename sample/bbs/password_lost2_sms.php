<?php
include_once('./_common.php');
//include_once(G5_CAPTCHA_PATH.'/captcha.lib.php');

if ($is_member) {
    alert('이미 로그인중입니다.');
}

/*
if (!chk_captcha()) {
    alert('자동등록방지 숫자가 틀렸습니다.');
}
*/

// 오류시 공히 Error 라고 처리하는 것은 회원정보가 있는지? 비밀번호가 틀린지? 를 알아보려는 해킹에 대비한것

$hp_confirm =  trim($_POST['hp_confirm']);
$mb_no = trim($_POST['mb_no']);
$mb_datetime = trim($_POST['mb_datetime']);
$mb_lost_certify = trim($_POST['mb_lost_certify']);
$hp = trim($_POST['mb_hp']);

if (!$hp_confirm || !$mb_no || !$mb_datetime || !$mb_lost_certify || !$hp)
    //alert_close('잘못된 접근방식입니다.');
	alert_close('인증번호를 입력해 주세요.');

if (sql_password($hp_confirm) != $mb_lost_certify)
    alert('인증번호가 맞지 않습니다.');

// 회원아이디가 아닌 회원고유번호로 회원정보를 구한다.
$sql = " select mb_id, mb_datetime, mb_lost_certify, mb_hp from {$g5['member_table']} where mb_no = '$mb_no' ";
$mb  = sql_fetch($sql);
if (!trim($mb['mb_lost_certify']))
    die("Error");




if ($hp != $mb['mb_hp'])
    die("Error");

// 난수 발생
srand(time());
$change_password2 = rand(100000, 999999);

// 인증 링크는 한번만 처리가 되게 한다.
sql_query(" update {$g5['member_table']} set mb_lost_certify = '' where mb_no = '$mb_no' ");

// 변경될 비밀번호가 넘어와야하고 저장된 변경비밀번호를 md5 로 변환하여 같으면 정상
if ($mb_lost_certify && $mb_datetime == sql_password($mb['mb_datetime']) && $mb_lost_certify == $mb['mb_lost_certify']) {

	$sms_contents = "";
	$sms_contents .= '회원정보찾기 - ';
	$sms_contents .= '회원ID: '.$mb['mb_id'];
	$sms_contents .= ', 변경된 비밀번호: '.$change_password2;
	$sms_contents .= ' - '.$default['de_admin_company_name'].' '.$_SERVER["HTTP_HOST"];
	$recv_numbers = $hp;
	//$send_numbers = $default['de_admin_company_tel'];
	$send_numbers = $sms5['cf_phone'];

	//include_once(G5_LIB_PATH.'/icode.sms.lib.php');

	//$SMS = new SMS; // SMS 연결
	//$SMS->SMS_con($config['cf_icode_server_ip'], $config['cf_icode_id'], $config['cf_icode_pw'], $config['cf_icode_server_port']);
	$sms_count = 0;

	$recv_number = preg_replace("/[^0-9]/", "", $recv_numbers);
	$send_number = preg_replace("/[^0-9]/", "", $send_numbers);

	$idx = 'de_sms_use'.($s + 2);

	//if($recv_number && $send_numbers) {
		//$SMS->Add($recv_number, $send_number, $config['cf_icode_id'], iconv("utf-8", "euc-kr", stripslashes($sms_contents)), "");
	   // $sms_count++;
	//}

	//if($sms_count > 0){
		//$SMS->Send();
	
		// 카톡 알림 발송 //
		include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
		include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');

		$bizmsg = new bizmsg();
			$bizmsg->phn                = $recv_numbers;
			$bizmsg->at_type            = '회원정보찾기'; //
			$bizmsg->usr_id           = $mb["mb_id"];
			$bizmsg->usr_name     = $mb["mb_name"];
			$bizmsg->im_password           = $change_password2;
			$rr = $bizmsg->send(); 	
	   // 카톡 알림 발송끝 //

	//}

	$change_password2 = sql_password($change_password2);

	sql_query(" update {$g5['member_table']} set mb_password = '{$change_password2}' where mb_no = '$mb_no' ");

	$href_G5 = G5_URL;
    //alert_close($hp.' 번호로 회원아이디와 변경된 비밀번호 정보를 발송하였습니다.\\n\\n문자메세지를 확인하여 주십시오.');
	alert($hp.' 번호로 회원아이디와 변경된 비밀번호 정보를 발송하였습니다.\\n\\n문자메세지를 확인하여 주십시오.', $href_G5);
}
else {
	$href_G5 = G5_URL;
	alert('이미 사용된 인증번호입니다', $href_G5);
	die("Error");
}