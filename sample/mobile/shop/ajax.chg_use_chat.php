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
    return 'ABSE';
}

$mb_id = $_REQUEST["mb_id"];
$mode  = $_REQUEST["mode"];   // 'Y' (채팅 ON) / 'N' (채팅 OFF)

if($mb_id && $mode !== '') {

    $mb = get_member($mb_id);

    $use_phone      = $mb['use_phone'];
    $use_chat       = $mb['use_chat'];
    $current_state  = $mb['state'];
    $new_state      = $current_state;

    if ($mode == 'Y') {
        $use_chat = 'Y';

        // 🔹 RDVC/RDCH/IDLE/ABSE 인 상태에서 채팅 ON → 조합에 따라 RDVC/RDCH/IDLE 로 올리기
        if (in_array($current_state, array('RDVC','RDCH','IDLE','ABSE'))) {
            $new_state = get_counselor_ready_state($use_phone, $use_chat);
        }
    } else {
        $use_chat = 'N';

        // 🔹 상담가능 계열에서 채팅 OFF → 전화만 남으면 IDLE, 둘 다 끄면 ABSE
        if (in_array($current_state, array('RDVC','RDCH','IDLE'))) {
            $new_state = get_counselor_ready_state($use_phone, $use_chat);
        }
    }

    $sql = " update g5_member
             set use_chat = '".$use_chat."',
                 state    = '".$new_state."'
             where mb_id  = '".$mb_id."' ";
    $rtn = sql_query($sql);

    if($rtn){

        if (function_exists('set_constate')) {
            set_constate($mb_id, $new_state);
        }

        if (!empty($mb["mb_1"]) && function_exists('set_crs_status_chg')) {
            $csrid = trim($mb['mb_1']);
            $res   = set_crs_status_chg($csrid, $new_state);

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
