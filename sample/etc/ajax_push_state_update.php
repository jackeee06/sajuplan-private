<?
include_once "../common.php"; 
$g5['title'] = 'global taxi';
#######################################################

$id       = $_REQUEST["id"];
$push_chk = ""; 

if($id=="push_all"){
	$push_all = $member["push_all"];
	if($push_all=="Y"){
		$sql  ="update g5_member set push_all='N' where mb_id='".$member["mb_id"]."'";
        $push_all = "N";
	}else{
		$sql  ="update g5_member set push_all='Y' where mb_id='".$member["mb_id"]."'";
        $push_all = "Y";
	}
}

@sql_query($sql);

// 개인정보를 SEND...
echo json_encode(['data'=>$member,'push_chk' => $push_all]);


// 1.생년월일 채널 OFF (현재 생년월일 반환)
// 2.회원의 현재 채널 ON
// 3.기존 채널들은 OFF처리 하기

?>

