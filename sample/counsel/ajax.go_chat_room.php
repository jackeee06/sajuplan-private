<?php
include_once('./_common.php');

$mb_id = get_session('ss_mb_id');
if (!$mb_id) {
    echo json_encode(array('result' => 'error', 'msg' => '로그인이 필요합니다.'));
    exit;
}

$row_csr = sql_fetch("SELECT mb_1, use_phone, use_chat, state FROM {$g5['member_table']} WHERE mb_id = '{$mb_id}'");

// 채팅이 이미 켜져있으면 변경 불필요
if ($row_csr['use_chat'] === 'Y') {
    echo json_encode(array('result' => 'ok', 'msg' => 'already_on', 'state' => $row_csr['state']));
    exit;
}

// 채팅 ON, 전화 상태는 유지
$new_state = ($row_csr['use_phone'] === 'Y') ? 'RDVC' : 'RDCH';

// DB 업데이트
$sql = "UPDATE {$g5['member_table']} SET use_chat = 'Y', state = '{$new_state}' WHERE mb_id = '{$mb_id}'";
$rtn = sql_query($sql);

if (!$rtn) {
    echo json_encode(array('result' => 'error', 'msg' => 'db_error'));
    exit;
}

// AG9(엠투넷) API 상태 동기화
$csrid = trim($row_csr['mb_1']);
if (!empty($csrid) && function_exists('set_crs_status_chg')) {
    $res = set_crs_status_chg($csrid, $new_state);

    if (!is_array($res) || !isset($res['req_result']) || $res['req_result'] !== '00') {
        echo json_encode(array('result' => 'error', 'msg' => 'ag9_error'));
        exit;
    }
}

echo json_encode(array('result' => 'ok', 'msg' => 'chat_on', 'state' => $new_state));
exit;
?>