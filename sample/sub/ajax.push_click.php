<?php
include_once('./_common.php');

$idx     = trim($_REQUEST['idx']);


if ($idx && $member["mb_id"]) {
	$sql = "select  is_view from member_push where idx='".$idx."' and is_view not like '%".$member["mb_id"]."%'";
	$result = sql_query($sql);
	if($result){
		$res = sql_fetch_array($result);
		if($res["is_view"]=="" || $res["is_view"]){ /// 한번도 클릭하지 않았으면? id 업데이트
				if($res["is_view"]){
					$ud  = $res["is_view"].",".$member["mb_id"];
				}else{
					$ud = $member["mb_id"];
				}
				$sql = "update member_push set is_view='".$ud."' where idx='".$idx."'";
				//echo $sql;

				@sql_query($sql);
		}
	}
}
?>