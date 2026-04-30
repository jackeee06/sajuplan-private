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
$mode  = $_REQUEST["mode"];   // 'Y' (전화 ON) / 'N' (전화 OFF)

if($mb_id && $mode !== '') {

    $mb = get_member($mb_id);

    $use_phone      = $mb['use_phone'];
    $use_chat       = $mb['use_chat'];
    $current_state  = $mb['state'];
    $new_state      = $current_state;

    // 전화 ON / OFF 반영
    if ($mode == 'Y') {
        $use_phone = 'Y';

        //  현재 상태가 상담가능 계열이거나( RDVC/RDCH/IDLE ) 부재중(ABSE )인 경우
        //   → 전화/채팅 설정 조합에 맞게 state 재계산
        if (in_array($current_state, array('RDVC','RDCH','IDLE','ABSE'))) {
            $new_state = get_counselor_ready_state($use_phone, $use_chat);
        }
    } else {
        $use_phone = 'N';

        // 상담가능 계열인 상태에서 전화 OFF 하면
        //  → 조합에 따라 RDCH 또는 ABSE 로 내려감
        if (in_array($current_state, array('RDVC','RDCH','IDLE'))) {
            $new_state = get_counselor_ready_state($use_phone, $use_chat);
        }
        // ABSE/CONN/CNCH/RESV/CRDY 인 상태에서 OFF 는 굳이 state 안 건드려도 됨
    }

    // DB 업데이트 : 전화설정 + 상태
    $sql = " update g5_member
             set use_phone = '".$use_phone."',
                 state     = '".$new_state."'
             where mb_id   = '".$mb_id."' ";
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
