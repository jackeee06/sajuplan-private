<?php 
include_once('../common.php'); 
#############################################

$mb_id	 = $_REQUEST["mb_id"];
$oid	= $_REQUEST["oid"];

$mb = get_member($mb_id);
		if(!$mb["mb_id"]){	
		?>
				<script>
					alert("회원 정보가 없습니다.");
					location.href = "/";
				</script>
		<?
		}


$strSQL = "SELECT *  FROM saju_payment WHERE Oid = '".$oid."'";
$rs = sql_fetch($strSQL);

if($rs["Oid"]){
	If($rs["PayMethod"] == "DIR_CARD") { //		'//카드결제 일때..
		//		Response.write "카드결제"
	}else{ //가상결제 일때...


				$key = array_search($rs["BankCd"], $bankName);
				$bank_name = $key;


				// 페이지 제목 
				$g5['title'] = "코인 가상계좌";  
				include_once(G5_THEME_MOBILE_PATH.'/head.php');
				?>

				<div id="wrap" class="">
					<div class="pop_coin_bank">
						<h3>가상계좌 코인충전 신청</h3>
						<div class="pop_con">
							<div class="section_inner">
								<strong class="txt">입금하실 가상계좌 확인</strong>
																
								<div class="account_notice" id="account_notice">
								
								<ul>
									<li>
										<span class="txt1">계좌정보</span>
										<span class="txt2" id="bankcode"><?=$bank_name?> <?=$rs["VrNo"]?></span>
									</li>
									<li>
										<span class="txt1">입금금액</span>
										<span class="txt2" id="amt"><?=number_format($rs["Amount"])?></span>
									</li>
									<li>
										<span class="txt1">결제시간</span>
										<span class="txt2" id="amt"><?=$rs["od_time"]?></span>
									</li>
								</ul>
								<div class="txt_wrap">
									<em>입금 즉시 결제 금액 확인 및 코인이 충전 됩니다.</em>
									<span>※ 위 가상계좌는 신청 하신 후 24시간 동안만 유효 합니다.</span>
								</div>
								
							</div>

							</div>
						</div>
					   
					</div>

				</div>
				<?
				}

}Else{		//'//주문정보가 없다면... 

?>
	<script>
		alert("주문정보가 없습니다.");
		location.href = "/";
	</script>

<?
}
?>