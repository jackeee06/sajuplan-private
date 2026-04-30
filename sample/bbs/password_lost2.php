<?php
include_once('./_common.php');
include_once(G5_CAPTCHA_PATH.'/captcha.lib.php');
include_once(G5_LIB_PATH.'/mailer.lib.php');

if ($is_member) {
    alert_close('이미 로그인중입니다.', G5_URL);
}

if (!chk_captcha()) {
    alert('자동등록방지 숫자가 틀렸습니다.');
}

$email = get_email_address(trim($_POST['mb_email']));

//기존
/*
if (!$email)
    alert_close('메일주소 오류입니다.');
*/
//기존

$hp = trim($_POST['mb_hp']);
$hp = hyphen_hp_number($hp);

if (!$email && !$hp)
    alert_close('메일주소나 핸드폰번호를 입력해 주세요.');

if ($email && $hp)
    alert_close('메일주소나 핸드폰번호 중 하나만 입력해 주세요.');

if ($email) {

//기존
$sql = " select count(*) as cnt from {$g5['member_table']} where mb_email = '$email' ";
$row = sql_fetch($sql);
if ($row['cnt'] > 1)
    alert('동일한 메일주소가 2개 이상 존재합니다.\\n\\n관리자에게 문의하여 주십시오.');

$sql = " select mb_no, mb_id, mb_name, mb_nick, mb_email, mb_datetime, mb_leave_date from {$g5['member_table']} where mb_email = '$email' ";
$mb = sql_fetch($sql);
if (empty($mb['mb_id']) || $mb['mb_leave_date']) {
    alert('존재하지 않는 회원입니다.');
} elseif (is_admin($mb['mb_id'])) {
    alert('관리자 아이디는 접근 불가합니다.');
}

} else if ($hp) {
	$sql = " select count(*) as cnt from {$g5['member_table']} where mb_hp = '$hp' ";
	$row = sql_fetch($sql);
	if ($row['cnt'] > 1)
		alert('동일한 핸드폰번호가 2개 이상 존재합니다.\\n\\n관리자에게 문의하여 주십시오.');

	$sql = " select mb_no, mb_id, mb_name, mb_nick, mb_email, mb_hp, mb_datetime from {$g5['member_table']} where mb_hp = '$hp' ";
	$mb = sql_fetch($sql);
	if (!$mb['mb_id'])
		alert('존재하지 않는 회원입니다.');
	else if (is_admin($mb['mb_id']))
		alert('관리자 아이디는 접근 불가합니다.');
}
//기존

if ($email) {

//기존
// 임시비밀번호 발급
$change_password = rand(100000, 999999);
$mb_lost_certify = get_encrypt_string($change_password);

// 어떠한 회원정보도 포함되지 않은 일회용 난수를 생성하여 인증에 사용
$mb_nonce = md5(pack('V*', rand(), rand(), rand(), rand()));

// 임시비밀번호와 난수를 mb_lost_certify 필드에 저장
$sql = " update {$g5['member_table']} set mb_lost_certify = '$mb_nonce $mb_lost_certify' where mb_id = '{$mb['mb_id']}' ";
sql_query($sql);

// 인증 링크 생성
$href = G5_BBS_URL.'/password_lost_certify.php?mb_no='.$mb['mb_no'].'&amp;mb_nonce='.$mb_nonce;

$subject = "[".$config['cf_title']."] 요청하신 회원정보 찾기 안내 메일입니다.";

$content = "";

$content .= '<div style="width:600px; margin:40px auto;">    
    <table width="600px" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFF; border:10px solid #f8f8f9;">
		<tr>
			<td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative;">
            	<div style=" width:600px; float:left;">
                	<span style="float:left;">
                    	<img src="https://sajumoon.co.kr/img/mail/logo.png" style=" height:35px;">
            			<p style="margin-top:20px; font-size:18px; font-weight:600; padding-right:20px;">
           	    			회원정보 찾기 안내
                        </p>
                    </span>
                    <span style="float:right;">
                    	<img src="https://sajumoon.co.kr/img/mail/logo_02.png" style="width:100px;"> 
                    </span>
                </div>
            </td>
        </tr>
        
        
        
        <tr>
            <td style=" padding:20px; position:relative;">
            	<div style="width:100%; float:left; color:#222; font-size:14px; line-height:160%;">';
                    
$content .= '<p style="margin:20px 0 0;padding:30px 30px 30px;border-bottom:1px solid #eee;line-height:1.7em">';
$content .= addslashes($mb['mb_name'])." (".addslashes($mb['mb_nick']).")"." 회원님은 ".G5_TIME_YMDHIS." 에 회원정보 찾기 요청을 하셨습니다.<br>";
$content .= '저희 사이트는 관리자라도 회원님의 비밀번호를 알 수 없기 때문에, 비밀번호를 알려드리는 대신 새로운 비밀번호를 생성하여 안내 해드리고 있습니다.<br><br>';
$content .= '1. 아래에서 변경될 비밀번호를 확인하신 후, <span style="color:#2c91ff "><strong>비밀번호 변경</strong> 링크를 클릭 하십시오.</span><br>';
$content .= '2. 비밀번호가 변경되었다는 인증 메세지가 출력되면, 홈페이지에서 회원아이디와 변경된 비밀번호를 입력하시고 로그인 하십시오.<br>';
$content .= '3. 로그인 후에는 정보수정 메뉴에서 새로운 비밀번호로 변경해 주십시오.';
$content .= '</p>';
$content .= '<p style="margin:0;padding:30px 30px 30px;border-bottom:1px solid #eee;line-height:1.7em">';
$content .= '<span style="display:inline-block;width:130px">회원아이디</span> '.$mb['mb_id'].'<br>';
$content .= '<span style="display:inline-block;width:130px">변경될 비밀번호</span> <strong style="color:#2c91ff ">'.$change_password.'</strong>';
$content .= '</p>';
$content .= '<a href="'.$href.'" target="_blank" style="display:block;padding:30px 0;background:#484848;color:#fff;text-decoration:none;text-align:center">비밀번호 변경</a>';

$content .= '</div>
            </td>
		</tr>
        
      <tr>
        <td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative; font-size:13px;color:#222;line-height:160%;"> 
        	이 메일은 발송 전용입니다.
        </td>
      </tr>
      <tr>
        <td style=" padding:20px; position:relative; font-size:12px;color:#999;line-height:160%; background-color:#eee;"><img src="https://sajumoon.co.kr/img/mail/copy.png"></td>
      </tr>
    </table></td>
  </tr>
  </table>
</div>';

/*
$content .= '<div style="margin:30px auto;width:600px;border:10px solid #f7f7f7">';
$content .= '<div style="border:1px solid #dedede">';
$content .= '<h1 style="padding:30px 30px 0;background:#f7f7f7;color:#555;font-size:1.4em">';
$content .= '회원정보 찾기 안내


';
$content .= '</h1>';
$content .= '<span style="display:block;padding:10px 30px 30px;background:#f7f7f7;text-align:right">';
$content .= '<a href="'.G5_URL.'" target="_blank">'.$config['cf_title'].'</a>';
$content .= '</span>';
$content .= '<p style="margin:20px 0 0;padding:30px 30px 30px;border-bottom:1px solid #eee;line-height:1.7em">';
$content .= addslashes($mb['mb_name'])." (".addslashes($mb['mb_nick']).")"." 회원님은 ".G5_TIME_YMDHIS." 에 회원정보 찾기 요청을 하셨습니다.<br>";
$content .= '저희 사이트는 관리자라도 회원님의 비밀번호를 알 수 없기 때문에, 비밀번호를 알려드리는 대신 새로운 비밀번호를 생성하여 안내 해드리고 있습니다.<br>';
$content .= '아래에서 변경될 비밀번호를 확인하신 후, <span style="color:#2c91ff "><strong>비밀번호 변경</strong> 링크를 클릭 하십시오.</span><br>';
$content .= '비밀번호가 변경되었다는 인증 메세지가 출력되면, 홈페이지에서 회원아이디와 변경된 비밀번호를 입력하시고 로그인 하십시오.<br>';
$content .= '로그인 후에는 정보수정 메뉴에서 새로운 비밀번호로 변경해 주십시오.';
$content .= '</p>';
$content .= '<p style="margin:0;padding:30px 30px 30px;border-bottom:1px solid #eee;line-height:1.7em">';
$content .= '<span style="display:inline-block;width:100px">회원아이디</span> '.$mb['mb_id'].'<br>';
$content .= '<span style="display:inline-block;width:100px">변경될 비밀번호</span> <strong style="color:#2c91ff ">'.$change_password.'</strong>';
$content .= '</p>';
$content .= '<a href="'.$href.'" target="_blank" style="display:block;padding:30px 0;background:#484848;color:#fff;text-decoration:none;text-align:center">비밀번호 변경</a>';
$content .= '</div>';
$content .= '</div>';
*/



mailer($config['cf_admin_email_name'], $config['cf_admin_email'], $mb['mb_email'], $subject, $content, 1);



run_event('password_lost2_after', $mb, $mb_nonce, $mb_lost_certify);

$href_G5 = G5_URL;

alert($email.' 메일로 회원아이디와 비밀번호를 인증할 수 있는 메일이 발송 되었습니다.\\n\\n메일을 확인하여 주십시오.', $href_G5); // 메인페이지로 이동

//alert_close($email.' 메일로 회원아이디와 비밀번호를 인증할 수 있는 메일이 발송 되었습니다.\\n\\n메일을 확인하여 주십시오.'); 
//기존

} else if ($hp) {


//	// SMS 가입시
//	if ($config['cf_sms_use'] && $config['cf_icode_id'] && $config['cf_icode_pw']) {
//	} else {
//	 $href_G5 = G5_URL;
//     alert('SMS등록이 되지 않아 이메일로 이용해 주십시요.(SMS가입필요/관리자문의)', $href_G5); // 메인페이지로 이동
//	}	

	// 난수 발생
    srand(time());
    $change_password = rand(100000, 999999);


    $mb_lost_certify = sql_password($change_password);
    $mb_datetime     = sql_password($mb['mb_datetime']);

	$sql = " update {$g5['member_table']} set  mb_lost_certify = '$mb_lost_certify' where mb_id = '{$mb['mb_id']}' ";
	sql_query($sql);




	$sms_contents = "";
	$sms_contents .= '회원정보찾기 인증번호는 ';
	$sms_contents .= $change_password.' 입니다. ';
	$sms_contents .= $default['de_admin_company_name'].' '.$_SERVER["HTTP_HOST"];
    $recv_numbers = $hp;
    //$send_numbers = $default['de_admin_company_tel'];
	$send_numbers = $sms5['cf_phone'];


//	// SMS회신번호가 없을경우
	if($send_numbers == "") {
	 alert('전화번호 등록이 되지 않아 이메일로 이용해 주십시요.(SMS기본설정>회신번호등록필요/관리자문의)', $href_G5); // 메인페이지로 이동
	}
//
//    include_once(G5_LIB_PATH.'/icode.sms.lib.php');
//
//    $SMS = new SMS; // SMS 연결
//    $SMS->SMS_con($config['cf_icode_server_ip'], $config['cf_icode_id'], $config['cf_icode_pw'], $config['cf_icode_server_port']);
//    $sms_count = 0;
//
	$recv_number = preg_replace("/[^0-9]/", "", $recv_numbers);
    $send_number = preg_replace("/[^0-9]/", "", $send_numbers);
//
    $idx = 'de_sms_use'.($s + 2);
//
//    if($recv_number && $send_numbers) {
//		$SMS->Add($recv_number, $send_number, $config['cf_icode_id'], iconv("utf-8", "euc-kr", stripslashes($sms_contents)), "");
//        $sms_count++;
//    }
//
//    if($sms_count > 0)
//        $SMS->Send();


	// 카톡 알림 발송 //
	include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
	include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');


	
	$bizmsg = new bizmsg();
		$bizmsg->phn                = $recv_numbers;
		$bizmsg->at_type            = '회원정보찾기'; //
		$bizmsg->usr_id           = $mb["mb_id"];
		$bizmsg->usr_name     = $mb["mb_name"];
		$bizmsg->im_password           = $change_password;

		$rr = $bizmsg->send(); 


		//print_r($rr);
		//exit;
   // 카톡 알림 발송끝 //


   $change_password2 = sql_password($change_password);

   	sql_query(" update {$g5['member_table']} set mb_password = '{$change_password2}' where mb_no = '".$mb["mb_no"]."' ");

	
	alert('회원님 휴대폰으로 회원아이디와 변경된 비밀번호 정보를 발송하였습니다. 카카오톡을 확인해주세요.', '/bbs/login.php');
	exit;

	//$href = G5_BBS_URL.'/password_lost_sms.php?mb_no='.$mb['mb_no'].'&amp;mb_datetime='.$mb_datetime.'&amp;mb_lost_certify='.$mb_lost_certify.'&amp;mb_hp='.$hp;	
	//alert($hp.' 번호로 인증번호를 발송하였습니다.', $href);

	$href = G5_BBS_URL.'/password_lost_sms.php?mb_no='.$mb['mb_no'].'&amp;mb_datetime='.$mb_datetime.'&amp;mb_lost_certify='.$mb_lost_certify.'&amp;mb_hp='.$hp;	
	alert('회원님 휴대폰으로 회원아이디와 변경된 비밀번호 정보를 발송하였습니다. 카카오톡을 확인해주세요.', $href);
}