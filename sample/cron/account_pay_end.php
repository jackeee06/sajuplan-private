<!--
#!/usr/bin/php -q
-->

<?php

/*$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";

include_once($DOCUMENT_ROOT."/common.php"); // 메뉴별 공통파일
###############################################


$tmpdate = date("Y-m",time())."-01";

$lastday = date('t', strtotime($tmpdate));

$nowday = date("d",time());

if($nowday==$lastday){
	$sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
	//echo $sql;
	$result = sql_query($sql);
	if($result){
		while($row = sql_fetch_array($result)){
			set_con_account($row["mb_id"]);
		}
	}
}
*/
?>