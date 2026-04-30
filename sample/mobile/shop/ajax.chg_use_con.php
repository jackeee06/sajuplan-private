<?php
include_once('./_common.php');
####################################################

if(!$member["mb_id"]){
    exit;
}

// 상담사가 "상담 가능" 상태일 때, 전화/채팅 설정에 따라 state를 계산
function get_counselor_ready_state($use_phone, $use_chat) {
    if ($use_phone === 'Y' && $use_chat === 'Y') return 'RDVC'; // 전화 + 채팅
    if ($use_phone === 'Y' && $use_chat === 'N') return 'IDLE'; // 전화만
    if ($use_phone === 'N' && $use_chat === 'Y') return 'RDCH'; // 채팅만
    return 'ABSE'; // 둘 다 N 이면 사실상 상담불가
}

$mb_id = $_REQUEST["mb_id"];
$mode  = $_REQUEST["mode"];   // 'Y' (상담가능) / 'N' (상담불가능)

if($mb_id && $mode !== '') {

    $mb = get_member($mb_id);

    // 현재 설정값
    $use_phone = $mb['use_phone'];  // 'Y' / 'N'
    $use_chat  = $mb['use_chat'];   // 'Y' / 'N'
    $new_state = $mb['state'];

    if ($mode == "Y") {
        // ▶ 상담가능으로 전환

        // 1) 전화/채팅이 둘 다 꺼져 있으면 → 둘 다 켜기
        if ($use_phone != 'Y' && $use_chat != 'Y') {
            $use_phone = 'Y';
            $use_chat  = 'Y';
        }

        // 2) 현재 전화/채팅 설정 기준으로 state 재계산
        $new_state = get_counselor_ready_state($use_phone, $use_chat);

        // 혹시라도 둘 다 N인 경우 안전장치
        if ($new_state === 'ABSE') {
            $use_phone = 'Y';
            $use_chat  = 'Y';
            $new_state = 'RDVC';
        }

    } else {
        // ▶ 상담불가능으로 전환
        // 👉 여기서 전화/채팅 둘 다 끄기
        $use_phone = 'N';
        $use_chat  = 'N';
        $new_state = "ABSE";
    }

    // DB 업데이트 : state + use_phone + use_chat
    $sql = " update g5_member
             set state     = '".$new_state."',
                 use_phone = '".$use_phone."',
                 use_chat  = '".$use_chat."'
             where mb_id   = '".$mb_id."' ";
    $rtn = sql_query($sql);

    if($rtn){

        // 내부 상태 로그
        if (function_exists('set_constate')) {
            set_constate($mb_id, $new_state);
        }

        // 엠투넷/AG9 상태 연동 (mb_1에 csrid 존재한다고 가정)
        if (!empty($mb["mb_1"]) && function_exists('set_crs_status_chg')) {

            $csrid = (string)trim($mb['mb_1']);  // "00233" 이런 값

            $res = set_crs_status_chg($csrid, $new_state);

            // 필요하면 디버깅
            // error_log("AG9 STATUS: ".print_r($res, true));

            if (!is_array($res) || !isset($res["req_result"]) || $res["req_result"] !== "00") {
                echo "ag9_error";
                exit;
            }
        }

        echo "ok";
        exit;

    } else {
        echo "db_error";
        exit;
    }
}
?>