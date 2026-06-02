<?php
include_once('./_common.php');
#####################################

$wr_id = $_REQUEST["wr_id"];

if(!$member["mb_id"])exit;

if($wr_id){


	/// 소원 해당 정보를 가져온다.
	$sql = "select * from g5_write_wish where wr_id='".$wr_id."'";
	$row = sql_fetch($sql);

	$nowday = date("Y-m-d",time());

	if($row["wr_4"]==$nowday){ ///////////// 하루에 한번만 누적되게
		echo "하루에 한번만 소원성취 기도가 누적됩니다. 감사합니다!";
		exit;
	}

	
	$end_day = (int)$row["wr_subject"]; /// 기도 만료일
	
	$wish_ing = (int)$row["wr_1"];  /// 기도 진행일
	$wish_ing +=1;

	$point = (int)$row["wr_2"];   /// 누적 포인트

	if($wish_ing>=$end_day){ ////////////////////////////// 소원 만료일이면 // 해당회원 포인트 쏴주고 wr_3 만료한다
		
		$point = $point+100;
				$usql = "update g5_write_wish set wr_1='".$wish_ing."', wr_2='".($point)."',wr_3='end' where wr_id='".$wr_id."' ";
				$rtn = sql_query($usql);
				if($rtn){
					    // 누적 포인트 부여
						insert_point($row["mb_id"], ($point), '소원다락방 소원성취', '@wish', $row["mb_id"], '소원다락방@'.$wr_id);
						echo "소원 달성을 축하드립니다 :)\n당신의 앞길에 꽃길만 가득하길~*\n".($wish_ing)."일(총 ".number_format($point)."원) 포인트 지급";
						exit;
				}
	
	}else{ /////////////////////////// 소원 기도일을 업데이트 한다, 포인트누적, 기도일 +1
		$point = $point+100;

		$usql = "update g5_write_wish set wr_1='".$wish_ing."', wr_2='".$point."', wr_4 = '".date("Y-m-d",time())."' where wr_id='".$wr_id."'";
		$rtn=sql_query($usql);
		
		if($rtn){
			echo $wish_ing."일차 기도가 진행중입니다.(".$point."원 누적 적립)\n사주플랜가 함께 기도합니다!";
			exit;
		}
	}

}