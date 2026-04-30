<?php
function sp_get_origin_payrow_by_oid($oid) {
    $sql = "SELECT * FROM saju_payment WHERE Oid = '".sql_real_escape_string($oid)."' AND ReqResult='0000' ORDER BY no DESC LIMIT 1";
    return sql_fetch($sql);
}

function sp_already_canceled_once($oid) {
    $sql = "SELECT COUNT(*) AS ct FROM saju_payment WHERE Oid = '".sql_real_escape_string($oid)."' AND CancelYn='Y'";
    $r = sql_fetch($sql);
    return (int)$r['ct'] > 0;
}

function sp_coin_amount_for($amount) {
    // 결제 → 코인 전환 규칙을 기존 로직에 **그대로** 맞춤
    return chg_point_pay((int)$amount);
}

function sp_insert_cancel_row($orig, $recamt, $reccoinamt, $req_result, $resultmsg, $mtonet_raw='') {
    // 음수로 적재 (정산/리포트 합계 자연스러움)
    $amount      = 0 - (int)$recamt;
    $coin_amount = 0 - (int)$reccoinamt;

    $sql = "
        INSERT INTO saju_payment
        (mb_id, Membid, PayMethod, Oid, Tid, Amount, Coin_Amount, ReqResult, ResultMsg,
         TelNo, BankCd, banknm, VrNo, DepositNm, DepositTm, od_time, mrtn, CancelYn, CancelDt)
        VALUES
        ('{$orig['mb_id']}', '{$orig['Membid']}', '{$orig['PayMethod']}', '{$orig['Oid']}', '{$orig['Tid']}',
         '{$amount}', '{$coin_amount}', '".sql_real_escape_string($req_result)."', '".sql_real_escape_string($resultmsg)."',
         '{$orig['TelNo']}', '{$orig['BankCd']}', '{$orig['banknm']}', '{$orig['VrNo']}', '{$orig['DepositNm']}', '{$orig['DepositTm']}',
         NOW(), '".sql_real_escape_string($mtonet_raw)."', 'Y', NOW())
    ";
    sql_query($sql);
    return sql_insert_id();
}

function sp_revert_coin($mb_id, $membid, $coin_to_revert) {
    if ($coin_to_revert <= 0) return;

    // 1) g5_point 회수
    insert_point($mb_id, 0 - $coin_to_revert, '결제취소 코인회수', '@member', $mb_id, '결제취소');

    // 2) 엠투넷 코인 차감 (기존 충전과 동일 엔드포인트에 음수로)
    $data = '{"amt":"-'.(int)$coin_to_revert.'"}';
    $murl = "memb-mgr";
    return send_mjson1($murl, $data, 'PUT', $membid);
}

function sp_is_virtual_account_flow($orig) {
    // 기존 코드 기준: VRBANK 류는 코인을 **즉시 적립하지 않음**
    // (가상계좌 발급 시점에는 insert_point 안 했으므로 회수도 필요 없음)
    $pm = $orig['PayMethod'];
    return ($orig['VrNo'] || $pm=='GNR_VRBANK' || $pm=='VRBANK_PAY' || $pm=='GNR_MOB_PAVC' || $pm=='GNR_PC_PAVC');
}
