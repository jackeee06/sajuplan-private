<?php
include_once("./_common.php");
include_once(G5_LIB_PATH."/register.lib.php");
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

if($_POST['act'] == "get_csr_update"){
   //이미 해당계정에 연동이 되어있다면 X
  $result = true;
  $msg    = "연동되었습니다.";
  $mb_id  = $_POST['mb_id']; 
  $sql    = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
  $mrow   = sql_fetch($sql);
  $mb_1   = "";

  if($mrow['mb_1'] != ""){
    $msg = "이미 등록된 상담사 ID가 있습니다.";
  }
  $data = '{"csrnm":"'.$mrow['mb_name'].'","state":"'.$mrow['state'].'","sortno":'.$mrow['mb_2'].',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mrow["mb_3"]).'","dectm":'.$mrow["mb_5"].',"decamt":'.$mrow["mb_4"].', "preflag":"'.$mrow["mb_6"].'", "chatdectm":'.$mrow["mb_12"].', "chatdecamt":'.$mrow["mb_13"].'}';
  $murl = "csr-mgr";
  $jresult = send_mjson($murl, $data, 'POST');

  if($mb_id && $jresult["req_result"] == "00"){
    if($jresult["csrid"]){
        $update_sql = "update {$g5['member_table']} set mb_1='".$jresult["csrid"]."' where mb_id='".$mb_id."'";
        sql_query($update_sql);
        $mb_1   = $jresult["csrid"];
        $result = true;
        $msg    = "상담사 ID가 연동 되었습니다.";
    }
  }else{
    $result = false;
    $msg    = "연동에 실패 하였습니다.";
  }

  $rtn_arr = [
    'result' => $result,
    'msg'    => $msg,
    'mb_id'  => $mb_id,
    'data'   => [
      'mb_1' => $mb_1,
      'jresult' => $jresult
    ]
  ];

  die(json_encode($rtn_arr));

}


?>