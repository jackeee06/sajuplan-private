<?php
include_once('../common.php');
################################################


if (!function_exists('get_counselor_ready_state')) {
    function get_counselor_ready_state($use_phone, $use_chat)
    {
        if ($use_phone === 'Y' && $use_chat === 'Y') return 'RDVC'; // 전화+채팅
        if ($use_phone === 'Y' && $use_chat === 'N') return 'IDLE'; // 전화만
        if ($use_phone === 'N' && $use_chat === 'Y') return 'RDCH'; // 채팅만
        return 'ABSE';                                              // 둘 다 끔
    }
}

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

    if (isset($arr["reason"])) {  // csrid가 비어있어도 처리되도록 조건 완화
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

        // 후불 여부 판별 (to=5000878이면 후불 → 회원 포인트 차감 안 함)
        $is_postpaid = ($arr_proc['to'] ?? '') === '5000878';


        /* if ($is_call && $amtInt <= 1000) {
             $arr_proc["amt"] = 0;
             $amtInt = 0;
         }*/


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
//		 /START_ARS : 회원이 최초 접속하여 ARS 를 듣기 시작하면 발생.(접속이벤트와 동일)
//		 INSUFFICIENT : AG9 에서 회원이 상담사선택 후 연결전 회원잔액이 상담사의 차감단위 금액(예:1200)보다 적은 잔액인 경우 거절하며 발생.
//		 NOT_FOUND_CSRNO : 회원이 선택(DTMF)한 상담사 번호로 검색한 결과 상담사가 없는 경우 발생. 자동선택(9)인 경우 대기중(상담가능) 상담사가 없는 경우.
//		 NOT_IDLE : 회원이 선택(DMTF)한 상담사가 상담중인 경우
//		 ABSE : 회원이 선택한 상담사가 부재중인 경우
//		 /TRY_OK : 회원이 선택한 상담사로 전화연결 시작(통신사로 전문발송완료)
//		 DISCONNECT: 회원과 상담사 전화가 끊어진 경우. 상담사와 회원 쪽 CallID 로 2 회 발생할 수있음.(1 회는 필수 이며 2 회는 보장성 없음)
//		 CONNECT_CSR : 상담사와 회원의 전화연결이 완료됨. 차감 시작(보장성 있음)
//		 NO_ANSWER_CSR : TRY_OK 이후 일정시간(30 초)동안 응답이 없는 경우. 받지 않는 경우 또는 받았다가 그냥 끊는 경우에 발생함. 세부 사유는 기간통신사에서 알려주지 않음.(SIP 연동규격)
//		 INSUFFICIENT_CONN : 상담사 연결하여 상담중에 잔액 부족하면 멘트와 함께 해당 Push 메시지

        /// 연결되면 상담중으로 상담사 상태 변경 // 'CONN' : 전화 상담 중
        /// 202512119 상담 상태 변경 관련 조건 수정 (기존에는 전화를 시도하기만 해도 '상담중'으로 떴음)
        //if ($arr_proc["reason"] == "TRY_OK" || $arr_proc["reason"] == "START_CHAT") {
        if ($arr_proc["reason"] == "CONNECT_CSR") {
            ////연결이 되면 상담중으로 처리
            // $strSQL = "UPDATE g5_member SET state = 'CONN' WHERE mb_1= '" . $arr_proc["dtmfno"] . "'";
            if (!empty($arr_proc["csrid"])) {
                $strSQL = "UPDATE g5_member SET state = 'CONN' WHERE mb_1= '" . $arr_proc["csrid"] . "'";
                sql_query($strSQL);
            }

        //} elseif ($arr_proc["reason"] == "TRYING") { //채팅 상담 중
        } elseif ($arr_proc["reason"] == "START_CHAT") { //채팅 상담 중
            $chatSQL = "UPDATE chat_room SET status = 'CNCH' WHERE room_token = '{$arr_proc['roomid']}'";
            sql_query($chatSQL);

            /*} elseif ($arr_proc["reason"] == "DISCONNECT" || $arr_proc["reason"] == "END_CHAT") {
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
            }*/
        } elseif ($arr_proc["reason"] == "DISCONNECT" || $arr_proc["reason"] == "END_CHAT"|| $arr_proc["reason"] == "NO_ANSWER_CSR") {

            if (!empty($arr_proc["csrid"])) {
                // 1) 상담사의 현재 전화/채팅 사용 설정을 읽어온다
                $mb_row = sql_fetch("
            SELECT use_phone, use_chat FROM g5_member WHERE mb_1 = '" . $arr_proc["csrid"] . "'");

                $use_phone = isset($mb_row['use_phone']) ? $mb_row['use_phone'] : 'Y';
                $use_chat = isset($mb_row['use_chat']) ? $mb_row['use_chat'] : 'Y';

                // 2) 전화/채팅 설정에 맞는 '준비 상태' 계산
                $ready_state = get_counselor_ready_state($use_phone, $use_chat);

                // 3) 우리 DB state 를 준비 상태로 돌려준다
                $strSQL = "UPDATE g5_member SET state = '" . $ready_state . "' WHERE mb_1 = '" . $arr_proc["csrid"] . "'";
                sql_query($strSQL);

                // 4) 예약 알림도 실제 준비 상태로 전달
                set_resv_alrm($minfo["mb_id"], $ready_state);

                // 5) 채팅 종료인 경우, AG9(엠투넷 chat-mgr)에도 같은 state 로 돌려준다
                if ($arr_proc["reason"] == "END_CHAT") {
                    set_crs_status_chg($csrid, $ready_state);    // 기존 'IDLE' → $ready_state
                    $chatSQL = " UPDATE chat_room SET status = 'DISCONNECT',  chat_edate = NOW() WHERE room_token = '{$arr_proc['roomid']}'";
                    sql_query($chatSQL);
                }
            }

            // 채팅 종료인 경우 chat_room 상태는 csrid 없어도 업데이트
            if (empty($arr_proc["csrid"]) && $arr_proc["reason"] == "END_CHAT" && !empty($arr_proc['roomid'])) {
                $chatSQL = " UPDATE chat_room SET status = 'DISCONNECT',  chat_edate = NOW() WHERE room_token = '{$arr_proc['roomid']}'";
                sql_query($chatSQL);
            }
        }
        $wr_dt = !empty($arr_proc['start']) ? $arr_proc['start'] : date('Y-m-d H:i:s', G5_SERVER_TIME);

      /*  // 7) INSERT (amt는 반드시 정규화된 $amtInt 사용)
        $sql = "insert into platform_consulting(`mb_id`, `cpid`, `csrid`, `dtmfno`, `start`, `end`, `from`,
                       `to`, `reason`, `telno`, 
                       `usetm`, `amt`, `preflag`, `eventtm`, 
                       `wr_datetime`, `membid`, `p_gubun`, `mrtn`, `roomid`, `skip_charge`)
        values('" . $c_id . "', '" . $arr["cp_id"] . "', '" . $arr["csrid"] . "', '" . $arr["dtmfno"] . "', '" . $arr["start"] . "', 
               '" . $arr["end"] . "', '" . $arr["from"] . "' ,'" . $arr["to"] . "', '" . $arr["reason"] . "', '" . $arr["telno"] . "',
               '" . $arr["usetm"] . "' , " . (int)$amtInt . ", '" . $arr["preflag"] . "', '" . $arr["eventtm"] . "',
               '" . $wr_dt . "', '" . $arr["membid"] . "', '" . $p_gubun . "', '" . $mtonet_allmsg . "', '" . $arr["roomid"] . "', '" . $skip_charge . "')";
        sql_query($sql);*/
        // 7) INSERT (amt는 반드시 정규화된 $amtInt 사용)

// payload 키 안전 추출 (없으면 '' 처리)
        $cpid    = $arr['cpid']    ?? ($arr['cp_id'] ?? '');
        $csrid_v = $arr['csrid']   ?? '';
        $dtmfno  = $arr['dtmfno']  ?? '';
        $start   = $arr['start']   ?? '';
        $end     = $arr['end']     ?? '';
        $from    = $arr['from']    ?? '';
        $to      = $arr['to']      ?? '';
        $reason  = $arr['reason']  ?? '';
        $telno   = $arr['telno']   ?? '';
        $usetm   = $arr['usetm']   ?? '';
        $preflag = $arr['preflag'] ?? '';
        $eventtm = $arr['eventtm'] ?? '';
        $membid  = $arr['membid']  ?? '';
        $roomid  = $arr['roomid']  ?? '';   // 콜이면 원래 없을 수 있음

        // INSERT 직전 로그 (정상적으로 문자열 합쳐서 저장)
        $logmsg = "INSERT reason={$reason} csrid={$csrid_v} cpid={$cpid} roomid={$roomid}";
        @sql_query("insert into platform_consulting_log(message,wdate) values('".addslashes($logmsg)."', now())");


// 최소한의 SQL 깨짐 방지 (권장: 실제로는 sql_escape_string 같은 함수를 쓰는 게 더 좋음)
        $cpid    = addslashes($cpid);
        $csrid_v = addslashes($csrid_v);
        $dtmfno  = addslashes($dtmfno);
        $start   = addslashes($start);
        $end     = addslashes($end);
        $from    = addslashes($from);
        $to      = addslashes($to);
        $reason  = addslashes($reason);
        $telno   = addslashes($telno);
        $usetm   = addslashes($usetm);
        $preflag = addslashes($preflag);
        $eventtm = addslashes($eventtm);
        $membid  = addslashes($membid);
        $roomid  = addslashes($roomid);

// mrtn(원본 JSON)은 이미 위에서 $mtonet_allmsg = addslashes($jsondata); 로 처리된 걸 사용

// --- amt_free / amt_pro 계산 (쿠폰 잔액 기반, DISCONNECT/END_CHAT 시점만) ---
        $amt_free_val = 0;
        $amt_pro_val  = (int)$amtInt;
        
        if ($ends_here && $amtInt > 0 && !empty($arr_proc["membid"])) {
            $_fp_meminfo = get_mbid($arr_proc["membid"]);
            $_fp_mb_id   = $_fp_meminfo['mb_id'] ?? '';
            if ($_fp_mb_id !== '') {
                $_fp_esc = sql_real_escape_string($_fp_mb_id);
                $_coupon_ids = [];
                $_cr = sql_query("SELECT cp_id FROM g5_shop_coupon WHERE mb_id='{$_fp_esc}' AND cz_id='39'");
                while ($_cw = sql_fetch_array($_cr)) {
                    $_pw = sql_fetch("SELECT po_id, po_point FROM g5_point WHERE mb_id='{$_fp_esc}' AND po_point>0 AND po_content LIKE '%{$_cw['cp_id']}%'");
                    if ($_pw['po_id']) $_coupon_ids[$_pw['po_id']] = (int)$_pw['po_point'];
                }
                $_fp_r = sql_query("SELECT po_id, po_point, po_content FROM g5_point WHERE mb_id='{$_fp_esc}' AND po_datetime<'{$wr_dt}' ORDER BY po_datetime ASC, po_id ASC");
                $_cb = 0; $_cu = 0;
                while ($_fr = sql_fetch_array($_fp_r)) {
                    $_pt = (int)$_fr['po_point'];
                    if (isset($_coupon_ids[$_fr['po_id']])) { $_cb += $_pt; }
                    elseif ($_pt < 0) { $_tc = min(abs($_pt), $_cb); $_cb -= $_tc; $_cu += $_tc; }
                    elseif ($_pt > 0 && strpos($_fr['po_content'], '환불') !== false) { $_rs = min($_pt, $_cu); $_cb += $_rs; $_cu -= $_rs; }
                }
                $amt_free_val = min($amtInt, $_cb);
                $amt_pro_val  = $amtInt - $amt_free_val;
            }
        }

        $sql = "insert into platform_consulting(`mb_id`, `cpid`, `csrid`, `dtmfno`, `start`, `end`, `from`,`to`, `reason`, `telno`,
                               `usetm`, `amt`, `amt_free`, `amt_pro`, `preflag`, `eventtm`,`wr_datetime`, `membid`, `p_gubun`, `mrtn`, `roomid`, `skip_charge`) 
                values ('{$c_id}', '{$cpid}', '{$csrid_v}', '{$dtmfno}', '{$start}','{$end}', '{$from}', '{$to}', '{$reason}', '{$telno}',
                        '{$usetm}', " . (int)$amtInt . ", " . (int)$amt_free_val . ", " . (int)$amt_pro_val . ", '{$preflag}', '{$eventtm}','{$wr_dt}', '{$membid}', '{$p_gubun}', '{$mtonet_allmsg}', '{$roomid}', '{$skip_charge}')";
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
                    /* insert_point(
                         $m_id,
                         (int)$rawAmtInt,
                         '[전화] 부재중 자동 환불(음성사서함)',
                         $rel_table,
                         $rel_id,
                         $rel_action
                     );*/
                }
            }
        }
// -------------------------------------------------------------------------

        // 8) 포인트 정산: 모드별 종료 이벤트에서만, 금액 > 0 일 때만
        // if ($amtInt > 0 && $ends_here) {
        // 8) 포인트 정산: 종료 이벤트에서만
        if ($ends_here) {
            $svc_type = $is_call ? '[전화]' : '[채팅]';

            // --- 8-1) 회원 차감(amt>0이고 후불/환불대상이 아닌 경우만 수행)
            // 후불(to=5000878)이거나 환불대상이면 회원 포인트 차감하지 않음
            if ($amtInt > 0 && !$refund_eligible && !$is_postpaid && !empty($arr_proc["membid"])) {
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
                }
            }


            // --- 8-3) 상담사 정산: 후불 포함 모든 상담에 지급
            if ($amtInt > 0 && !empty($csrid) && !empty($minfo["mb_id"])) {

            
                insert_point(
                    $minfo["mb_id"],
                    $amtInt,
                    $svc_type . '상담코인 증가',
                    '@platform_consulting',
                    $minfo["mb_id"],
                    $no . '@상담코인 증가@' . ($arr_proc['eventtm'] ?? '')
                );

                // --- 후기작성 독려 알림톡 (상담받은 고객에게 발송) ---
                if (!empty($arr_proc["membid"])) {
                    $_rv_meminfo = get_mbid($arr_proc["membid"]);
                    $_rv_mb_id   = $_rv_meminfo['mb_id'] ?? '';
                    if ($_rv_mb_id !== '') {
                        $_rv_member = get_member($_rv_mb_id);
                        if (!empty($_rv_member['mb_hp'])) {
                            include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
                            include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
                            $bizmsg           = new bizmsg();
                            $bizmsg->phn      = $_rv_member['mb_hp'];
                            $bizmsg->at_type  = '후기 작성 요청';
                            $bizmsg->cus_name = $_rv_member['mb_name'];
                            $bizmsg->csr_name = $minfo['mb_nick'];
                            $bizmsg->url      = "/bbs/write.php?bo_table=review&csr_id=" . urlencode($minfo['mb_id']) . "&cno=" . $no;
                            $bizmsg->send();
                        }
                    }
                }

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

