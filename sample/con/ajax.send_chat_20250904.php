<?php

include_once('./_common.php');
// D:\xampp\htdocs\practice_\con2\ajax.send_chat.php
$g5_path = g5_path();
include_once($g5_path['path'].'/config.php');   // 설정 파일

include_once __DIR__ . '/../lib/aligo_sms.lib.php'; // 형제 폴더 "_lib"

####################################################
if (!$member["mb_id"]) {
    exit;
}
// 요청/응답 기록 테이블: request_consulting_t
function insert_request_consulting_log(array $p){
    $esc = function($v){ return isset($v) ? "'".sql_real_escape_string(is_scalar($v)? (string)$v : json_encode($v, JSON_UNESCAPED_UNICODE))."'" : "NULL"; };
    $int = fn($v) => isset($v)? (int)$v : "NULL";
    $yn  = fn($v) => ($v==='Y'?'Y':'N');

    $started_at  = $p['started_at'] ?? date('Y-m-d H:i:s');
    $finished_at = $p['finished_at'] ?? null;
    $duration_ms = $p['duration_ms'] ?? null;

    $sql = "
    INSERT INTO request_consulting_t
    (log_date, started_at, finished_at, duration_ms, success, req_result, resultmessage,
     http_status, cmd, url, membid, csrid, roomid, request_body, response_body, trace_id)
    VALUES (
      DATE(".$esc($started_at)."),
      ".$esc($started_at).",
      ".$esc($finished_at).",
      ".$int($duration_ms).",
      '".$yn($p['success'] ?? 'N')."',
      ".$esc($p['req_result'] ?? null).",
      ".$esc($p['resultmessage'] ?? null).",
      ".$int($p['http_status'] ?? null).",
      ".$esc($p['cmd'] ?? null).",
      ".$esc($p['url'] ?? null).",
      ".$esc($p['membid'] ?? null).",
      ".$esc($p['csrid'] ?? null).",
      ".$esc($p['roomid'] ?? null).",
      ".$esc($p['request_body'] ?? null).",
      ".$esc($p['response_body'] ?? null).",
      ".$esc($p['trace_id'] ?? null)."
    )";
    sql_query($sql);
}
$memid = $_REQUEST["memid"];
$csrid = $_REQUEST["csrid"];

$row = sql_fetch("SELECT * FROM g5_member WHERE mb_1 = {$csrid}");


if (!$memid) {
    echo json_encode(['result' => false, 'msg' => "로그인이 필요합니다."]);
}

if ($row['state'] == 'IDLE') {
    $res = set_crs_status_chg($csrid, 'RDVC');
    //var_dump($res);
}

$data = '{"msg":"csrchat","membid":"' . $memid . '","csrid":"' . $csrid . '"}';

//{"msg":"csrchat","membid":"102428","csrid":"14967"}error


// --------------------- [ADD] 요청 전 시간 측정 & trace_id ---------------------
$murl = "chat-mgr";
$started_at = date('Y-m-d H:i:s');
$t0 = microtime(true);
$trace_id = uniqid('mt_', true);
$log_url = "http://passcall.co.kr:20102/{$murl}/".MOTONET_CPID; // 실제 호출 URL과 동일 포맷
$req_arr = ['msg'=>'csrchat','membid'=>$memid,'csrid'=>$csrid];
// -

$jresult = send_ch_json($murl, $data, 'POST');

//echo $csrid;
//var_dump($jresult);
// --------------------- [ADD] 응답 후 로깅 ---------------------
$finished_at = date('Y-m-d H:i:s');
$duration_ms = (int)round((microtime(true)-$t0)*1000);
$req_result = $jresult['req_result'] ?? null;
$resultmessage = $jresult['resultmessage'] ?? null;
$roomid = $jresult['roomid'] ?? null;
$success = ($req_result === '00') ? 'Y' : 'N';

insert_request_consulting_log([
    'started_at'   => $started_at,
    'finished_at'  => $finished_at,
    'duration_ms'  => $duration_ms,
    'success'      => $success,
    'req_result'   => $req_result,
    'resultmessage'=> $resultmessage,
    'http_status'  => $aligo_res['_http_code'] ?? null,                 // send_ch_json 내부에서만 알 수 있음(수정 가능하면 거기서 기록)
    'cmd'          => 'csrchat',
    'url'          => $log_url,
    'membid'       => $memid,
    'csrid'        => $csrid,
    'roomid'       => $roomid,
    'request_body' => $req_arr,
    'response_body'=> json_encode($jresult, JSON_UNESCAPED_UNICODE),
    'trace_id'     => $trace_id
]);
// ------------------------------------------------------------------------------

if ($jresult["req_result"] == "00") { /// 성공
    $sql_check = "SELECT COUNT(*) as cnt FROM chat_room WHERE room_token = '{$jresult['roomid']}'";
    $exists = sql_fetch($sql_check);


    //if ($exists['cnt'] <=0 ) {
    if ((int)$exists['cnt'] === 0) {
        $sql = "INSERT INTO chat_room (room_token,csr_id,mb_id,status,chat_wdate) VALUES ('{$jresult['roomid']}','{$jresult['csrid']}','{$jresult['membid']}','STAY',NOW())";
        sql_query($sql);
    }

    $csr_row = get_csrid($csrid);

    // ===== 3-1) 알림톡 (기존)
    include_once(G5_PLUGIN_PATH . '/wz_alimtalk_bizm/config.php');
    include_once(G5_PLUGIN_PATH . '/wz_alimtalk_bizm/bizmsg.class.php');
    $bizmsg = new bizmsg();
    $bizmsg->phn = $csr_row['mb_hp'];
    $bizmsg->at_type = '채팅 상담방 개설'; //
    $bizmsg->csr_name = $csr_row['mb_nick'];
    $bizmsg->url = 'counsel/chat.php?token=' . $jresult['csrtoken'];
    // $rr = $bizmsg->send(); //TODO 해당 부분 실제로는 주석 풀기

    // ===== 3-2) SMS (알리고)

    //$chat_url = (defined('G5_URL') ? G5_URL : '').'/counsel/chat.php?token='.$jresult['csrtoken']; // 상담사 입장용 링크
    $chat_url = 'https://sajumoon.co.kr/counsel/chat.php?token='.rawurlencode($jresult['csrtoken']);

    $sms_subject = '채팅방 개설 안내'; // LMS일 때만 사용됨
    $sms_msg =
        "[사주문] {$csr_row['mb_nick']}님, 고객이 채팅 상담을 신청 후 입장을 기다리고 있어 안내드립니다.\n".
        "지금 바로 상담에 참여해 주세요.\n".
        "\n".
        "※ 상담이 지연되면 고객 연결이 취소될 수 있습니다.\n".
        "채팅상담 시작하기: {$chat_url}";

    $started_at2 = date('Y-m-d H:i:s');
    $t02 = microtime(true);
    $trace_id2 = uniqid('aligo_', true);

    $aligo_res = aligo_send_and_parse($csr_row['mb_hp'], $sms_msg, $sms_subject);

    $finished_at2 = date('Y-m-d H:i:s');
    $duration_ms2 = (int)round((microtime(true)-$t02)*1000);

    // 알리고 응답 표준 필드에 맞춰 로깅
    insert_request_consulting_log([
        'started_at'    => $started_at2,
        'finished_at'   => $finished_at2,
        'duration_ms'   => $duration_ms2,
        'success'       => (($aligo_res['result_code'] ?? 0) == 1) ? 'Y' : 'N',
        'req_result'    => (string)($aligo_res['result_code'] ?? null),
        'resultmessage' => $aligo_res['message'] ?? null,
        'http_status'   => $aligo_res['_http_code'] ?? null, // curl_getinfo를 f_aligo_sms_send 내부에서 받을 수 있으면 넣으세요.
        'cmd'           => 'aligo_send',
        'url'           => 'https://apis.aligo.in/send/',
        'membid'        => $memid,
        'csrid'         => $csrid,
        'roomid'        => $jresult['roomid'] ?? null,
        'request_body'  => [
            'receiver' => normalize_phone($csr_row['mb_hp']),
            'sender'   => ALIGO_SENDER,
            'title'    => $sms_subject,
            'msg'      => $sms_msg
        ],
        'response_body' => json_encode($aligo_res, JSON_UNESCAPED_UNICODE),
        'trace_id'      => $trace_id2
    ]);

    // echo json_encode(['result' => false, 'msg' => $jresult]);
    echo json_encode(['url' => '/counsel/chat.php?token=' . $jresult['membtoken'], 'result' => true]);
} else if ($jresult["req_result"] == "27") {
    // TODO: 잔액 부족 뿐만 아니라 다양한 msg로 리턴주는데 그대로 노출하면 안될거같고 에러타입을 구분해서 주는것도 아니고...
    // echo json_encode(['result' => false, 'msg' => "보유 포인트 잔액이 부족합니다."]);
    echo json_encode(['result' => false, 'msg' => "오류가 발생했습니다. 관리자에 문의 바랍니다"]);
} else {
    echo json_encode(['result' => false, 'msg' => "오류가 발생했습니다. 관리자에 문의 바랍니다"]);
}

function set_crs_status_chg($crsid, $chg_status)
{ //상담사 csrid , 변경 코드상태값

    $url = "http://passcall.co.kr:20102/chat-mgr/" . MOTONET_CPID;
    // console.log(MOTONET_CPID);
    $headers = array(
        'Content-Type: application/json',
        'Authorization: ' . MOTONET_CALL_KEY
    );

    $fields = array(
        'cmd' => 'csrstat',
        'csrid' => $crsid, // 고객 ID   test_c
        'state' => $chg_status  // 상담사 ID
    );


    // --------------------- [ADD] 요청 전 ---------------------
    $started_at = date('Y-m-d H:i:s');
    $t0 = microtime(true);
    $trace_id = uniqid('mt_', true);
    // --------------------------------------------------------


    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $response = curl_exec($ch);

    // 가능하면 HTTP 코드도 기록
    $http_code = function_exists('curl_getinfo') ? curl_getinfo($ch, CURLINFO_HTTP_CODE) : 0;


    curl_close($ch);
    $rtn = json_decode($response, true);

    // --------------------- [ADD] 응답 후 로깅 ---------------------
    $finished_at = date('Y-m-d H:i:s');
    $duration_ms = (int)round((microtime(true)-$t0)*1000);
    $req_result = $rtn['req_result'] ?? null;
    $resultmessage = $rtn['resultmessage'] ?? null;
    $success = ($req_result === '00') ? 'Y' : 'N';

    insert_request_consulting_log([
        'started_at'   => $started_at,
        'finished_at'  => $finished_at,
        'duration_ms'  => $duration_ms,
        'success'      => $success,
        'req_result'   => $req_result,
        'resultmessage'=> $resultmessage,
        'http_status'  => $http_code,
        'cmd'          => 'csrstat',
        'url'          => $url,
        'membid'       => null,
        'csrid'        => $crsid,
        'roomid'       => $rtn['roomid'] ?? null,
        'request_body' => $fields,
        'response_body'=> $response,
        'trace_id'     => $trace_id
    ]);
    // -------------------------------------------------------------


    return $rtn;

}