<?php 
  include_once('../common.php');

  echo "---------------API 연동 확인------------------";
  



  //238817
//   $csr_res = get_crs_mgr_search("238817");
//   function get_crs_mgr_search($csr_id){ //상담사 조회 기능

//     $headerKey = "6233e926998241790d3500d4";
//     $CPID      = "0006";//회원사코드
//     $apiUrl    = "http://passcall.co.kr:25205/csr-mgr/{$csr_id}";
//     $header    = array(
//       'Content-Type: application/json', 
//        sprintf('Authorization: %s', $headerKey) 
//     );

//     $listData = [
//         ["csrid" => "00006"],
//         ["csrnm" => "238817"]
//     ];

//     // 테스트 API 요청
//     $payload = json_encode([
//         "list" => $listData
//     ]);


//     $ch = curl_init($apiUrl);
//     curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET'); // GET이지만 body 포함
//     curl_setopt($ch, CURLOPT_POSTFIELDS, $payload); // GET임에도 body 세팅
//     curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
//     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//     curl_setopt($ch, CURLOPT_TIMEOUT, 20);
//     $response  = curl_exec($ch);
//     curl_close($ch);
//     $rtn = json_decode($response, true);

//     // echo "<br>";
//     // var_dump($rtn);
//     // echo "</br>";

//   }

//   $result  = true;
//     $msg     = "";
//     $token   = getPortOneToken();
//     $url     = PORTONE_API_URL."/platform/companies/".$store_number."/state";

//     $headers = array(
//       'Content-Type: application/json',
//       'Authorization: Bearer ' . $token['token']
//     );

//     $ch = curl_init($url);
//     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
//     curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
//     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//     curl_setopt($ch, CURLOPT_HTTPGET, true); // GET 요청
//     curl_setopt($ch, CURLOPT_TIMEOUT, 20);
//     $response  = curl_exec($ch);
//     // $error_msg = curl_error($ch);
//     curl_close($ch);
//     $rtn = json_decode($response, true);
//     if($rtn['type'] == "UNAUTHORIZED"){
//        $result = false;
//        $msg    = "인증에 실패 하였습니다.";
//     }
//     if(!$rtn && $result){
//        $result = false;
//        $msg    = "요청에 실패 하였습니다.";
//     }

//     if($rtn['type'] == "INVALID_REQUEST" && $result){
//        $result = false;
//        $msg    = "사업자정보가 올바르지 않습니다.";
//     }
//     if($rtn['companyVerificationId'] == "" && $result){
//        $result = false;
//        $msg    = "요청에 실패 하였습니다.";
//     }
//     return array(
//        'result' => $result,
//        'msg'    => $msg,
//        'data'   => $rtn
//     );
  


?>