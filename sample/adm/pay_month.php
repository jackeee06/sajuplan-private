<?php
$sub_menu = "350500";
include_once("./_common.php");
check_demo();
auth_check_menu($auth, $sub_menu, "d");
##################################################


$startday = date("Y-m",strtotime("-1 month"))."-01 00:00:00";
$endday = date("Y-m",time())."-01 00:00:00";

/// 월 정산금액이 없으면 정산하지 않습니다. ///
$sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";

	$result = sql_query($sql);
	if($result){
		while($row = sql_fetch_array($result)){
			set_con_account($row["mb_id"]);
		}
}

?>

<script>
var start = "<?=$startday?>";
var end = "<?=$endday?>";
alert(start+'~'+end+'까지 정산완료');
window.self.close();
</script>



