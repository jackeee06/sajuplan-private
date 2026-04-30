<?php 
include_once('../common.php'); 
#############################################

$jsondata = file_get_contents('php://input');



$arr = json_decode($jsondata,true);

$arrlen = count($arr);



///"tid":"4325215426423","oid":"32313","cpid":"0001","membid":"000003","vrno":"432123532342","deposit_nm":"홍길동","deposit_tm":"20220601010203","amount":100,'bankcd":"BK04"
//{"tid":"4325215426423","oid":"32313","cpid":"0001","membid":"000003","vrno":"432123532342","deposit_nm":"홍길동","deposit_tm":"20220601010203","amount":100,"bankcd":"BK04"}


//amount:-1 | amounti:-1 | bankcd:BK03 | coinamt:30000 | cpid:0006 | deposit_nm:이해진 | deposit_tm:20241016162541 | membid:194455 | membnm:이금주 | oid:_1729063488790 | paytype:VRBANK_PAY | req_result:0000 | resultmsg:ok | telno:01097305759 | tid:AG9-_172906348879048002596797335 | vrno:48002596797335 | 

if($arrlen > 0){


	$mtonet_allmsg = addslashes($jsondata); 

	$tid = $arr["tid"];
	$oid = $arr["oid"];
	$cpid = $arr["cpid"];
	$membid = $arr["membid"];
	$vrno = $arr["vrno"];
	$deposit_nm = $arr["deposit_nm"];
	$deposit_tm = $arr["deposit_tm"];

	$amount = $arr["amount"];

	$bankcd = $arr["bankcd"];

	
	$sql = "select * from saju_payment where Oid = '".$oid."' AND tid = '".$tid."'";
	$row=sql_fetch($sql);
	

	$resultmsg = "";
	if((int)$amount==(int)$row["Amount"]){
		$resultmsg = "입금완료";
	}elseif((int)$amount < (int)$row["Amount"]){
		$resultmsg = "부분입금";
	}

	
	$sql = "SELECT * FROM g5_member WHERE mb_1 = '".$membid."'";
	$Rs = sql_fetch($sql);

	If ($Rs["mb_id"]){
		$coin = $amount;
	}

	 
	  // 금액에 따라 코인 갯수 다름.
	  $coin = chg_point_pay($amount);
						  

	$strSQL = " UPDATE saju_payment SET  BankCd = '".$bankcd."', DepositNm = '".$deposit_nm."', DepositTm = '".$deposit_tm."', ResultMsg='".$resultmsg."', mrtn='".$mtonet_allmsg."' WHERE Oid = '".$oid."' AND tid = '".$tid."'";


	sql_query($strSQL);

	//'//카드 결제 이거나 가상결제 입금시
		If ($deposit_tm<> ""){
				
					
					//'##########  충전 처리 시작  ##########
						 insert_point($Rs["mb_id"], $coin, '무통장입금(가상계좌)', '@member', $Rs["mb_id"], '무통장입금(가상계좌) :'.$oid);
					//'##########  충전 처리 끝  ##########

					//	'=========  엠투넷 처리부분  =============
						if($row["mtonet"]==""){
								
								$data	= '{"amt": "'.$coin.'"}';		
								$murl = "memb-mgr";
								$jresult = send_mjson1($murl, $data, 'PUT', $Rs["mb_1"]);
								if($jresult["req_result"]=="00"){ /// 성공
									$isql = "update saju_payment set mtonet='코인충전성공' where Oid='".$oid."'";
									 sql_query($isql);
								}else{ /// 등록실패
									  $isql = "update saju_payment set mtonet='코인충전실패' where Oid='".$oid."'";
									  sql_query($isql);
								}
						}
					//	'=========  엠투넷 처리부분  =============


					// 카톡 알림 발송 //
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
							$bizmsg = new bizmsg();
								$bizmsg->phn                = $Rs["mb_hp"];
								$bizmsg->at_type            = '입금확인'; //
								$bizmsg->usr_name     = $Rs["mb_name"];
								$bizmsg->goods_name           = '코인결제';  // 상품명
								$bizmsg->usr_bank_price           = $amount;  /// 입금액
								$rr = $bizmsg->send(); 
						   // 카톡 알림 발송끝 //
						   
	}
}
?>