<?php
include_once('./_common.php');

// 권한 체크(필요시 메뉴코드도 사용 가능)
if (!$is_admin) {
    echo "<script>alert('권한이 없습니다.');window.close();</script>";
    exit;
}

// 파라미터 검증
$no = isset($_GET['no']) ? (int)$_GET['no'] : 0;
if (!$no) {
    echo "<script>alert('잘못된 요청입니다.');window.close();</script>";
    exit;
}

// 대상 로우 조회
$row = sql_fetch("SELECT * FROM saju_payment WHERE no = {$no} LIMIT 1");
if (!$row) {
    echo "<script>alert('내역을 찾을 수 없습니다.');window.close();</script>";
    exit;
}

// 가상결제만 허용
$is_vbank = (strpos($row["PayMethod"], 'VRBANK')!==false
    || strpos($row["PayMethod"], 'PAVC')!==false
    || $row["PayMethod"]=='VRBANK_PAY'
    || $row["PayMethod"]=='GNR_VRBANK'
    || $row["PayMethod"]=='GNR_PC_PAVC'
    || $row["PayMethod"]=='GNR_MOB_PAVC');
if (!$is_vbank) {
    echo "<script>alert('가상결제 건만 취소 처리할 수 있습니다.');window.close();</script>";
    exit;
}

// 상태 체크: 입금완료(+동의어)만 허용
$deposit_done_vals = array('입금완료','ok','processing completed');
if (!in_array(trim($row['ResultMsg']), $deposit_done_vals)) {
    echo "<script>alert('입금완료 상태만 취소 처리할 수 있습니다.');window.close();</script>";
    exit;
}

// 은행/입금자 정보 필수
if (trim($row['BankCd'])==='' || trim($row['DepositNm'])==='') {
    echo "<script>alert('은행코드/입금자명이 비어 있어 취소 처리할 수 없습니다.');window.close();</script>";
    exit;
}

// 이미 취소 상태면 중복 방지
if (trim($row['ResultMsg'])==='취소완료') {
    echo "<script>alert('이미 취소완료 상태입니다.');opener.location.reload();window.close();</script>";
    exit;
}

// 업데이트
sql_query("UPDATE saju_payment SET ResultMsg='취소완료' WHERE no={$no} LIMIT 1");

echo "<script>alert('취소완료로 변경했습니다.');opener.location.reload();window.close();</script>";
