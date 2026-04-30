<?php 
include_once('../common.php'); 
#############################################


$oid = $_REQUEST["oid"]; //						'요청사부여주문번호(필수)
$cpid = $_REQUEST["cpid"]; //						'본서비스 제공자가 부여한 CP사의 ID(필수)
$membid = $_REQUEST["membid"]; //					'본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수)
$req_result = $_REQUEST["req_result"]; //				'결과코드(0000이면 성공 아니면 실패)
$amount = $_REQUEST["amount"]; //					'결제대상금액(필수)
$resultmsg = $_REQUEST["resultmsg"]; //				'결과메시지
$telno = $_REQUEST["telno"]; //						'회원전화번호(옵션)


$paytype= $_REQUEST["paymethod"]; //					'결제유형코드  DIR_CARD : 카드  VRBANK_PAY : 가상결제

 $coin = $amount;						
 $coin = chg_point_pay($amount);
 

  $mode = "";	
  $findme   = 'PC';

  $pos = strpos($paytype, $findme);
  if ($pos === false) {
		$mode = "mobile";
  } else {
		$mode = "pc";
  }

    $data	= '{"membid": "'.$membid.'", "amount":"'.$amount.'", "coinamt":"'.$coin.'"}';		
	$murl = "cptl/autopay/gnrc_autopay_request";
	$jresult = send_mjson_auto_pay($murl, $data, 'POST', '');




	if($jresult["req_result"] == "00"){ //		'//오류가 아닐때..
	?>
		<script>
			alert('결제완료!');
		   var mode = "<?=$mode?>";
			var paymathod = "<?=$paytype?>";
			var item_name = "<?=$amount?>포인트";
			var item_id = "<?=$oid?>";
			var price = "<?=$amount?>";
			var order_id = "<?=$oid?>";

			//g4_purchase(order_id, price, item_id, item_name);

			var VrNo = "<?=$VrNo?>";
				window.onload = function(){

						
						if(mode=="pc"){
							if (paymathod !="GNR_VRBANK" && paymathod !="VRBANK_PAY" && paymathod !="GNR_MOB_PAVC" && paymathod !="GNR_PC_PAVC") {
								if(window.opener){
									window.opener.location.href="/coin/coin_history.php?mode=purchase&order_id="+order_id+'&price='+price+'&item_id='+item_id+'&item_name='+item_name;
									window.close();
								}else{
									window.location.href='/coin/coin_history.php?mode=purchase&order_id='+order_id+'&price='+price+'&item_id='+item_id+'&item_name='+item_name;
								}
							} else {
									location.href = "/coin/coin_pay_result.php?oid=<?=$oid?>&mb_id=<?=$mb_id?>&mode=purchase&order_id="+order_id+"&price="+price+"&item_id="+item_id+"&item_name="+item_name;	
							}
						}else{
							if (paymathod !="GNR_VRBANK" && paymathod !="VRBANK_PAY" && paymathod !="GNR_MOB_PAVC" && paymathod !="GNR_PC_PAVC") {
								location.href = "/bbs/point.php?mode=purchase&order_id="+order_id+"&price="+price+"&item_id="+item_id+"&item_name="+item_name;	
							} else {
								location.href = "/coin/coin_pay_result.php?oid=<?=$oid?>&mb_id=<?=$mb_id?>&mode=purchase&order_id="+order_id+"&price="+price+"&item_id="+item_id+"&item_name="+item_name;
							}
						
						}
				}
			</script>

		<?	
	}else{ //	'//결제 오류 일때..


		alert($jresult["resultmessage"].' 결제실패! 다시확인해주세요.', '/coin/coin_fill.php');
		exit;
	}
?>
