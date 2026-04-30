<?php 
include_once('../common.php'); 
################################################################### 

if(!$member["mb_id"]){
	alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}


$membid = $_REQUEST["membid"];

if($membid){
	$sql = "select * from g5_member_auto_pay where membid='".$membid."'";
	$row = sql_fetch($sql);
	$no = $row["no"];
}


$data	= '{"membid":"'.$membid.'"}';	
$murl = "cptl/autopay/gnrc_autopay_delete";
$jresult = send_mjson_auto_pay($murl, $data, 'POST', '');




if($jresult["req_result"]=="00"){ /// 성공
		
		$data = '{"membnm":"'.$membnm.'", "telno":"'.$telno.'","autopaypin":"'.$row["billkey"].'", "autopayamt":'.$amount.', "autopaycoinamt":'.$coinamt.', "autopaypushurl":"'.$pushurl.'", "autopayflag":"N"}';
		$murl1 = "memb-mgr";
		$jresult1 = send_mjson($murl1, $data, 'PUT', $membid);
		if($jresult1["req_result"]=="00"){ /// 등록성공
		}

		$dsql = "delete from g5_member_auto_pay where no='".$no."'";
		$dtn = sql_query($dsql);
		if($dtn){

			echo "<script>alert('카드삭제완료');location.href='/coin/coin_fill.php';</script>";
			//alert('카드삭제완료', '/coin/coin_fill.php');
			exit;
		}
	}else{
	

		echo "<script>alert('카드삭제실패');location.href='/coin/coin_fill.php';</script>";
			//alert('카드삭제완료', '/coin/coin_fill.php');
			exit;
	
	/////////////// 앰투넷에 카드등록 보내기 끝 ////////////////////////////
 }

?> 