<?php
include_once('../common.php');
################################################

// 1) 입력 한 번만 읽고, 로그도 한 번만 남김
$jsondata = file_get_contents('php://input');

if ($jsondata) {
    $isql = "insert into platform_consulting_log(`message`, `wdate`)values('" . addslashes($jsondata) . "',now())";
    @sql_query($isql);
}

$arr = json_decode($jsondata, true);
$arrlen = count($arr);

if ($arrlen > 0) {
    $mtonet_allmsg = addslashes($jsondata);

    if ($arr["csrid"]) {
        // mrtn: 원본 JSON 그대로(TEXT) 저장용
        $mtonet_allmsg = addslashes($jsondata);

        // 처리용 복제 (원본은 건드리지 않음)
        $arr_proc = $arr;

        // 2) 콜/채팅 판별
        $roomid_raw = isset($arr_proc["roomid"]) ? $arr_proc["roomid"] : null;
        $is_call = is_null($roomid_raw) || strlen(trim((string)$roomid_raw)) === 0; // roomid 없으면 콜
        $is_chat = !$is_call;

        // 3) 금액 정규화: 콜만 1000원 이하 0처리
        /* $amtInt = isset($arr_proc["amt"]) ? (int)$arr_proc["amt"] : 0;

         if ($is_call && $amtInt <= 1000) {
             $arr_proc["amt"] = 0;
             $amtInt = 0;
         }*/
        // 3) 금액 정규화: 콜만 1000원 이하 0처리
        $amtInt = isset($arr_proc["amt"]) ? (int)$arr_proc["amt"] : 0;

// "원본" 금액(정규화 전)도 보관
        $rawAmtInt = isset($arr["amt"]) ? (int)$arr["amt"] : 0;

// 콜이고 원본 금액이 1,000 이하이면 환불 대상
        //$refund_eligible = $is_call && $rawAmtInt > 0 && $rawAmtInt <= 1000; //917 환불

        // 4) 상담사/회원 기본정보
        $csrid = $arr_proc["csrid"] ?? '';
        $minfo = [];
        if ($csrid !== '') {
            $minfo = get_csrid($csrid);
        }
        $c_id = $minfo["mb_id"] ?? '';

// --- 여기서 상담사별 환불 임계값 적용 ---
// mb_4가 비어있으면 이전 로직과 동일하게 1000을 기본값으로 사용
        $csr_threshold = isset($minfo['mb_4']) && $minfo['mb_4'] !== '' ? (int)$minfo['mb_4'] : 1000;
        $csr_threshold = max(0, $csr_threshold); // 음수 방지

// 콜이고, 원본금액이 상담사 임계값 이하이면 환불 대상
        $refund_eligible = $is_call && $rawAmtInt > 0 && $rawAmtInt <= $csr_threshold;


        /* if ($is_call && $amtInt <= 1000) {
             $arr_proc["amt"] = 0;
             $amtInt = 0;
         }*/

// INSUFFICIENT_CONN 은 무조건 amt 0 처리
        if (($arr_proc["reason"]) === "INSUFFICIENT_CONN") {
            $arr_proc["amt"] = 0;
            $amtInt = 0;
        }


// INSUFFICIENT_CONN 은 무조건 amt 0 처리
        if (($arr_proc["reason"]) === "INSUFFICIENT_CONN") {
            $arr_proc["amt"] = 0;
            $amtInt = 0;
        }

        $reason = $arr_proc["reason"] ?? '';
        $skip_charge = ($amtInt <= 0 && $is_call && $reason == "DISCONNECT") ? 'Y' : 'N';


        // 4) 상담사/회원 기본정보
        $csrid = $arr_proc["csrid"] ?? '';
        $minfo = [];
        if ($csrid !== '') {
            $minfo = get_csrid($csrid);
        }
        $c_id = $minfo["mb_id"] ?? '';

        // 5) 모드별 종료 이벤트(정산 트리거) 판정
        $ends_here = ($is_call && $reason === "DISCONNECT") || ($is_chat && $reason === "END_CHAT");

        // p_gubun: 정산 시점에만 의미 있게 결정
        $p_gubun = "N";
        if ($ends_here && $amtInt > 0) {
            $p_gubun = ($amtInt >= 10000) ? "Y" : "N";
        }
//		START_ARS : 회원이 최초 접속하여 ARS 를 듣기 시작하면 발생.(접속이벤트와 동일)
//		 INSUFFICIENT : AG9 에서 회원이 상담사선택 후 연결전 회원잔액이 상담사의 차감단위 금액(예:1200)보다 적은 잔액인 경우 거절하며 발생.
//		 NOT_FOUND_CSRNO : 회원이 선택(DTMF)한 상담사 번호로 검색한 결과 상담사가 없는 경우 발생. 자동선택(9)인 경우 대기중(상담가능) 상담사가 없는 경우.
//		 NOT_IDLE : 회원이 선택(DMTF)한 상담사가 상담중인 경우
//		 ABSE : 회원이 선택한 상담사가 부재중인 경우
//		 TRY_OK : 회원이 선택한 상담사로 전화연결 시작(통신사로 전문발송완료)
//		 DISCONNECT: 회원과 상담사 전화가 끊어진 경우. 상담사와 회원 쪽 CallID 로 2 회 발생할 수있음.(1 회는 필수 이며 2 회는 보장성 없음)
//		 CONNECT_CSR : 상담사와 회원의 전화연결이 완료됨. 차감 시작(보장성 있음)
//		 NO_ANSWER_CSR : TRY_OK 이후 일정시간(30 초)동안 응답이 없는 경우. 받지 않는 경우 또는 받았다가 그냥 끊는 경우에 발생함. 세부 사유는 기간통신사에서 알려주지 않음.(SIP 연동규격)
//		 INSUFFICIENT_CONN : 상담사 연결하여 상담중에 잔액 부족하면 멘트와 함께 해당 Push 메시지

        /// 연결되면 상담중으로 상담사 상태 변경 //
        if ($arr_proc["reason"] == "TRY_OK") {
            ////연결이 되면 상담중으로 처리
            // $strSQL = "UPDATE g5_member SET state = 'CONN' WHERE mb_1= '" . $arr_proc["dtmfno"] . "'";
            $strSQL = "UPDATE g5_member SET state = 'CONN' WHERE mb_1= '" . $arr_proc["csrid"] . "'";
            sql_query($strSQL);

        } elseif ($arr_proc["reason"] == "START_CHAT") {
            $strSQL = "UPDATE g5_member SET state = 'CNCH' WHERE mb_1= '" . $arr_proc["csrid"] . "'";
            sql_query($strSQL);


        } elseif ($arr_proc["reason"] == "TRYING") {
            $chatSQL = "UPDATE chat_room SET status = 'CNCH' WHERE room_token = '{$arr_proc['roomid']}'";
            sql_query($chatSQL);

        } elseif ($arr_proc["reason"] == "DISCONNECT" || $arr_proc["reason"] == "END_CHAT") {
            // $strSQL = "UPDATE g5_member SET state = 'IDLE' WHERE mb_1= '".$arr["dtmfno"]."'";
            $strSQL = "UPDATE g5_member SET state = 'IDLE' WHERE mb_1= '" . $arr_proc["csrid"] . "'";

            sql_query($strSQL);

            /// 예약되어있는 알람이 있는지 확인하고 처리
            set_resv_alrm($minfo["mb_id"], "IDLE");
            /// 예약되어있는 알람이 있는지 확인하고 처리끝.

            //채팅시에는 AG9 상태값도 변경 (채팅 시작시에 IDLE이 아닌 RDVC로 변경하였었음)

            if ($arr_proc["reason"] == "END_CHAT") {
                set_crs_status_chg($csrid, 'IDLE');
                $chatSQL = "UPDATE chat_room SET status = 'DISCONNECT', chat_edate = NOW() WHERE room_token = '{$arr_proc['roomid']}'";
                sql_query($chatSQL);
            }
        }
        // 7) INSERT (amt는 반드시 정규화된 $amtInt 사용)
        $wr_dt = !empty($arr_proc['start']) ? $arr_proc['start'] : date('Y-m-d H:i:s', G5_SERVER_TIME);

        // 7) INSERT (amt는 반드시 정규화된 $amtInt 사용)
        $sql = "insert into platform_consulting(`mb_id`, `cpid`, `csrid`, `dtmfno`, `start`, `end`, `from`,
                       `to`, `reason`, `telno`, 
                       `usetm`, `amt`, `preflag`, `eventtm`, 
                       `wr_datetime`, `membid`, `p_gubun`, `mrtn`, `roomid`, `skip_charge`)
        values('" . $c_id . "', '" . $arr["cp_id"] . "', '" . $arr["csrid"] . "', '" . $arr["dtmfno"] . "', '" . $arr["start"] . "', 
               '" . $arr["end"] . "', '" . $arr["from"] . "' ,'" . $arr["to"] . "', '" . $arr["reason"] . "', '" . $arr["telno"] . "',
               '" . $arr["usetm"] . "' , " . (int)$amtInt . ", '" . $arr["preflag"] . "', '" . $arr["eventtm"] . "',
               '" . $wr_dt . "', '" . $arr["membid"] . "', '" . $p_gubun . "', '" . $mtonet_allmsg . "', '" . $arr["roomid"] . "', '" . $skip_charge . "')";
        sql_query($sql);

        $no = sql_insert_id();

// ---------------------- 자동 환불(1,000원 이하 통화) ----------------------
// 중복 방지용 토큰(같은 통화에서 두 번 환불되지 않도록)
        $refund_token = 'refund:' . ($arr_proc['roomid'] ?? ('call:' . $arr_proc['from'] . '-' . $arr_proc['to'])) . ':' . ($arr_proc['eventtm'] ?? '');

// 종료 시점에서만, 콜이고, 1,000 이하 금액이 존재하면 환불
        if ($ends_here && $refund_eligible) {
            // 회원 정보
            if (!empty($arr_proc["membid"])) {
                $meminfo = get_mbid($arr_proc["membid"]);
                $m_id = $meminfo["mb_id"] ?? '';

                if ($m_id !== '') {
                    // rel_table/rel_action으로 중복 환불 방지 (insert_point의 dedupe 로직 활용)
                    $rel_table = '@platform_consulting';
                    $rel_id = $m_id;
                    $rel_action = $refund_token; // 동일 통화로 두 번 들어와도 한 번만 반영

                    // +원본금액만큼 환불(포인트 가산)
                    insert_point(
                        $m_id,
                        (int)$rawAmtInt,
                        '[전화] 부재중 자동 환불(음성사서함)', // 917 임시
                        $rel_table,
                        $rel_id,
                        $rel_action
                    );
                }
            }
        }
// -------------------------------------------------------------------------

        // 8) 포인트 정산: 모드별 종료 이벤트에서만, 금액 > 0 일 때만
        // if ($amtInt > 0 && $ends_here) {
        // 8) 포인트 정산: 종료 이벤트에서만
        if ($ends_here) {
            $svc_type = $is_call ? '[전화]' : '[채팅]';

            // --- 8-1) 회원 차감(amt>0이면 항상 수행)
            if ($amtInt > 0 && !empty($arr_proc["membid"])) {
                $meminfo = get_mbid($arr_proc["membid"]);
                $m_id = $meminfo["mb_id"] ?? '';
                if ($m_id !== '') {
                    // 차감: 중복방지 토큰(해당 row 기준)
                    $charge_action = $no . '@상담코인 차감@' . ($arr_proc['eventtm'] ?? '');
                    insert_point(
                        $m_id,
                        (-1) * $amtInt,
                        $svc_type . '상담코인 차감',
                        '@platform_consulting',
                        $m_id,
                        $charge_action
                    );

                    // --- 8-2) 환불 대상이면 즉시 환불(+원본금액)
                    if ($refund_eligible && $rawAmtInt > 0) {
                        $refund_token = 'refund:' . ($arr_proc['roomid'] ?? ('call:' . ($arr_proc['from'] ?? '') . '-' . ($arr_proc['to'] ?? ''))) . ':' . ($arr_proc['eventtm'] ?? '');
                        insert_point(
                            $m_id,
                            (int)$rawAmtInt,
                            $svc_type . '부재중 자동 환불(음성사서함)',  //917
                            '@platform_consulting_refund',   // ❗차감과 구분되는 rel_table 권장
                            $m_id,
                            $refund_token
                        );
                    }
                }
            }

            // --- 8-3) 상담사 정산: 환불 대상이면 미지급
            if ($amtInt > 0 && !$refund_eligible && !empty($csrid) && !empty($minfo["mb_id"])) {
                insert_point(
                    $minfo["mb_id"],
                    $amtInt,
                    $svc_type . '상담코인 증가',
                    '@platform_consulting',
                    $minfo["mb_id"],
                    $no . '@상담코인 증가@' . ($arr_proc['eventtm'] ?? '')
                );
            }
        }

        /*
            // 9) (테스트용) 처리 결과 반환
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($arr_proc, JSON_UNESCAPED_UNICODE);
            exit;*/
    }

// 끝
    ob_flush();
    ob_end_clean();
}

// 외부 상태 변경 함수 (기존 유지)
function set_crs_status_chg($crsid, $chg_status)
{
    $url = "http://passcall.co.kr:20102/chat-mgr/" . MOTONET_CPID;
    $headers = array(
        'Content-Type: application/json',
        'Authorization' => MOTONET_CALL_KEY
    );

    $fields = array(
        'cmd' => 'csrstat',
        'csrid' => $crsid,
        'state' => $chg_status
    );

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json', 'Authorization: ' . MOTONET_CALL_KEY));
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields, JSON_UNESCAPED_UNICODE));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}
