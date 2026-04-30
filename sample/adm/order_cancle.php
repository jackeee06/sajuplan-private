<?php
$sub_menu = "350420";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
#############################################################

$no = $_REQUEST["no"];
if ($no) {
    $sql = "select * from saju_payment where no='" . $no . "'";
    $row = sql_fetch($sql);
    if ($row["Oid"]) {
        //// 주문 취소 //
        $data = '{"oid":"' . $row['Oid'] . '"}';
        $murl = "cptl/cancelpay";

        //로그용 값 준비
        $trace_id = uniqid('cancel_', true);
        $started_at = date('Y-m-d H:i:s');
        $log_date = date('Y-m-d');

        $jresult = send_mjson_cancle($murl, $data, 'POST');

        //로그 마감용 값
        $finished_at = date('Y-m-d H:i:s');
        $duration_ms = (strtotime($finished_at) - strtotime($started_at)) * 1000;
        $req_result = $jresult["req_result"] ?? null;
        $resmsg = $jresult["resultmsg"] ?? ($jresult["resultmessage"] ?? '');
        $success = ($req_result === "00") ? "Y" : "N";
        $payload = $data;
        $response = json_encode($jresult, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        //로그 INSERT
        $sql_log = "
            INSERT INTO payment_cancel_log_t
                (log_date, started_at, finished_at, duration_ms,
                 success, req_result, resultmessage, http_status,
                 url, oid, tid, membid, request_body, response_body, trace_id)
            VALUES (
                '" . sql_escape_string($log_date) . "',
                '" . sql_escape_string($started_at) . "',
                '" . sql_escape_string($finished_at) . "',
                '" . sql_escape_string($duration_ms) . "',
                '" . sql_escape_string($success) . "',
                '" . sql_escape_string($req_result) . "',
                '" . sql_escape_string($resmsg) . "',
                NULL,
                '" . sql_escape_string($murl) . "',
                '" . sql_escape_string($row['Oid']) . "',
                '" . sql_escape_string($row['Tid']) . "',
                '" . sql_escape_string($row['Membid']) . "',
                '" . sql_escape_string($payload) . "',
                '" . sql_escape_string($response) . "',
                '" . sql_escape_string($trace_id) . "'
            )";
        @sql_query($sql_log);


        if ($jresult["req_result"] == "00") { /// 등록성공
            $usql = "update saju_payment set ResultMsg='취소완료' where no='" . $no . "'";  // 해당 주문 취소 처리 및  포인트 감소 처리
            $rtn = sql_query($usql);
            if ($rtn) {
                insert_point($row["mb_id"], (-1) * $row["Coin_Amount"], '결제취소', '@saju_payment', $row["mb_id"], '관리자 결제 취소:' . $row["Oid"]);
                ?>
                <script>
                    window.opener.location.reload();
                    alert('취소처리 되었습니다.');
                    window.self.close();
                </script>
                <?php
            }
        } else {/// end 00

            $err = $jresult["resultmsg"] ?? ($jresult["resultmessage"] ?? "취소 실패");
            ?>
            <script>
                var msg = "<?=$err?>";
                window.opener.location.reload();
                alert(msg);
                window.self.close();
            </script>
            <?php
        }
    }
}
?>
