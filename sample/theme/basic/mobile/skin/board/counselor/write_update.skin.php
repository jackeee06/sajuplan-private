<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

$wr_5 = "$wr5[0]|$wr5[1]|$wr5[2]|$wr5[3]|$wr5[4]|$wr5[5]|$wr5[6]|$wr5[7]|$wr5[8]|$wr5[9]|$wr5[10]|$wr5[11]|$wr5[12]|$wr5[13]|$wr5[14]|$wr5[15]|$wr5[16]";
sql_query(" update $write_table set wr_5 = '$wr_5' where wr_id = '$wr_id' ");

$wr_6 = "$wr6[0]|$wr6[1]|$wr6[2]|$wr6[3]|$wr6[4]|$wr6[5]|$wr6[6]|$wr6[7]|$wr6[8]|$wr6[9]|$wr6[10]|$wr6[11]|$wr6[12]|$wr6[13]|$wr6[14]|$wr6[15]|$wr6[16]";
sql_query(" update $write_table set wr_6 = '$wr_6' where wr_id = '$wr_id' ");


if($tmb_id){
	sql_query("update $write_table set mb_id='".$tmb_id."' where wr_id='".$wr_id."'");
}

// 수정날짜
sql_query(" update $write_table set wr_last = '".G5_TIME_YMD."' where wr_id = '$wr_id' ");

?>



