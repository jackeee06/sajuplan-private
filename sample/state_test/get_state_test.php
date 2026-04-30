<?php
include_once('../common.php');

// ===== 디버그(문제 해결 후 주석 처리 권장) =====
/*ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);*/

header('Content-Type: text/plain; charset=utf-8');

set_time_limit(0);
ignore_user_abort(true);

// ===== 중복 선언 방지 =====
if (!function_exists('calc_state')) {
    function calc_state($use_chat, $use_phone) {
        $use_chat  = ($use_chat  === 'Y') ? 'Y' : 'N';
        $use_phone = ($use_phone === 'Y') ? 'Y' : 'N';

        if ($use_chat === 'Y' && $use_phone === 'Y') return 'RDVC';
        if ($use_chat === 'Y' && $use_phone === 'N') return 'RDCH';
        if ($use_chat === 'N' && $use_phone === 'Y') return 'IDLE';
        return 'ABSE';
    }
}

if (!function_exists('set_crs_status_chg')) {
    function set_crs_status_chg($crsid, $chg_status) {
        $url = "http://passcall.co.kr:20102/chat-mgr/" . MOTONET_CPID;

        $headers = array(
            'Content-Type: application/json',
            'Authorization: ' . MOTONET_CALL_KEY
        );

        $fields = array(
            'cmd'   => 'csrstat',
            'csrid' => $crsid,
            'state' => $chg_status
        );

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields, JSON_UNESCAPED_UNICODE));

        // 웹 실행 시 너무 오래 걸리지 않게(필요시 조정)
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        $response = curl_exec($ch);

        if ($response === false) {
            $err = curl_error($ch);
            curl_close($ch);
            return array('req_result' => '99', 'resultmessage' => 'curl_error: ' . $err);
        }

        curl_close($ch);

        $rtn = json_decode($response, true);
        if (!is_array($rtn)) {
            return array('req_result' => '98', 'resultmessage' => 'json_decode_failed', 'raw' => $response);
        }

        return $rtn;
    }
}

// =====================
// 메인 처리
// =====================


// API 과부하 방지
$SLEEP_USEC = 100000;

// 조회: mb_level=5, mb_1 있음, 기존 ABSE 제외
$sql = "
    SELECT mb_no, use_chat, use_phone, state, mb_1
    FROM g5_member
    WHERE mb_level = 5
      AND mb_1 <> ''
      AND state <> 'ABSE'
    ORDER BY mb_no ASC
";
$result = sql_query($sql);

$total = 0;
$dbUpdated = 0;
$apiOk = 0;
$apiFail = 0;

while ($row = sql_fetch_array($result)) {
    $total++;

    $mb_no = (int)$row['mb_no'];

    // mb_1은 문자열 그대로 사용(앞자리 0 유지)
    $csrid = trim($row['mb_1']);

    // 숫자 문자열만 허용(원본 값은 유지)
    if ($csrid === '' || !preg_match('/^\d+$/', $csrid)) {
        echo "[SKIP] mb_no={$mb_no} invalid csrid='{$csrid}'\n";
        continue;
    }

    $old_state = strtoupper(trim($row['state']));
    $new_state = calc_state($row['use_chat'], $row['use_phone']);

    // 기존 ABSE는 제외했지만, 계산 결과가 ABSE인 경우도 건드리지 않으려면 아래 주석 해제
    // if ($new_state === 'ABSE') {
    //     echo "[SKIP] mb_no={$mb_no} csrid={$csrid} computed ABSE\n";
    //     continue;
    // }

    // 1) DB 업데이트 (변경 필요할 때만) - PK 기준 업데이트(안전)
    if ($old_state !== $new_state) {
        sql_query("UPDATE g5_member SET state='{$new_state}' WHERE mb_no={$mb_no}");
        $dbUpdated++;
    }

    // 2) API 호출
    $apiRes = set_crs_status_chg($csrid, $new_state);

    if (isset($apiRes['req_result']) && $apiRes['req_result'] === '00') {
        $apiOk++;
        echo "[OK]   mb_no={$mb_no} csrid={$csrid} {$old_state} -> {$new_state}\n";
    } else {
        $apiFail++;
        $msg = $apiRes['resultmessage'] ?? ($apiRes['message'] ?? 'unknown');
        echo "[FAIL] mb_no={$mb_no} csrid={$csrid} {$old_state} -> {$new_state} msg={$msg}\n";
    }

    if ($SLEEP_USEC > 0) usleep($SLEEP_USEC);
}

echo "\n---- SUMMARY ----\n";
echo "TOTAL rows : {$total}\n";
echo "DB updated : {$dbUpdated}\n";
echo "API OK     : {$apiOk}\n";
echo "API FAIL   : {$apiFail}\n";
