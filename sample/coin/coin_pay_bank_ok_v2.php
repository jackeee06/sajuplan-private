<?php 
include_once('../common.php'); 
#############################################

$jsondata = file_get_contents('php://input');

$arr = json_decode($jsondata,true);


$arrlen = count($arr);

if ($jsondata) {
	$mtonet_allmsg = addslashes($jsondata); 
	$req_result = $arr["req_result"];
	$isql       = "insert into pay_end_t( `message`,`req_result`,`wdate` )values('" . addslashes($jsondata) . "','" . $req_result . "',now())";
	@sql_query($isql);
}

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

	$req_result = $arr["req_result"];
	$paytype = isset($arr["paytype"]) ? $arr["paytype"] : '';
	$msg = isset($arr["msg"]) ? $arr["msg"] : '';

	if($req_result == "0000"){ // 오류가 아닐때

		// 기존 결제 건 조회
		$sql = "select * from saju_payment where Oid = '".$oid."' AND tid = '".$tid."'";
		$row = sql_fetch($sql);

		// [20260304] CANCEL_PAY는 결제 취소 콜백이므로 충전 처리 안 함
		if($msg === 'CANCEL_PAY'){
			$strSQL = "UPDATE saju_payment SET ResultMsg='결제취소', mrtn = '".$mtonet_allmsg."' WHERE Oid = '".$oid."' AND tid = '".$tid."'";
			sql_query($strSQL);

		} else {

			// [20260304] 가상계좌 여부 판별
			$is_vrbank = (strpos($paytype, 'VRBANK') !== false);

			// [20260304] 중복 충전 방지
			// - 가상계좌: coin_pay_ok_v2에서 발급 시 이미 od_status='2'로 세팅하므로
			//             od_status로 걸러지면 안 됨 → mtonet으로만 중복 체크
			// - 일반결제: od_status='2'이면 이미 완료건
			if (!$is_vrbank && $row["od_status"] == "2") {
				// 일반결제: 이미 처리 완료된 건이므로 스킵

			} elseif ($is_vrbank && $row["mtonet"] == "코인충전성공") {
				// 가상계좌: 이미 충전 완료된 건이므로 스킵

			} else {

				$sql = "SELECT * FROM g5_member WHERE mb_1 = '".$membid."'";
				$Rs = sql_fetch($sql);

				if($Rs["mb_id"]){

					// 금액에 따라 코인 갯수 다름.
					$coin = chg_point_pay($amount);

					$resultmsg = "";
					if((int)$amount == (int)$row["Amount"]){
						$resultmsg = "입금완료";
					}elseif((int)$amount < (int)$row["Amount"]){
						$resultmsg = "부분입금";
					}else{
						$resultmsg = "입금완료";
					}

					// saju_payment UPDATE (Coin_Amount, od_status 포함)
					$strSQL = "UPDATE saju_payment SET 
						BankCd = '".$bankcd."', 
						DepositNm = '".$deposit_nm."', 
						DepositTm = '".$deposit_tm."', 
						Coin_Amount = '".$coin."',
						ResultMsg = '".$resultmsg."', 
						od_status = '2',
						mrtn = '".$mtonet_allmsg."' 
						WHERE Oid = '".$oid."' AND tid = '".$tid."'";
					sql_query($strSQL);

					// [20260304] 가상계좌(VRBANK)는 deposit_tm 있어야 실입금, 일반결제는 바로 통과
					if ($is_vrbank && $deposit_tm == "") {
						// 가상계좌 발급 시점 콜백 → 입금 전이므로 충전 안 함

					} else {

						// [20260406] 중복 충전 방지: 원자적(atomic) UPDATE로 동시 콜백 경쟁 상태 방지
						// SELECT 후 체크 방식은 동시 요청 시 둘 다 통과하므로, UPDATE WHERE 조건으로 한 건만 처리
						$lock_sql = "UPDATE saju_payment SET mtonet='충전처리중' WHERE Oid = '".$oid."' AND tid = '".$tid."' AND (mtonet IS NULL OR mtonet = '' OR mtonet NOT IN ('코인충전성공','코인충전실패','충전처리중'))";
						sql_query($lock_sql);
						$lock_affected = mysqli_affected_rows($g5['connect_db']);

						if ($lock_affected > 0) {

							//'##########  충전 처리 시작  ##########
							insert_point($Rs["mb_id"], $coin, '코인충전', '@member', $Rs["mb_id"], '코인충전 :'.$oid);
							//'##########  충전 처리 끝  ##########

							//	'=========  엠투넷 처리부분  =============
							$data = '{"amt": "'.$coin.'"}';		
							$murl = "memb-mgr";
							$jresult = send_mjson1($murl, $data, 'PUT', $Rs["mb_1"]);
							if($jresult["req_result"] == "00"){ /// 성공
								$isql = "update saju_payment set mtonet='코인충전성공' where Oid='".$oid."'";
								sql_query($isql);
							}else{ /// 등록실패
								$isql = "update saju_payment set mtonet='코인충전실패' where Oid='".$oid."'";
								sql_query($isql);
							}
							//	'=========  엠투넷 처리부분  =============

							// 카톡 알림 발송 //
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
							include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
							$bizmsg = new bizmsg();
							$bizmsg->phn                = $Rs["mb_hp"];
							$bizmsg->at_type            = '입금확인';
							$bizmsg->usr_name           = $Rs["mb_name"];
							$bizmsg->goods_name         = '코인결제';  // 상품명
							$bizmsg->usr_bank_price     = $amount;  /// 입금액
							$rr = $bizmsg->send(); 
							// 카톡 알림 발송끝 //

						} // end 원자적 중복 충전 방지

					} // end 가상계좌 deposit_tm 체크
				} // end if($Rs["mb_id"])
			} // end 중복 충전 방지
		} // end CANCEL_PAY else
	} // end if($req_result == "0000")
} // end if($arrlen > 0)
?>