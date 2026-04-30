<?php
$sub_menu = "350420";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
#############################################################

$no = isset($_REQUEST['no']) ? (int)$_REQUEST['no'] : 0;

// Inbox 로그
$__payload = json_encode($_REQUEST, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$sql_ib = "
  INSERT INTO saju_pay_inbox (endpoint, method, payload, remote_ip, created_at)
  VALUES (
    '/adm/order_cancle.php',
    '" . sql_escape_string($_SERVER['REQUEST_METHOD']) . "',
    '" . sql_escape_string($__payload) . "',
    '" . sql_escape_string($_SERVER['REMOTE_ADDR']) . "',
    NOW()
  )";
@sql_query($sql_ib);

if (!$no) {
    echo "<script>alert('잘못된 요청입니다.'); window.close();</script>";
    exit;
}

// 대상 주문 조회
$row = sql_fetch("SELECT * FROM saju_payment WHERE no={$no}");
if (!$row || !$row['Oid']) {
    echo "<script>alert('주문 정보를 찾을 수 없습니다.'); window.close();</script>";
    exit;
}

// 🔒 중복 취소 방지 (이미 취소완료면 종료)
$__oid = sql_escape_string($row['Oid']);
$__du = sql_fetch("
  SELECT MAX(ResultMsg) AS lastmsg
  FROM saju_payment
  WHERE Oid='{$__oid}'
");
if (trim((string)$__du['lastmsg']) === '취소완료') {
    echo "<script>
      if (window.opener) window.opener.location.reload();
      alert('이미 취소 처리된 주문입니다.');
      window.close();
    </script>";
    exit;
}

// PG 취소 요청
$data = '{"oid":"'.sql_escape_string($row['Oid']).'"}';
$murl = "cptl/cancelpay";
$jresult = send_mjson_cancle($murl, $data, 'POST');

// 성공코드 유연화
$__ok = isset($jresult['req_result']) && in_array($jresult['req_result'], ['00','0000'], true);

if ($__ok) {
    // (선택) 취소 응답 원문 저장
    $mrtn_json = sql_escape_string(json_encode($jresult, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    // ✅ 원행만 업데이트 (취소행 INSERT 없음)
    $sql_up = "
      UPDATE saju_payment
      SET ResultMsg='취소완료',
          mrtn='{$mrtn_json}'
          -- , canceled_at=NOW()   -- ← 컬럼 있으면 주석 해제
      WHERE no={$no}
    ";
    $ok_up = sql_query($sql_up);

    if ($ok_up) {
        // 포인트 1회 차감 (Coin_Amount가 양수일 때만)
        $coin = (int)$row['Coin_Amount'];
        if ($coin > 0) {
            insert_point(
                $row['mb_id'],
                -$coin,
                '결제취소',
                '@saju_payment',
                $row['mb_id'],
                '관리자 결제 취소:'.$row['Oid']
            );
        }

        echo "<script>
          if (window.opener) window.opener.location.reload();
          alert('취소처리 되었습니다.');
          window.close();
        </script>";
        exit;
    } else {
        echo "<script>
          if (window.opener) window.opener.location.reload();
          alert('DB 업데이트 실패');
          window.close();
        </script>";
        exit;
    }
} else {
    $err = $jresult['resultmsg'] ?? ($jresult['resultmessage'] ?? '취소 실패');
    echo "<script>
      if (window.opener) window.opener.location.reload();
      alert('{$err}');
      window.close();
    </script>";
    exit;
}
