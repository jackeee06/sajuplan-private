<?php
  include_once('./_common.php');

  $query = "
  select
   *
  from
   g5_member
  where
   mb_no = '{$_POST['mb_no']}'
  ";
  $row = sql_fetch($query);

  //$telno   = !empty($_POST['tel_']) ? $_POST['tel_'] : $row['mb_hp'];
  $data    = '{"telno":"'.$member['mb_hp'].'","csrid":"'.$row['mb_1'].'"}';
  $murl    = "etc-mgr";
  $jresult = send_m2n_rev_call($murl, $data, 'PUT');
  echo json_encode(
    [
     'mb_no'     => $_POST['mb_no'],
     'data'      => $jresult
    ]
  );


  function send_m2n_rev_call($murl, $data, $mode, $mb_1=""){
    global $CPID, $headerKey;
    $url = "http://passcall.co.kr:25205/".$murl."/".$CPID."/drconn";
    $header = array('Content-Type: application/json', sprintf('Authorization: %s', $headerKey) );
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    // 아래 POST:insert, PUT:update, DELETE:삭제, GET:조회
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST , $mode);
    $response = curl_exec($ch);
    curl_close($ch);
    $retjson = json_decode($response,true);

    return $retjson;

}




  // '{"telno":"0101112222","csrid":"00203","etc":{"test1":"testabcd","test2":"test222"}}' -H
  // 'Content-Type: application/json' -H 'Authorization: 6233e926998241790d3500d4'
  // http://localhost:25205/etc-mgr/0001/drconn
  // 결과) {"req_result":"00","resultmessage":"성공","telno":"0101112222","csrid":"00203"}

?>