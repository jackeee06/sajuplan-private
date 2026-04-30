<?php 
include_once('../common.php'); 
#############################################



	$tid = $_REQUEST["tid"]; //						'거래코드(결제사제공)
	$oid = $_REQUEST["oid"]; //						'요청사부여주문번호(필수)
	$cpid = $_REQUEST["cpid"]; //						'본서비스 제공자가 부여한 CP사의 ID(필수)
	$membid = $_REQUEST["membid"]; //					'본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수)
	$req_result = $_REQUEST["req_result"]; //				'결과코드(0000이면 성공 아니면 실패)
	$amount = $_REQUEST["amount"]; //					'결제대상금액(필수)
	$resultmsg = $_REQUEST["resultmsg"]; //				'결과메시지
	$telno = $_REQUEST["telno"]; //						'회원전화번호(옵션)
	$paytype= $_REQUEST["paytype"]; //					'결제유형코드  DIR_CARD : 카드  VRBANK_PAY : 가상결제


	////가상계좌
	$BankCd= $_REQUEST["BankCd"]; //					'은행코드
	$VrNo= $_REQUEST["vrno"]; //						'가상계좌번호
	$DepositNm = $_REQUEST["deposit_nm"]; //				'입금자명
	$DepositTm = $_REQUEST["deposit_tm"]; //				':입금일시(yyyyMMddhhmmss), 


	$Coin_Amount	= $_REQUEST["Coin_Amount"];

	
	

	if($paytype == "VRBANK_PAY"){ //			'//가상결제시 주문앞번호에 은행코드를 받음 BK00_주문번호
		$BankCd1 = explode("_",$oid);
		$BankCd =$BankCd1[0];
	}


	If($req_result == "0000"){ //		'//오류가 아닐때..

		$sql = "select count(*) as ct from saju_payment where Oid='".$oid."'";
		$ow = sql_fetch($sql);
		$ocnt = $ow["ct"];

		If ($ocnt <=0){ 

			$strSQL = "SELECT * FROM g5_member WHERE mb_1 = '".$membid."'";
			$mrow=sql_fetch($strSQL);

			$mb_id = $mrow["mb_id"];

			If($membid){ //		'//회원정보 추출		
				
				// 회원가입 포인트 부여
						  $coin = $amount;

						  // 금액에 따라 코인 갯수 다름.
						  if($amount=="30000"){
							  
						  }elseif($amount=="50000"){
							$coin = (50000*0.02)+50000;

						  }elseif($amount=="100000"){
							  $coin = (100000*0.04)+100000;
						  }elseif($amount=="200000"){
							  $coin = (200000*0.06)+200000;
						  }elseif($amount=="300000"){
							  $coin = (300000*0.08)+300000;
						  }
				
				$strSQL ="INSERT INTO saju_payment (mb_id, Membid, PayMethod, Oid, Tid, Amount, Coin_Amount, ReqResult, ResultMsg, TelNo, BankCd, VrNo, DepositNm, DepositTm, od_time) VALUES ('".$mrow["mb_id"]."', '".$membid."', '".$paytype."', '".$oid."', '".$tid."', '".$amount."', '".$coin."', '".$req_result."', '".$resultmsg."', '".$telno."', '".$BankCd."', '".$VrNo."', '".$DepositNm."', '".$DepositTm."', now())";
				
				sql_query($strSQL);
				
				$no = sql_insert_id();



							if($paytype == "DIR_CARD"|| $paytype == "GNR_MOB_PACA" || $paytype="GNR_PC_PACA"){

									 insert_point($mrow["mb_id"], $coin, '카드결제 코인충전', '@member', $mrow["mb_id"], '카드결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}

									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //
							
							}elseif($paytype == "GNR_MOB_PANP" || $paytype == "GNR_PC_PANP"){

									 insert_point($mrow["mb_id"], $coin, '네이버포인트', '@member', $mrow["mb_id"], '네이버포인트 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}

									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //
							}elseif($paytype == "PAYCO_PAY" || $paytype == "GNR_MOB_PACP" || $paytype == "GNR_PC_PACP"){

									insert_point($mrow["mb_id"], $coin, '페이코결제 코인충전', '@member', $mrow["mb_id"], '페이코결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //
							}elseif($paytype == "KAKAO_PAY" || $paytype == "GNR_MOB_PAKM" || $paytype == "GNR_PC_PAKM"){

									insert_point($mrow["mb_id"], $coin, '카카오페이결제 코인충전', '@member', $mrow["mb_id"], '카카오페이결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //
							}elseif($paytype == "NAVER_PAY"){

									insert_point($mrow["mb_id"], $coin, '네이버페이결제 코인충전', '@member', $mrow["mb_id"], '네이버페이결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //

							}elseif($paytype == "GNR_MOB_PATK" || $paytype == "GNR_PC_PATK"){

									insert_point($mrow["mb_id"], $coin, '상품권결제 코인충전', '@member', $mrow["mb_id"], '상품권결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //

							
							}elseif($paytype == "GNR_MOB_PABK" || $paytype == "GNR_PC_PABK"){

									insert_point($mrow["mb_id"], $coin, '계좌이체 코인충전', '@member', $mrow["mb_id"], '계좌이체결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //

							}elseif($paytype == "GNR_MOB_PAMC" || $paytype == "GNR_PC_PAMC"){

									insert_point($mrow["mb_id"], $coin, '휴대폰결제 코인충전', '@member', $mrow["mb_id"], '휴대폰결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //

							}elseif($paytype == "GNR_MOB_PAPT" || $paytype == "GNR_PC_PAPT"){

									insert_point($mrow["mb_id"], $coin, '포인트결제 코인충전', '@member', $mrow["mb_id"], '포인트결제 :'.$oid);
									 //echo "asdfasdafsd";
									//	'=========  엠투넷 처리부분  =============
											$data	= '{"amt": "'.$coin.'"}';		
											$murl = "memb-mgr";
											$jresult = send_mjson1($murl, $data, 'PUT', $mrow["mb_1"]);
											if($jresult["req_result"]=="00"){ /// 성공
												$isql = "update saju_payment set mtonet='코인충전성공' where no='".$no."'";
												 sql_query($isql);
											}else{ /// 등록실패
												  $isql = "update saju_payment set mtonet='코인충전실패' where no='".$no."'";
												  sql_query($isql);
											}
									//	'=========  엠투넷 처리부분  =============


										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금확인'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //

							}else{ //// 무통장 입금

										// 카톡 알림 발송 //
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
										include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
										$bizmsg = new bizmsg();
											$bizmsg->phn                = $mrow["mb_hp"];
											$bizmsg->at_type            = '입금계좌 안내'; //
											$bizmsg->usr_name     = $mrow["mb_name"];
											$bizmsg->goods_name           = '코인결제';  // 상품명
											$bizmsg->usr_bank_price           = $amount;  /// 입금액
											$bizmsg->usr_bank_num           = $bankName[$BankCd]." ".$VrNo;  /// 입금계좌
											$rr = $bizmsg->send(); 
									   // 카톡 알림 발송끝 //
							
							}
			
		?>
		<script>
			var paymathod = "<?=$paytype?>";
			var VrNo = "<?=$VrNo?>";
				window.onload = function(){
						if (paymathod !="VRBANK_PAY") {
							window.opener.location.href="/";
							window.close();
						} else {
								location.href = "/coin/coin_pay_result.php?oid=<?=$oid?>&mb_id=<?=$mb_id?>";	
						}			
				}
			</script>

		<?
		}else{	//'//회원정보가없을때..	
		?>
	<script>
			alert("회원정보가 없습니다. 다시 확인 해 주시기 바랍니다.\n req_result : <?=$req_result?>\nresultmsg:<?=$resultmsg?>");
			location.href = "/";
	</script>

	<?		
		}//'회원정보 판별 끝
	}else{ //	'//중복 주문정보 확인
?>
<script>
var paymathod = "<?=$paytype?>";
var VrNo = "<?=$VrNo?>";
	window.onload = function(){
			alert("이미 결제 되었습니다.");
			if paymathod !="VRBANK_PAY") {
				window.opener.location.href="/";
				window.close();
			} else {
				window.opener.location.href="/";
			}			
	}
</script>
<?
	}//		'//중복 주문정보 확인
	
	}else{ //	'//결제 오류 일때..
		//echo $req_result. "<br>";
		//echo $resultmsg . "<br>";

		alert($resultmsg, '/coin/coin_fill.php');
		exit;
	}
?>
