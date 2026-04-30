<?php
require_once './_common.php';
check_demo();
#########################################


if(count($_REQUEST)){

	$dsql = "delete from account_config";
	@sql_query($dsql);

	for($i=1;$i<=5;$i++){

		$it_price = "";
		//$it_point = "";
		$it_spoint = "";
		$it_tpoint = "";
		$it_msg = "";

		$it_price = preg_replace("/[^0-9]/", "", $_REQUEST["it_price_".$i]);
		//$it_point = preg_replace("/[^0-9]/", "",$_REQUEST["it_point_".$i]);
		$it_spoint = preg_replace("/[^0-9]/", "",$_REQUEST["it_spoint_".$i]);
		$it_tpoint = preg_replace("/[^0-9]/", "",$_REQUEST["it_tpoint_".$i]);
		$it_msg = $_REQUEST["it_msg_".$i];
			
		$product_id = $i;

		$sql = "insert into account_config(`product_id`, `price`, `point`, `bonus_percent`, `total_point`, `message`)values('".$i."', '".$it_price."', '".$it_point."', '".$it_spoint."', '".$it_tpoint."', '".$it_msg."')";
		@sql_query($sql);
	}
}

goto_url('/adm/coin_pay_form.php');
?>