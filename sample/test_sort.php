<?php
include_once('../common.php');
################################################

/*
$CPID = "00";//회원사코드
$headerKey = "623500d4";//회원사키
$apiUrl = "http://passcall.co.kr:25/";
$url = $apiUrl."memb-mgr/".$CPID;
*/

//exit;

$CPID = "00";//회원사코드
$headerKey = "pGXygBaAc";//회원사키

// 상담사 상태변경 테스트
$apiUrl = "https://www.the.co.kr/mtonet/mtonet_state.php";

//결제 테스트
//$apiUrl = "https://www.the.co.kr/coin/coin_pay_ok.php";

// 결제테스트
//$apiUrl = "https://www.the.co.kr/mtonet/auto_pay_result.php";


$url = $apiUrl;
$header = array('Content-Type: application/json', sprintf('Authorization: %s', $headerKey) );

//$data = ('{"amt":0,"callid":"6570971","cpid":"0001","csrid":"","direct":"","dtmf
//no":"","end":"","eventtm":"2023-03-18
//05:16:51","from":"0100001111","membid":"","preflag":"","reason":"START_ARS","start":"2023-03-18
//05:16:51","telno":"","to":"50049","usetm":0}');

//$data = ('{"list":[{"csrid":"1554","state":"IDLE"}]}');


//$data = '{"amount":500,"coinamt":600,"cpid":"0001","membid":"000003","membnm":"홍길동","oid":"20000","paytype":"AUTO_PAY_CARD","req_result":"0000","resultmsg":"ok","telno":"0101111111","tid":"2019764","reason":"AUTO_PAY_CARD_IN_CONNECT"}';


//$data = '{"tid":"432423","oid":"313","cpid":"01","membid":"003","vrno":"4321342“,”deposit_nm”:
//”홍길동”,”deposit_tm”:”20210203”,”amount”:100,”bankcd”:”B04”}';


//$data = '{"amount":100,"coinamt":3000, "cpid":"0002","req_result":"0000","resultmsg":"정상처리","membid":"00003","oid":"2030","tid":"2022651PC1067","telno":"01000012222","paytype":"GNR_PC_결제유형"}';


/// 상담사 상태변경 테스트

$data = '{"list":[{"csrid":"17378","state":"IDLE"}]}';



$data = preg_replace('/\r\n|\r|\n/','',$data);


$pdata = json_decode($data,true);



$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($pdata) );
// 바로아래 POST 는 insert 의미임. GET:조회, PUT:update, DELETE:삭제임
curl_setopt($ch, CURLOPT_CUSTOMREQUEST , 'PUT');
$response = curl_exec($ch);
curl_close($ch);



print_r($response);

//echo "--- result----str[\n". $response . "\n";
$retjson = json_decode($response,true);



print_r($retjson);

ob_flush();
ob_end_clean();

?>