<?php
// /lib/aligo_sms.lib.php
//include_once('./_common.php');

if (!function_exists('normalize_phone')) {
    function normalize_phone($hp)
    {
        return preg_replace('/\D+/', '', (string)$hp);
    }
}
if (!function_exists('strip_emoji')) {
    // 알리고: 이모지/4바이트 문자 불가 → 제거
    function strip_emoji($str){
        return preg_replace('/[\x{10000}-\x{10FFFF}]/u', '', (string)$str);
    }
}

if (!function_exists('decide_msg_type')) {
    function decide_msg_type($msg){
        $len = function_exists('mb_strwidth') ? mb_strwidth($msg, 'UTF-8') : strlen($msg);
        return ($len > 85) ? 'LMS' : 'SMS'; // 안전하게 85바이트 기준
    }
}

// 팀장님 함수 개선본: 비밀값/발신번호는 config에서 define
if (!function_exists('f_aligo_sms_send')) {
    function f_aligo_sms_send($receiver, $msg, $subject="사주플랜] (긴급) 채팅 상담 연결 요청")
    {
        $sms_url = "https://apis.aligo.in/send/";
        $sms['user_id'] = ALIGO_USER_ID;
        $sms['key']     = ALIGO_KEY;
        $host_info = explode("/", $sms_url);
        $port = $host_info[0] == 'https:' ? 443 : 80;
        // 수신번호: 배열/문자열 모두 허용
        if (is_array($receiver)) {
            $receiver = implode(',', array_filter(array_map('normalize_phone', $receiver)));
        } else {
            $receiver = normalize_phone($receiver);
        }
        $sms['msg']         = stripslashes(strip_emoji($msg));
        $sms['receiver']    = $receiver;
        $sms['sender']      = normalize_phone(ALIGO_SENDER);
        $sms['testmode_yn'] = 'N';


        // 길이에 따라 자동 전환 (LMS면 제목 필수)
        $sms['msg_type']    = decide_msg_type($sms['msg']);
        if ($sms['msg_type'] !== 'SMS') {
            $sms['title'] = $subject ?: '알림';
        }

        $oCurl = curl_init();
        curl_setopt($oCurl, CURLOPT_URL, $sms_url);
        curl_setopt($oCurl, CURLOPT_POST, 1);
        curl_setopt($oCurl, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($oCurl, CURLOPT_POSTFIELDS, $sms);
        curl_setopt($oCurl, CURLOPT_SSL_VERIFYPEER, false);

        $ret = curl_exec($oCurl);
        $http_code = curl_getinfo($oCurl, CURLINFO_HTTP_CODE);
        if ($ret === false) {
            $err = curl_error($oCurl);
        }
        curl_close($oCurl);

        if ($ret === false) {
            // 실패시에도 일관된 JSON 문자열 반환
            return json_encode([
                'result_code' => -998,
                'message'     => 'CURL ERROR: '.$err,
                'http_code'   => $http_code,
            ], JSON_UNESCAPED_UNICODE);
        }

        // 성공 응답
        $decoded = json_decode($ret, true);
        if (is_array($decoded)) {
            $decoded['_http_code'] = $http_code;
            return json_encode($decoded, JSON_UNESCAPED_UNICODE);
        }
        return $ret;
    }}

// (선택) 바로 배열로 받고 싶으면 이 래퍼 사용
if (!function_exists('aligo_send_and_parse')) {
    function aligo_send_and_parse($receiver, $msg, $subject=''){
        $ret = f_aligo_sms_send($receiver, $msg, $subject);
        $arr = json_decode($ret, true);
        return is_array($arr) ? $arr : ['result_code'=>-999, 'message'=>'JSON 파싱 실패', '_raw'=>$ret];
    }
}