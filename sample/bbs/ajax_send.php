<?php
include_once('../common.php');

$a_auth      = trim($_POST['a_auth']);
$recv_number = trim($_POST['mb_hp']);


$sql = "select count(*) as cnt from sms_auth where a_hp='$recv_number' and a_auth>'".(time()-60*5)."' "; // 현재 10분 입니다. 추후 10을 변경하시면 됩니다.

//echo $sql;

$row = sql_fetch($sql);
if ($row[cnt]>5){ //제한 횟수
	echo "F";
}else{
	//if($config['cf_sms_use'] == 'icode') {

		//include_once(G5_LIB_PATH.'/icode.sms.lib.php');

		$a_num = rand(10000, 99999);

//		$sms_content = "본인확인 인증번호[".$a_num.']를 화면에 입력해주세요';
//		$send_number = preg_replace('/[^0-9]/', '', $sms5['cf_phone']);
//
		if($recv_number) {
			sql_query("insert into sms_auth set a_auth='$a_auth', a_num='$a_num', a_hp='$recv_number', a_regdate=now()");
//
//			$SMS = new SMS; // SMS 연결
//			$SMS->SMS_con($config['cf_icode_server_ip'], $config['cf_icode_id'], $config['cf_icode_pw'], $config['cf_icode_server_port']);
//			$SMS->Add($recv_number, $send_number, $config['cf_icode_id'], iconv("utf-8", "euc-kr", stripslashes($sms_content)), "");
//			$SMS->Send();
		}


		// 카톡 알림 발송 //
			include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
			include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
			
			$bizmsg = new bizmsg();
				$bizmsg->phn                = $recv_number;
				$bizmsg->at_type            = '회원가입 인증'; //
				$bizmsg->allow_num     = $a_num;		
				$rr = $bizmsg->send(); 
		   // 카톡 알림 발송끝 //


		echo "Y";
		exit;
	//}else{
	//	echo "N";
	//}
}
?>