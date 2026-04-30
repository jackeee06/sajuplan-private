<?php 
include_once('../common.php'); 
#####################################

$jsondata = file_get_contents('php://input');
$arr = json_decode($jsondata,true);

$arrlen = count($arr);

if($arrlen > 0){
	foreach($arr as $key=>$value){
		$$key = $value;
	}

	if($req_result=="0000"){ /////////////////////////////// 자동 결제 정보가 들어올때 /////////////////////////////////////////////////////

	
		$sql = "select count(*) as ct from saju_payment where Oid='".$oid."'";
		$ow = sql_fetch($sql);
		$ocnt = $ow["ct"];
		
		if ($ocnt <=0){

			$strSQL = "SELECT * FROM g5_member WHERE mb_1 = '".$membid."'";
			$mrow=sql_fetch($strSQL);

			$mb_id = $mrow["mb_id"];

			if($membid){ //		'//회원정보 추출		
				
		
				$strSQL ="INSERT INTO saju_payment (mb_id, Membid, PayMethod, Oid, Tid, Amount, Coin_Amount, ReqResult, ResultMsg, TelNo, BankCd, banknm,VrNo, DepositNm, DepositTm, od_time, mrtn) VALUES ('".$mrow["mb_id"]."', '".$membid."', '".$paytype."', '".$oid."', '".$tid."', '".$amount."', '".$coinamt."', '".$req_result."', '".$resultmsg."', '".$telno."', '".$BankCd."', '".$BankNm."', '".$VrNo."', '".$DepositNm."', '".$DepositTm."', now(), '".$reason."')";
				sql_query($strSQL);
				$no = sql_insert_id();

				if($no){
						insert_point($mrow["mb_id"], $coinamt, '등록카드 코인충전', '@member', $mrow["mb_id"], '자동카드결제 :'.$oid);

						$isql = "update saju_payment set mtonet='등록카드 자동코인충전성공' where no='".$no."'";
						sql_query($isql);
								
							// 카톡 알림 발송 //
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
							$bizmsg = new bizmsg();
								$bizmsg->phn                = $mrow["mb_hp"];
								$bizmsg->at_type            = '입금확인'; //
								$bizmsg->usr_name     = $mrow["mb_name"];
								$bizmsg->goods_name           = '등록카드자동코인결제';  // 상품명
								$bizmsg->usr_bank_price           = $amount;  /// 입금액
								$rr = $bizmsg->send(); 
						   // 카톡 알림 발송끝 //	
				}
		}
	}	
	
	}///////////////////////////////////////////////////////////////////////// 자동 결제 정보가 들어올때 끝 //////////////////////////////////////////////

}
ob_flush();
ob_end_clean();
?>