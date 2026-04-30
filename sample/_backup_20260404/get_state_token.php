<?php
  include_once('../common.php');


  // 1. 회원 membid와 csrid 값을 받아서 토큰값을 각각의 발급해옴 =====================================================
  //   $res = chat_create_room(MOTONET_TEST_MEMBID,MOTONET_TEST_CSRID);
  //   가상계정을 통화 해서 (채팅은 돼요)

/*
			//	/// 상담사일경우 등록  엠투넷 등록//
			$data = '{"list":[{"csrid":"00233"}]}';

			$murl = "csr-mgr";
			$jresult = send_mjson2($murl, $data, 'GET');

      var_dump($jresult);*/

  //   var_dump($res);

  //   if($res['req_result'] == "00"){
  //     echo "채팅방의 ROOM ID 값 :".$res['roomid']."<br>";
  //     echo "회원 토큰 접속 값    :".$res['membtoken']."<br>";
  //     echo "상담사 회원의 토큰 ID 값 :".$res['csrtoken']."<br>";
  //   }
  // "{"req_result":"00","resultmessage":"ok","roomid":"2hUy9a","membtoken":"2hUy9a1","csrtoken":"2hUy9a2","csrid":"00206","membid":"239895"}"
 

  // 2. 상담사의 채팅 가능/불가 변경  합니다. =================================================================
  // 엠투넷쪽 회신오면 상태값 기입 필요
  // RDCH : 채팅가능상태
  // RDVC : (전화채팅대기+채팅가능상태) => 바꿔야하는것은 확실하다.
  // CNCH : (채팅상담중) (확인못했어요)
  // ABSE : 부재중(전화와 동일)
  // IDLE : (전화상담대기)<<<<< 전화만 쓰시는 업체들은 이상태값을 쓴다
  // IDLE -> (RDVC) -> (CNCH) -> 채팅시작
  // 요금자체는 부과안됨


/*  $res = set_crs_status_chg("00233","RDVC"); //채팅 가능 상태로 변경 및 해제 상태로 변경합니다.
  if($res['req_result'] == "00"){
    echo $res['csrid']."</br>"; // 변경된 상담사의 CSR ID 값
    echo $res['state']."</br>"; // 변경된 상태값 (예 :RDCH)  전역함수로 빼기
  }*/


  //  $res = set_crs_status_chg(MOTONET_TEST_CSRID,"RDVC"); //채팅 가능 상태로 변경 및 해제 상태로 변경합니다.
  //  var_dump($res);
  //  부재중이 되어도 채팅방이 생성되면 채팅이 됨, 전화는 끊킬 가느성이 커보이긴함. 차감되는부분도 확인이 필요해보임.
  //   전화는 막아줘야할듯함.
  //   $res = set_crs_status_chg(MOTONET_TEST_CSRID,"ABSE"); //채팅 가능 상태로 변경 및 해제 상태로 변경합니다.
  //   if($res['req_result'] == "00"){
  //     echo $res['csrid']."</br>"; // 변경된 상담사의 CSR ID 값
  //     echo $res['state']."</br>"; // 변경된 상태값 (예 :RDCH)
  //   }

  // $res = get_chatting_list(MOTONET_TEST_MEMBID,MOTONET_TEST_CSRID);

  //$list['list']
  //var_dump($res);

  foreach ($res['list'] as $item) {

    echo "<br>-------------------------------<br>";
    echo "상담사 발급 ID : ".$item['membid']."<br>";
    echo "상담사 메세지  : ".$item['msg']."<br>";
    echo "작성일자 : ".$item['instm']."<br>";
    if($item['idtp'] == "csr"){
      echo "상담사<br>";
    }else{
      echo "일반회원<br>";
    }
    echo "<br>-------------------------------<br>";
  }

  function send_mjson2($murl, $data, $mode, $mb_1=""){

    $CPID = '0004';
    $headerKey = 'pGXygBXTMNNuRJzCutMYIaAc';

    $apiUrl = "http://passcall.co.kr:32831/";
    if($mode=="POST"){
      $url = $apiUrl.$murl."/".$CPID;
    }elseif($mode=="PUT"){
      $url = $apiUrl.$murl."/".$mb_1;
    }elseif($mode=="DELETE"){
      $url = $apiUrl.$murl."/".$mb_1;
    }elseif($mode=="GET"){
      $url = $apiUrl.$murl."/".$CPID;
    }
    $header = array('Content-Type: application/json', sprintf('Authorization: %s', $headerKey) );
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    // 아래 POST:insert, PUT:update, DELETE:삭제, GET:조회
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST , $mode);
  //	echo $url;
  //	echo "<br>";
  //	print_r($data);
  //	echo $mode;
  //	echo "<br>";
  //	exit;

    $response = curl_exec($ch);
  //	print_r($response);
  //	echo "<br>";
  //
  //	exit;

    curl_close($ch);
    // 결과

    $retjson = json_decode($response,true);

    return $retjson;

  }

  function set_crs_status_chg($crsid,$chg_status){ //상담사 csrid , 변경 코드상태값

      $url = "http://passcall.co.kr:20102/chat-mgr/".MOTONET_CPID;
      $headers = array(
          'Content-Type: application/json',
          'Authorization: ' . MOTONET_CALL_KEY
      );

      $fields = array(
        'cmd'    => 'csrstat',
        'csrid'  => $crsid, // 고객 ID   test_c
        'state'  => $chg_status  // 상담사 ID      
      );

      $ch = curl_init($url);
      curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
      curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
      curl_setopt($ch, CURLOPT_TIMEOUT, 20);
      $response  = curl_exec($ch);
      curl_close($ch);
      $rtn = json_decode($response, true);

      var_dump($rtn);
      return $rtn;

  }

  function chat_create_room($membid,$csrid){
    $url = "http://passcall.co.kr:20102/chat-mgr/".MOTONET_CPID;
    $headers = array(
        'Content-Type: application/json',
        'Authorization: '.MOTONET_CALL_KEY
    );
    $fields = array(
        'cmd'    => 'csrchat',
        'membid' => $membid, // 고객 ID   test_c
        'csrid'  => $csrid  // 상담사 ID      
    );
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_VERBOSE, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
    $response  = curl_exec($ch);
    $rtn       = json_decode($response,true);
    curl_close($ch);
    return $rtn;
  }


  function get_chatting_list($membid,$csrid){
    
    $url = "http://passcall.co.kr:20102/chat-log";
    $headers = array(
        'Content-Type: application/json',
        'Authorization: '.MOTONET_CALL_KEY
    );
    $fields = array(
        'cmd'    => 'getlist',
        'membid' => $membid, // 고객 ID   test_c
        'csrid'  => $csrid   // 상담사 ID      
    );
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_VERBOSE, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
    $response  = curl_exec($ch);
    $rtn       = json_decode($response,true);
    curl_close($ch);
    return $rtn;

  }


?>