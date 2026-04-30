<?php
################ 공통 파일 #########################
include_once "../common.php"; 
#########################################



$status = $_REQUEST['status'];
$android_id	=	$_REQUEST['android_id'];
$mb_id = $_REQUEST['mb_id'];
$stkey	= $_REQUEST['stkey'];
$phonenumber	= $_REQUEST['phonenumber'];

$gubun	= $_REQUEST['gubun'];

if(!$gubun){
	$gubun = 1;
}


if($android_id){
	$android_id = urldecode($android_id);
}else{
	echo "error no android_id";
	exit;
}


insert_phone_id($status, $android_id, $mb_id, $phonenumber, $gubun);


function insert_phone_id ($status, $android_id, $mb_id="", $phonenumber, $gubun){


$seque = "select count(*) as cnt from tbl_android_phone where t_android_id='".$android_id."'";
$result = sql_query($seque);

if($result){
	$res= sql_fetch_array($result);
	$count=$res[cnt];
}

if($count <= 0){

	$seque1 = "select count(*) as cnt from tbl_android_phone where t_phone='".$phonenumber."'";
	$result1 = sql_query($seque1);
	if($result1){
		$res1= sql_fetch_array($result1);
		$count1=$res1[cnt];
	}

	if($count1 <=0){
		$que= "insert into tbl_android_phone (t_status, t_android_id, t_phone, t_mb_id, gubun,  t_wdate)values('".$status."','".$android_id."', '".$phonenumber."', '".$mb_id."', '".$gubun."', now())";


		$result = sql_query($que);
		if($result){
			echo "success insert";
		}else{
			echo " error update error";
		}
	}else{
		$que= "update tbl_android_phone set  t_android_id='".$android_id."' where t_phone='".$phonenumber."'";
			$result = sql_query($que);
			if($result){
				echo "success insert";				
			}else{
				echo "error update error";
			}
	}

}else{

	$que= "update tbl_android_phone set  t_android_id='".$android_id."' where t_phone='".$phonenumber."'";


	$result = sql_query($que);
	if($result){

		$dsql = "select * from tbl_android_phone where t_phone='".$phonenumber."' and t_android_id!='".$android_id."'";

		$dresult = sql_query($dsql);
		if($dresult){
			while($dres=sql_fetch_array($dresult)){
				if($dres["t_no"]){
					$ddsql = "delete from tbl_android_phone where t_no='".$dres["t_no"]."'";
					@sql_query($ddsql);
				}
			}
		}
		echo "success insert";
	}else{
		echo "error update error";
	}
}


}



?>