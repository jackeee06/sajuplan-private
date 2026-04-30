<?php 
include_once('../common.php'); 
################################################################### 

if(!$member["mb_id"]){
	alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}


$membid = $_REQUEST["membid"];
$membnm = $member["mb_name"];//'회원명(옵션)
$amount=$_REQUEST["amount"];
$coinamt=$_REQUEST["coinamt"];
$telno=$_REQUEST["telno"];
$mode=$_REQUEST["mode"];




$pushurl = "https://sajumoon.co.kr/mtonet/auto_pay_result.php";
$sql = "select * from g5_member_auto_pay where mb_id='".$member["mb_id"]."' or membid='".$membid."'";
$row = sql_fetch($sql);

if($row["billkey"]){

if($mode!="auto_del"){
	/////////////// 앰투넷에 회원 정보 수정 //////////////////////////
			$data = '{"membnm":"'.$membnm.'", "telno":"'.$telno.'","autopaypin":"'.$row["billkey"].'", "autopayamt":'.$amount.', "autopaycoinamt":'.$coinamt.', "autopaypushurl":"'.$pushurl.'", "autopayflag":"Y"}';
			$murl1 = "memb-mgr";
			$jresult1 = send_mjson($murl1, $data, 'PUT', $membid);
			if($jresult1["req_result"]=="00"){ /// 등록성공
						if($row["no"]){ //////////////////////////// 기존에 등록된 카드가 있으면? update
							$usql = "update g5_member_auto_pay set amount='".$amount."' , coinamt='".$coinamt."', membid='".$membid."', telno='".$telno."', pushurl='".$pushurl."', autopayflag='Y' where no='".$row["no"]."'";
							sql_query($usql);
						}
					?>
					<script>
					alert('자동충전 설정완료!');
					location.href='/coin/coin_fill_auto.php';
					</script>
					
					<?
					exit;
			}
	/////////////// 앰투넷에 회원정보 수정 ////////////////////////////
}else{
	
	/////////////// 앰투넷에 회원 정보 수정 //////////////////////////
				$amount = "0";
				$coinamt = "0";
				$pushurl='';

				$data = '{"membnm":"'.$membnm.'", "telno":"'.$telno.'","autopaypin":"'.$row["billkey"].'", "autopayflag":"N"}';
				$murl1 = "memb-mgr";
				$jresult1 = send_mjson($murl1, $data, 'PUT', $membid);
				if($jresult1["req_result"]=="00"){ /// 등록성공
							if($row["no"]){ //////////////////////////// 기존에 등록된 카드가 있으면? update
								$usql = "update g5_member_auto_pay set autopayflag='N' where no='".$row["no"]."'";
								sql_query($usql);
							}
						?>
						<script>
						alert('자동충전 해제완료!');
						location.href='/coin/coin_fill_auto.php';
						</script>						
						<?
						exit;
				}
		/////////////// 앰투넷에 회원정보 수정 ////////////////////////////

}


}
?> 