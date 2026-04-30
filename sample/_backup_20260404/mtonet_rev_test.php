<?php

  include_once('../common.php');
  // http://passcall.co.kr:25205/resv-mgr/0001

//   function send_mjson1($murl, $data, $mode, $mb_1=""){

//   global $CPID, $headerKey;
//   $apiUrl = "http://passcall.co.kr:25205/";

    $list_json   = send_api_test();
    $responseArr = json_decode($list_json, true);
    $list = $responseArr['list'] ?? [];

    foreach ($list as $row) {
        echo "CallId: {$row['CallId']}<br>";
        echo "CsrId: {$row['CsrId']} / {$row['CsrNm']}<br>";
        echo "Caller: {$row['Caller']} → {$row['Callee']}<br>";
        echo "시작: {$row['CsStTm']} / 종료: {$row['CsEndTm']}<br>";
        echo "통화시간: {$row['CsDurTm']}초<br>";
        echo "금액: {$row['CsDurAmt']}원<br>";
        echo "금액: {$row['DecTm']}원<br>";
        $message = json_encode($row, JSON_UNESCAPED_UNICODE);
        echo $message."<br>";
        echo "<hr>";

        



    }

    var_dump($list);



    function send_api_test(){

        global $headerKey;

        $url = "http://passcall.co.kr:25205/etc-mgr/0006/result";

        $body = [
            'startdt' => '2025-12-15',
            'enddt'   => '2025-12-16',
            'list' => [
                ['csrid' => '13703'],
                ['csrid' => '15466'],
                ['csrid' => '17389'],
                ['csrid' => '00345'],
                ['csrid' => '15591'],
                ['csrid' => '14831'],
                ['csrid' => '14421'],
                ['csrid' => '18030'],
                ['csrid' => '13540'],
                ['csrid' => '17473']
            ]
        ];

        $headers = [
            'Content-Type: application/json',
            'Authorization: ' . $headerKey
        ];

        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => 'GET',
            CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT        => 5,
        ]);

        $response = curl_exec($ch);

        if ($response === false) {
            curl_close($ch);
            return null;
        }


        curl_close($ch);
        return $response;
    }



?>