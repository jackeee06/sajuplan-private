<?php 
include_once('../common.php'); 
#####################################

// 1. 원시 JSON 입력 받기
$jsondata = file_get_contents('php://input');

// 3. JSON 파싱
$arr = json_decode($jsondata, true);

// 5. list의 요소 수 카운트
if (isset($arr["list"]) && is_array($arr["list"])) {
    $arrlen = count($arr["list"]);
  //  echo "<p>list 항목 수: " . $arrlen . "</p>";
} 


if($arrlen > 0){
	for($i=0;$i<$arrlen;$i++){
		$csr_id = $arr["list"][$i]["csrid"];
		$state = $arr["list"][$i]["state"];

		$sql = "select * from g5_member where mb_1='".$csr_id."'";
		$row = sql_fetch($sql);

    //if($state == 'CNCH') $state= 'CONN'; 20251215
    //if($state == 'RDVC') $state= 'IDLE'; 20251215
		if($row["mb_id"] && $state != 'RDVC'){
		//if($row["mb_id"]){

			$mb = get_csrid($csr_id);
			set_resv_alrm($row["mb_id"], $state);
			$usql = "update g5_member set state='".$state."' where mb_id='".$mb["mb_id"]."'";
			@sql_query($usql);
			set_constate($mb["mb_id"], $state);  /// 기록을 남긴다
		}
	}

}

ob_flush();
ob_end_clean();

?>