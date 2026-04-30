<?php 
include_once('../common.php'); 
################################################################### 

if(!$member["mb_id"]){
	alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}

$oid = $_REQUEST["oid"];
$membid = $_REQUEST["membid"];
$membnm =  $_REQUEST["membnm"];
$membnm_org = $membnm;

$amount=$_REQUEST["amount"];
$coinamt=$_REQUEST["coinamt"];
$telno=$_REQUEST["telno"];
$telno_org = $telno;

$socno = $_REQUEST["socno"]; 
$pass =  $_REQUEST["pass"];

$exp =  $_REQUEST["exp"];

$cardno1= $_REQUEST["cardno1"];
$cardno2 = $_REQUEST["cardno2"];
$cardno3 = $_REQUEST["cardno3"];
$cardno4 = $_REQUEST["cardno4"];

$card_month = substr($exp,0,2);
$card_year = substr($exp,-2);
$card_no = $cardno1.$cardno2.$cardno3.$cardno4;
$card_name = $_REQUEST["card_name"];


$pushurl = "https://sajumoon.co.kr/mtonet/auto_pay_result.php";


 if($membid && $card_no){

	$sql = "select * from g5_member_auto_pay where mb_id='".$member["mb_id"]."' or membid='".$membid."'";
	$row = sql_fetch($sql);

	if($row["no"]){ //////////////////////////// 기존에 등록된 카드가 있으면? update
		
		$usql = "update g5_member_auto_pay set amount='".$amount."' , coinamt='".$coinamt."', membid='".$membid."', telno='".$telno."', pushurl='".$pushurl."', card_nm='".$card_name."', card_no='".maskFlexible($card_no, 20, 100)."', exp_month='**', exp_year='**', socno='".maskFlexible($socno, 20, 100)."', pass='**' where no='".$row["no"]."'";
		//echo $usql;
		//echo "<br>";
		sql_query($usql);
	}else{ /////////////////////////////////////// 기존에 등록된 카드가 없으면 등록
		
		$isql = "insert into g5_member_auto_pay(`mb_id`, `mb_name`, `item`, `amount`, `coinamt`, `membid`, `telno`, `pushurl`, `card_nm`, `card_no`, `exp_month`, `exp_year`, `socno`, `pass`, `regday`)values('".$member["mb_id"]."', '".$membnm."', '카드등록', '".$amount."', '".$coinamt."', '".$membid."', '".$telno."', '".$pushurl."', '".$card_name."', '".maskFlexible($card_no, 20, 100)."', '**', '**', '".maskFlexible($socno, 20, 100)."', '**', now())";
		//echo $isql;
		//echo "<br>";
		sql_query($isql);
		$no = sql_insert_id();
	}
	/////////////// 앰투넷에 카드등록 보내기 //////////////////////////

//// 실등록할때 사용해야함 테스트일때는 주석처리//
	$card_no = @openssl_encrypt($card_no , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$card_no = base64_encode($card_no);

	$card_month = @openssl_encrypt($card_month , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$card_month = base64_encode($card_month);

	$card_year = @openssl_encrypt($card_year , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$card_year = base64_encode($card_year);

	$socno = @openssl_encrypt($socno , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$socno = base64_encode($socno);

	$pass = @openssl_encrypt($pass , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$pass = base64_encode($pass);

	$membnm = @openssl_encrypt($membnm , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$membnm = base64_encode($membnm);

	$membid = @openssl_encrypt($membid , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$membid = base64_encode($membid);

	$telno = @openssl_encrypt($telno , "aes-128-cbc", $crypt_pass, true, $crypt_iv);
	$telno = base64_encode($telno);
///////////// 실등록일때 사용 끝 //////////////


	$data	= '{"oid":"'.$oid.'","cardno":"'.$card_no.'","exp_month":"'.$card_month.'","exp_year":"'.$card_year.'","socno":"'.$socno.'","pass":"'.$pass.'","item":"상담료","usernm":"'.$membnm.'","amount":'.$amount.',"coinamt":'.$coinamt.',"membid":"'.$membid.'","telno":"'.$telno.'", "pushurl":"'.$pushurl.'"}';		
	
	$murl = "cptl/autopay/gnrc_autopay_regist";
	$jresult = send_mjson_auto_pay($murl, $data, 'POST', '');  ///실등록
	//$jresult = send_mjson_auto_pay($murl, $data, 'PATCH', ''); /// 테스트


	if($jresult["req_result"]=="00"){ /// 성공
			$usql1 = "update g5_member_auto_pay set billkey='".$jresult["BillKey"]."' where no='".$no."'";

			$rtn = sql_query($usql1);
			if($rtn){

			
				echo "<script>alert('등록완료');location.href='/coin/coin_fill.php';</script>";
				//alert('카드삭제완료', '/coin/coin_fill.php');
				exit;

			}
		
		
	}else{

		$dsql = "delete from g5_member_auto_pay where no='".$no."'";
		$dtn = sql_query($dsql);
		if($dtn){
			//echo "카드등록실패";
			alert($jresult["resultmessage"], '/coin/coin_fill.php');
			//exit;
		}
	}

	/////////////// 앰투넷에 카드등록 보내기 끝 ////////////////////////////
 }

?> 