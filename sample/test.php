<?php
include_once('./_common.php');



exit;

// 아래의 형태 아니라고함. (순차적으로 구하면 될듯함.)

// $mb_id      = 'browny57';

// $g5_shop_coupon_row = sql_query("
// select
//  *
// from
//  g5_shop_coupon
// where   
//  mb_id = '{$mb_id}'
// and 
//  cz_id = '39'
// ");

// //포인트로 할인받은 금액 
// $cp_point = 0;


// while ($drow = sql_fetch_array($g5_shop_coupon_row)) {
//     $query_point = "
//     select
//      *
//     from
//      g5_point
//     where
//      po_content like '%{$drow['cp_id']}%'
//     ";
//     $point = sql_fetch($query_point);
//     $cp_point += (int)$point['po_point'];
// }

// echo "<tr>";
// var_dump($cp_point);
// echo "</tr>";

// 포인트를 검색

// var_dump(calcPointUsage1("browny57","56"));

/**
 * 포인트 사용 시 유료/무료(쿠폰) 분리 계산
 *
 * coupon_use = min(사용금액, max(쿠폰총충전 - 이전쿠폰총사용, 0))
 * paid_use   = 사용금액 - coupon_use
 *
 * @param  string $mb_id       회원 아이디
 * @param  int    $use_amount  사용할 금액
 * @return array  ['free_use'=>무료, 'paid_use'=>유료, 'coupon_remain'=>쿠폰잔액]
 */

// function calcPointUsage1($mb_id, $use_amount)
// {
//     $mb_id_esc = sql_real_escape_string($mb_id);

//     // ── 변경1: cp_id별로 g5_point에서 매칭되는 po_id를 정확히 수집 ──
//     // (sql_fetch = 1건만 → $cp_point 계산과 동일한 기준)
//     $coupon_po_ids = [];  // [po_id => po_point]
//     $coupon_res = sql_query("
//         SELECT cp_id
//         FROM g5_shop_coupon
//         WHERE mb_id = '{$mb_id_esc}' AND cz_id = '39'
//     ");
//     while ($crow = sql_fetch_array($coupon_res)) {
//         $prow = sql_fetch("
//             SELECT po_id, po_point
//             FROM g5_point
//             WHERE mb_id = '{$mb_id_esc}'
//               AND po_point > 0
//               AND po_content LIKE '%{$crow['cp_id']}%'
//         ");
//         if ($prow['po_id']) {
//             $coupon_po_ids[$prow['po_id']] = (int)$prow['po_point'];
//         }
//     }
//     // echo "===>".$coupon_po_ids[$prow['po_id']];

//     // ── 변경2: 전체 내역을 시간순으로 순회하며 쿠폰 잔액 추적 ──
//     $result = sql_query("
//         SELECT po_id, po_point, po_content
//         FROM g5_point
//         WHERE mb_id = '{$mb_id_esc}'
//         ORDER BY po_datetime ASC, po_id ASC
//     ");

//     $coupon_balance = 0;  // 쿠폰 잔액 (시간순 추적)
//     $coupon_used    = 0;  // 쿠폰 총 사용금액

//     while ($row = sql_fetch_array($result)) {
//         $po_id = $row['po_id'];
//         $point = (int)$row['po_point'];

//         if (isset($coupon_po_ids[$po_id])) {
//             // 쿠폰 충전 건 → 잔액 증가
//             $coupon_balance += $point;
//         } else if ($point < 0) {
//             // 사용 → 쿠폰 잔액부터 차감, 부족하면 유료
//             $abs_point   = abs($point);
//             $this_coupon = min($abs_point, $coupon_balance);
//             $coupon_balance -= $this_coupon;
//             $coupon_used    += $this_coupon;
//         } else if ($point > 0 && strpos($row['po_content'], '환불') !== false) {
//             // 환불 → 쿠폰 사용분부터 역복원
//             $restore = min($point, $coupon_used);
//             $coupon_balance += $restore;
//             $coupon_used    -= $restore;
//         }
//     }

//     // 이번 사용 계산
//     $free_use = min($use_amount, $coupon_balance);
//     $paid_use = $use_amount - $free_use;

//     return [
//         'free_use'      => $free_use,                     // 무료(쿠폰) 사용금액
//         'paid_use'      => $paid_use,                     // 유료 사용금액
//         'coupon_remain' => $coupon_balance - $free_use,   // 쿠폰 잔액
//         'coupon_used'   => $coupon_used,                  // 지금까지 사용된 쿠폰 총액
//     ];
// }


/**
 * 3월 상담 건 amt_free / amt_pro 일괄 업데이트
 *
 * 로직:
 * 1. platform_consulting에서 3월 상담 건 조회 (amt > 0, wr_datetime 오름차순)
 * 2. 각 상담 건의 mb_id로 g5_point 내역을 상담 시점(wr_datetime) 이전까지만 순회
 * 3. 쿠폰 잔액을 시간순 추적하여 해당 상담의 free/paid 분리
 * 4. platform_consulting 업데이트
 */
// function batchUpdateMarch()
// {
//     // 2~3월 상담 건 조회 (시간순)
//     $consultations = sql_query("
//         SELECT no, membid, amt, wr_datetime
//         FROM platform_consulting
//         WHERE wr_datetime >= '2026-02-01' AND wr_datetime < '2026-04-01'
//           AND amt > 0
//         ORDER BY wr_datetime ASC
//     ");

//     $updated = 0;

//     echo "<h3>2~3월 상담 건 amt_free/amt_pro 일괄 업데이트</h3>";
//     echo "<table border='1' cellpadding='5'>";
//     echo "<tr><th>no</th><th>membid</th><th>mb_id</th><th>amt</th><th>wr_datetime</th><th>free</th><th>paid</th></tr>";

//     while ($c = sql_fetch_array($consultations)) {
//         $amt       = (int)$c['amt'];
//         $no        = $c['no'];
//         $wr_dt     = $c['wr_datetime'];

//         $meminfo   = get_mbid($c['membid']);
//         $m_id      = $meminfo['mb_id'] ?? '';
//         if (!$m_id) {
//             // 회원 매핑 실패 → 전액 유료 처리
//             sql_query("
//                 UPDATE platform_consulting
//                 SET amt_free = '0', amt_pro = '{$amt}'
//                 WHERE no = '{$no}'
//             ");
//             $updated++;
//             echo "<tr><td>{$no}</td><td>{$c['membid']}</td><td>(매핑실패)</td><td>{$amt}</td><td>{$wr_dt}</td><td style='color:red'>0</td><td style='color:red'>{$amt}</td></tr>";
//             continue;
//         }
//         $mb_id_esc = sql_real_escape_string($m_id);

//         // 이 회원의 쿠폰 po_id 수집 (calcPointUsage1과 동일 기준)
//         $coupon_po_ids = [];
//         $cr = sql_query("
//             SELECT cp_id FROM g5_shop_coupon
//             WHERE mb_id = '{$mb_id_esc}' AND cz_id = '39'
//         ");
//         while ($crow = sql_fetch_array($cr)) {
//             $prow = sql_fetch("
//                 SELECT po_id, po_point FROM g5_point
//                 WHERE mb_id = '{$mb_id_esc}' AND po_point > 0
//                   AND po_content LIKE '%{$crow['cp_id']}%'
//             ");
//             if ($prow['po_id']) {
//                 $coupon_po_ids[$prow['po_id']] = (int)$prow['po_point'];
//             }
//         }

//         // 이 상담 시점 이전까지의 g5_point 내역 순회 → 쿠폰 잔액 추적
//         $result = sql_query("
//             SELECT po_id, po_point, po_content
//             FROM g5_point
//             WHERE mb_id = '{$mb_id_esc}' AND po_datetime < '{$wr_dt}'
//             ORDER BY po_datetime ASC, po_id ASC
//         ");

//         $coupon_balance = 0;
//         $coupon_used_so_far = 0;
//         while ($row = sql_fetch_array($result)) {
//             $po_id = $row['po_id'];
//             $point = (int)$row['po_point'];

//             if (isset($coupon_po_ids[$po_id])) {
//                 $coupon_balance += $point;
//             } else if ($point < 0) {
//                 $this_coupon = min(abs($point), $coupon_balance);
//                 $coupon_balance -= $this_coupon;
//                 $coupon_used_so_far += $this_coupon;
//             } else if ($point > 0 && strpos($row['po_content'], '환불') !== false) {
//                 $restore = min($point, $coupon_used_so_far);
//                 $coupon_balance += $restore;
//                 $coupon_used_so_far -= $restore;
//             }
//         }

//         // 이 상담의 free/paid 계산
//         $free_use = min($amt, $coupon_balance);
//         $paid_use = $amt - $free_use;
        
//         // 업데이트
//         sql_query("
//             UPDATE platform_consulting
//             SET amt_free = '{$free_use}', amt_pro = '{$paid_use}'
//             WHERE no = '{$no}'
//         ");
//         $updated++;

//         echo "<tr><td>{$no}</td><td>{$c['membid']}</td><td>{$m_id}</td><td>{$amt}</td><td>{$wr_dt}</td><td>{$free_use}</td><td>{$paid_use}</td></tr>";
//     }

//     echo "</table>";
//     echo "<p>총 {$updated}건 업데이트 완료</p>";

//     // ── 폴백: 아직 amt_free=0, amt_pro=0인 건 → 전액 유료 처리 ──
//     $remain = sql_fetch("
//         SELECT COUNT(*) as cnt FROM platform_consulting 
//         WHERE wr_datetime >= '2026-02-01' AND wr_datetime < '2026-04-01'
//           AND amt > 0 AND amt_free = 0 AND amt_pro = 0
//     ");
//     $remain_cnt = (int)$remain['cnt'];
//     if ($remain_cnt > 0) {
//         sql_query("
//             UPDATE platform_consulting 
//             SET amt_pro = amt 
//             WHERE wr_datetime >= '2026-02-01' AND wr_datetime < '2026-04-01'
//               AND amt > 0 AND amt_free = 0 AND amt_pro = 0
//         ");
//         echo "<p style='color:red;font-weight:bold;'>폴백: 나머지 {$remain_cnt}건 → 전액 유료(amt_pro=amt) 일괄 처리</p>";
//     }

//     // ── 최종 확인: 아직 남은 0/0 건 ──
//     $still = sql_fetch("
//         SELECT COUNT(*) as cnt FROM platform_consulting 
//         WHERE wr_datetime >= '2026-02-01' AND wr_datetime < '2026-04-01'
//           AND amt > 0 AND amt_free = 0 AND amt_pro = 0
//     ");
//     echo "<p>최종 확인 - 남은 0/0 건: <strong>{$still['cnt']}건</strong></p>";
// }

// // ── 테이블 구조 확인 ──
// echo "<h3>platform_consulting 테이블 구조</h3>";
// $desc_res = sql_query("DESCRIBE platform_consulting");
// echo "<table border='1' cellpadding='4'><tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th></tr>";
// while ($dr = sql_fetch_array($desc_res)) {
//     echo "<tr><td>{$dr['Field']}</td><td>{$dr['Type']}</td><td>{$dr['Null']}</td><td>{$dr['Key']}</td><td>{$dr['Default']}</td></tr>";
// }
// echo "</table>";

// // ── 3월 샘플 1건 확인 ──
// $sample = sql_fetch("SELECT * FROM platform_consulting WHERE wr_datetime >= '2026-02-01' AND wr_datetime < '2026-04-01' AND amt > 0 LIMIT 1");
// echo "<h3>2~3월 샘플 1건</h3><pre>"; print_r($sample); echo "</pre>";

// // 실행
// batchUpdateMarch();

// $mb_id      = 'browny57';
// $use_amount = 15000;


// /* =========================
//    시간순 처리 방식으로 쿠폰 잔액 산출
//    - 충전 시: 쿠폰이면 쿠폰잔액 증가
//    - 사용 시: 쿠폰잔액부터 소진 (무료) → 나머지는 유료
//    - 회수 시: 쿠폰잔액에서 차감
// ========================= */

// $result = calcPointUsage($mb_id, $use_amount);

// echo "<h3>[디버그] 포인트 내역 시뮬레이션</h3>";
// echo "<pre>";
// echo "마지막 사용 po_id: " . $result['_debug']['last_use_id'] . "\n";
// echo "마지막 사용 시각: " . $result['_debug']['last_use_dt'] . "\n";
// echo "마지막 사용 이후 쿠폰 잔액: " . $result['_debug']['coupon_after'] . "\n";
// echo "---\n";
// echo "이번 사용({$use_amount})원 → 무료: " . $result['free_use'] . " / 유료: " . $result['paid_use'] . "\n";
// echo "쿠폰 잔여: " . $result['coupon_remain'] . "\n";
// echo "</pre>";

// // 마지막 사용 이후 쿠폰 충전 내역 상세 확인
// echo "<h3>[디버그] 마지막 사용 이후 쿠폰 충전 내역</h3>";
// echo "<table border='1' cellpadding='5' cellspacing='0'>";
// echo "<tr><th>po_id</th><th>po_datetime</th><th>po_point</th><th>po_content</th></tr>";
// $debug_res = sql_query("
//     SELECT po_id, po_datetime, po_point, po_content
//     FROM g5_point
//     WHERE mb_id = '".sql_real_escape_string($mb_id)."'
//       AND po_content LIKE '%쿠폰%'
//       AND (po_datetime > '{$result['_debug']['last_use_dt']}'
//            OR (po_datetime = '{$result['_debug']['last_use_dt']}' AND po_id > {$result['_debug']['last_use_id']}))
//     ORDER BY po_datetime ASC, po_id ASC
// ");
// while ($drow = sql_fetch_array($debug_res)) {
//     echo "<tr>";
//     echo "<td>{$drow['po_id']}</td>";
//     echo "<td>{$drow['po_datetime']}</td>";
//     echo "<td>{$drow['po_point']}</td>";
//     echo "<td>".htmlspecialchars($drow['po_content'])."</td>";
//     echo "</tr>";
// }
// echo "</table>";

// var_dump($result);



// /* =========================
//    무료 / 유료 계산 함수
//    (시간순 처리 방식)
// ========================= */

// function calcPointUsage($mb_id, $use_amount)
// {
//     $mb_id_esc = sql_real_escape_string($mb_id);

//     // 1) 마지막 일반 사용 건(쿠폰 회수 제외) 시점 찾기
//     $last_use = sql_fetch("
//         SELECT po_id, po_datetime
//         FROM g5_point
//         WHERE mb_id = '{$mb_id_esc}'
//           AND po_point < 0
//           AND NOT (po_content LIKE '%회수%' AND po_content LIKE '%쿠폰%')
//         ORDER BY po_datetime DESC, po_id DESC
//         LIMIT 1
//     ");

//     if ($last_use['po_id']) {
//         $last_dt = $last_use['po_datetime'];
//         $last_id = (int)$last_use['po_id'];

//         // 2) 마지막 사용 이후 충전된 쿠폰 합계
//         $row = sql_fetch("
//             SELECT IFNULL(SUM(po_point), 0) as coupon_in
//             FROM g5_point
//             WHERE mb_id = '{$mb_id_esc}'
//               AND po_point > 0
//               AND po_content LIKE '%쿠폰%'
//               AND (po_datetime > '{$last_dt}'
//                    OR (po_datetime = '{$last_dt}' AND po_id > {$last_id}))
//         ");
//         $coupon_in = (int)$row['coupon_in'];

//         // 3) 마지막 사용 이후 쿠폰 회수 합계
//         $row2 = sql_fetch("
//             SELECT IFNULL(SUM(ABS(po_point)), 0) as coupon_rtn
//             FROM g5_point
//             WHERE mb_id = '{$mb_id_esc}'
//               AND po_point < 0
//               AND po_content LIKE '%회수%'
//               AND po_content LIKE '%쿠폰%'
//               AND (po_datetime > '{$last_dt}'
//                    OR (po_datetime = '{$last_dt}' AND po_id > {$last_id}))
//         ");
//         $coupon_rtn = (int)$row2['coupon_rtn'];

//         $coupon_balance = max($coupon_in - $coupon_rtn, 0);
//     } else {
//         // 사용 건이 하나도 없으면 전체 쿠폰 잔액
//         $row = sql_fetch("
//             SELECT IFNULL(SUM(CASE
//                 WHEN po_point > 0 AND po_content LIKE '%쿠폰%' THEN po_point
//                 WHEN po_point < 0 AND po_content LIKE '%회수%' AND po_content LIKE '%쿠폰%' THEN po_point
//                 ELSE 0
//             END), 0) as coupon_balance
//             FROM g5_point
//             WHERE mb_id = '{$mb_id_esc}'
//         ");
//         $coupon_balance = max((int)$row['coupon_balance'], 0);
//     }

//     $free_use = min($use_amount, $coupon_balance);
//     $paid_use = $use_amount - $free_use;

//     return [
//         'free_use'      => $free_use,
//         'paid_use'      => $paid_use,
//         'coupon_remain' => $coupon_balance - $free_use,
//         '_debug' => [
//             'last_use_id'   => $last_use['po_id'] ?? 'none',
//             'last_use_dt'   => $last_use['po_datetime'] ?? 'none',
//             'coupon_after'  => $coupon_balance,
//         ]
//     ];
// }
// SELECT SUM(ABS(po_point)) as po_coupon_tot
//     FROM g5_point
//     WHERE 
//     po_content like '%회수%'
//     AND 
//     po_point < 0
 

// 외부 호출 예시 (토큰 = 콤마로 구분된 mb_id 문자열)
// $token = "hong123,kim456,park789,lee001,...";
// $res = aligo_send_coupon_save('CP001', 'CZ001', $token);

// include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
// include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
// $bizmsg           = new bizmsg();
// $bizmsg->phn      = $meminfo['mb_hp'];
//                 $bizmsg->at_type  = '후기 작성 요청';
//                 $bizmsg->usr_name = $meminfo["mb_name"];
//                 $bizmsg->csr_name = $minfo["mb_name"].'님';
//                 $bizmsg->cus_name = $meminfo["mb_name"].'님';
//                 $bizmsg->url  = $aligo_url;
//                 $bizmsg->url1 = $aligo_url;
//                 $bizmsg->send();  // ★ send() 호출 추가



exit;
// ===== 테스트 끝 =====
// $res = set_crs_status_chg("17473", "RDVC");
// var_dump($res);
// $isql = "
// insert 
// into 
// aligo_send_log_t(`mb_id`, `mb_name`, `csr_name`, `mb_hp`, `aligo_subject`, `aligo_url`,`aligo_wdate`)
// values
// (
// '" . "mb_id" . "',
// '" . "mb_name" . "',
// '" . "csr_name" . "',
// '" . "mb_hp" . "',
// '" . "aligo_subject" . "',
// '" . "aligo_url" . "',
// now()
// )";
// @sql_query($isql);
// //
// $bizmsg           = new bizmsg();
// $bizmsg->phn      = "010-6663-3914";
// $bizmsg->at_type  = '후기 작성 요청'; //
// $bizmsg->usr_name = '진유비';   // cus_name 대신 usr_name 사용
// $bizmsg->csr_name = '상담사님';
// $bizmsg->cus_name = '진유비님';

// $bizmsg->url  = 'coin/coin_fill.php';
// $bizmsg->url1 = 'coin/coin_fill.php';

// // ★ 디버그: 전송 데이터 확인 (확인 후 삭제)
// $bizmsg->set_msg();
// echo "<h3>== tmplId: " . $bizmsg->tmplId . " ==</h3>";
// echo "<pre>";
// echo "button1: "; print_r($bizmsg->button1);
// echo "\nmsg:\n" . $bizmsg->msg;
// echo "</pre>";
// echo "<p>★ Bizmsg 콘솔에서 review_req 템플릿의 버튼 URL을 확인하고,<br>";
// echo "위 url_mobile/url_pc 값과 <b>정확히 동일한 URL</b>을 넣어서 테스트하세요.</p>";
// // ★ 디버그 끝
// $rr  = $bizmsg -> send(); 
// //회원의 ID를 추출해서 전송 처리
// echo "<h3>== API 응답 ==</h3>";

// var_dump($rr);


// include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');
// 로그인했을때 생년월일 재 구독하면됨.
// echo "푸시전송 시작---------------------------";
// send_noti_topic("chl_birth_1990","푸시알림확인1","푸시메세지","1","1","","https://sajumoon.co.kr/etc/set.php","");
// echo "푸시전송끝---------------------------";
exit;

// function send_noti_token($token,$title,$msg,$push_type="",$ref_idx1="",$ref_idx2="",$event_url,$push_image=""){
//     global $DB;
    
//     $url = 'https://fcm.googleapis.com/v1/projects/thesaju-91d04/messages:send';
//     putenv('GOOGLE_APPLICATION_CREDENTIALS='.$_SERVER['DOCUMENT_ROOT'].'/lib/thesaju록_push_key.json');
//     $event_url = preg_replace('/\s+/', '', $event_url);
//     $scope = 'https://www.googleapis.com/auth/firebase.messaging';
//     $client = new Google_Client();
//     $client->useApplicationDefaultCredentials();
//     $client->setScopes($scope);
//     $auth_key = $client->fetchAccessTokenWithAssertion();
//     $ch = curl_init();
//     $notification_opt = array (
//        'title'     => $title,
//        'body'      => $msg,
//     );
//     if($push_image != ""){
//       $notification_opt['image'] = $push_image;
//     }

//     $datas = array (
//       'title'     => $title,
//       'body'      => $msg,
//       'ref_idx1'  => $ref_idx1,
//       'ref_idx2'  => $ref_idx2,
//       'push_type' => $push_type
//     );
//     $datas['event_url'] = $event_url;
//     if($push_image != ""){
//       $datas['image'] = $push_image;
//     }
//     $android_opt = array (
//       'notification' => array(
//           'default_sound' => true,
//           "channel_id"    =>  'default',
//       ),
//       'priority' => 'high',
//       'data' => $datas
//     );
//     $message = array
//     (
//         'notification' => $notification_opt,
//         'data'         => $datas,
//         'android'      => $android_opt
//     );
//     $last_msg = array (
//         "message" => $message
//     );

    
//     $headers = array
//     (
//         'Authorization: Bearer ' . $auth_key['access_token'],
//         'Content-Type: application/json'
//     );
//     curl_setopt($ch, CURLOPT_HEADER, true);
//     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
//     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//     curl_setopt($ch, CURLOPT_URL, $url);
//     curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
//     curl_setopt($ch, CURLOPT_POST, 1);
//     curl_setopt($ch, CURLOPT_POSTFIELDS,json_encode($last_msg));
//     $result = curl_exec($ch);
//     if($result === FALSE){

//     }
// }

// function send_noti_topic($topic,$title,$msg,$push_type="",$ref_idx1="",$ref_idx2="",$event_url,$push_image=""){
//     global $DB;
    
//     $url = 'https://fcm.googleapis.com/v1/projects/thesaju-91d04/messages:send';
//     putenv('GOOGLE_APPLICATION_CREDENTIALS='.$_SERVER['DOCUMENT_ROOT'].'/lib/thesaju_push_key.json');
//     $event_url = preg_replace('/\s+/', '', $event_url);
//     $scope = 'https://www.googleapis.com/auth/firebase.messaging';
//     $client = new Google_Client();
//     $client->useApplicationDefaultCredentials();
//     $client->setScopes($scope);
//     $auth_key = $client->fetchAccessTokenWithAssertion();
//     $ch = curl_init();
//     $notification_opt = array (
//        'title'     => $title,
//        'body'      => $msg,
//     );
//     if($push_image != ""){
//       $notification_opt['image'] = $push_image;
//     }

//     $datas = array (
//       'title'     => $title,
//       'body'      => $msg,
//       'ref_idx1'  => $ref_idx1,
//       'ref_idx2'  => $ref_idx2,
//       'push_type' => $push_type
//     );
//     $datas['event_url'] = $event_url;
//     if($push_image != ""){
//       $datas['image'] = $push_image;
//     }
//     $android_opt = array (
//       'notification' => array(
//           'default_sound' => true,
//           "channel_id"    =>  'default',
//       ),
//       'priority' => 'high',
//       'data' => $datas
//     );
//     $message = array
//     (
//         'topic'        => $topic,
//         'notification' => $notification_opt,
//         'data'         => $datas,
//         'android'      => $android_opt
//     );
//     $last_msg = array (
//         "message" => $message
//     );

//     header('Content-Type: application/json; charset=UTF-8');
//     echo json_encode($last_msg, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
//     exit;


//     $headers = array
//     (
//         'Authorization: Bearer ' . $auth_key['access_token'],
//         'Content-Type: application/json'
//     );
//     curl_setopt($ch, CURLOPT_HEADER, true);
//     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
//     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//     curl_setopt($ch, CURLOPT_URL, $url);
//     curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
//     curl_setopt($ch, CURLOPT_POST, 1);
//     curl_setopt($ch, CURLOPT_POSTFIELDS,json_encode($last_msg));
//     $result = curl_exec($ch);
//     if($result === FALSE){

//     }
// }


// // $query = "
 

// // ";

// // echo "<h3>소셜 로그인 형태 mb_id인데 g5_member_social_profiles에 없는 회원 목록</h3>";
// // $sql = "SELECT m.mb_id, m.mb_name, m.mb_nick, m.mb_datetime 
// //         FROM {$g5['member_table']} m
// //         LEFT JOIN g5_member_social_profiles sp ON m.mb_id = sp.mb_id
// //         WHERE (m.mb_id LIKE 'kakao\\_%' OR m.mb_id LIKE 'naver\\_%' OR m.mb_id LIKE 'google\\_%' OR m.mb_id LIKE 'facebook\\_%' OR m.mb_id LIKE 'apple\\_%')
// //         AND sp.mb_id IS NULL
// //         ORDER BY m.mb_datetime DESC";
// // echo "<p><b>쿼리:</b> " . htmlspecialchars($sql) . "</p>";
// // $result = sql_query($sql);
// // $cnt = 0;
// // echo "<table border='1' cellpadding='5' cellspacing='0'>";
// // echo "<tr><th>No</th><th>mb_id</th><th>이름</th><th>닉네임</th><th>가입일</th></tr>";
// // while($row = sql_fetch_array($result)){
// //     $cnt++;
// //     echo "<tr>";
// //     echo "<td>{$cnt}</td>";
// //     echo "<td>{$row['mb_id']}</td>";
// //     echo "<td>{$row['mb_name']}</td>";
// //     echo "<td>{$row['mb_nick']}</td>";
// //     echo "<td>{$row['mb_datetime']}</td>";
// //     echo "</tr>";
// // }
// // echo "</table>";
// // echo "<p><b>총 {$cnt}건</b></p>";

// exit;

// // $mb_id = "";

// // $mb = get_member("117810");

// // var_dump($mb);

// // $mb_name  = $mb['mb_name'];
// // $mb_hp    = $mb['mb_hp'];
// // $mb_point = $mb['mb_point'];

// // echo $headerKey;
// // exit;

// // 01081310345

// // $data = '{"csrnm":"'."금령".'","state":"ABSE","sortno":20,"dtmfno":"117831", "telno":"'.str_replace("-","","81310345").'","dectm":30,"decamt":1000, "preflag": "P" , "chatdectm": 30, "chatdecamt":800}';
// // var_dump($data);
// // $murl = "csr-mgr";
// // // var_dump($CPID);
// // $jresult = send_mjson($murl, $data, 'POST');
// // var_dump($jresult);


// // //////////////// passnet 회원등록 ///////////////
// // $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'","amt":'.$mb["mb_point"].'}';
// // $murl1 = "memb-mgr";
// // var_dump($data);



// // $jresult1 = send_mjson($murl1, $data, 'POST');
// // var_dump($jresult1);



// // include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/config.php');
// // include_once(G5_PLUGIN_PATH.'/wz_alimtalk_bizm/bizmsg.class.php');
// // include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');


// //error_reporting(E_ALL);
// //ini_set('display_errors', '1');
// //ini_set('memory_limit','-1');
// //
// //
// //$atm = 50;
// //
// //
// //$data = '{"membnm":"테스트22","telno":"01000000000","amt":'.$atm.'}';
// //			$murl1 = "memb-mgr";
// //			$jresult1 = send_mjson($murl1, $data, 'POST');
// //
// //
// //print_r($jresult1);
// //

// exit;


// //phpinfo();
// //exit;

// //error_reporting(E_ALL);
// //ini_set('display_errors', '1');

// sendPushNotification('dRgk-N1UtkmXtJlQ6-h-Eg:APA91bGBC80Vl2dqpDHo8qEFT5JcXSHIU0bxIOrKHGEb6HlGDqd61336lcqyRvUpFiZBsqKCDwj9BC_alil2_pSlkpHMPz96NjQVsE6HSuyv_uImdbsTghc', 'https://sajumoon.co.kr', '제목', '내용');


// exit;

// $mb_hp = "010-8249-0851";


// exit;

// //// 상담사 접속알림

// $bizmsg = new bizmsg();
// 					$bizmsg->phn                = $mb_hp;
// 					$bizmsg->at_type            = '상담사 접속 알림'; //
// 					$bizmsg->con_name           = "상담사닉";
// 					$rr = $bizmsg->send(); 

// 					print_r($rr);

// exit;

// ///입금계좌 안내

// $bizmsg = new bizmsg();
// 								$bizmsg->phn                = $mb_hp;
// 								$bizmsg->at_type            = '입금계좌 안내'; //
// 								$bizmsg->usr_name     = "제이테스트";
// 								$bizmsg->goods_name           = '코인결제';  // 상품명
// 								$bizmsg->usr_bank_price           = "50,000";  /// 입금액
// 								$bizmsg->usr_bank_num           = "기업은행 527-001772-02-018";  /// 입금계좌
// 								$rr = $bizmsg->send(); 
// 						   // 카톡 알림 발송끝 //

// exit;


// /// 입금확인


// // 카톡 알림 발송 //
				
// 		$bizmsg = new bizmsg();
// 			$bizmsg->phn                = $mb_hp;
// 			$bizmsg->at_type            = '입금확인'; //
// 			$bizmsg->usr_name     = "제이테스트";
// 			$bizmsg->goods_name           = '코인결제';  // 상품명
// 			$bizmsg->usr_bank_price           = "50,000";  /// 입금액
// 			$rr = $bizmsg->send(); 
// 	   // 카톡 알림 발송끝 //


// exit;
// //// 회원가입

// 		$bizmsg = new bizmsg();
// 		$bizmsg->phn                = "010-8249-0851";
// 		$bizmsg->at_type            = '회원가입 축하'; //
// 		$bizmsg->usr_id           = "jtest";
// 		$bizmsg->usr_name           = "제이테스트";
// 		$bizmsg->usr_nick           = "제이테스트";

// 		$rr = $bizmsg->send(); 

// 		print_r($rr);




// exit;

// $tmpdate = date("Y-m",time())."-01";

// $lastday = date('t', strtotime($tmpdate));

// $nowday = date("d",time());

// if($nowday==$lastday){
// 	$sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
// 	echo $sql;
// 	echo "<br />";
// 	$result = sql_query($sql);
// 	if($result){
// 		while($row = sql_fetch_array($result)){
// 			set_con_account($row["mb_id"]);
// 		}
// 	}
// }


// exit;


// $response = '{"req_result":"00","resultmessage":"정상처리","tid":"24920325721898","oid":"the_1729039841076"}{"req_result":"00","resultmessage":"결제취소처리성공[the_1729039841076]"}';

// // 결과
// print_r($retjson);

// exit;

// /// 회원 코드 6자리 맞추기

// $sql = "SELECT * FROM `g5_member` WHERE 1 AND mb_level = '2' AND LENGTH( mb_1 ) <6 and mb_1<>'' ORDER BY mb_datetime DESC";
// $result = sql_query($sql);

// if($result){
// 	while($res=sql_fetch_array($result)){
	
// 		$mb_1 = sprintf("%06d",$res["mb_1"]);


// 		$usql = "update g5_member set mb_1='".$mb_1."' where mb_id='".$res["mb_id"]."'";
		
// 		echo $usql;
// 		echo "<br>";
		
// 		sql_query($usql);
// 	}
// }

// exit;
// if(!get_passcall_member($member["mb_1"])){
// 	echo "회원 없음 에러";
// }

// exit;

// $sql = "select * from g5_point order by po_datetime desc";
// $result = sql_query($sql);

// if($result){
// 	while($row=sql_fetch_array($result)){
// 		$p_gubun = "";
// 		$amt = $row["po_point"];
// 		if($amt >10000){
// 			$p_gubun = "Y";
// 		}else{
// 			$p_gubun = "N";
// 		}

	
// 		$usql = "update g5_point set p_gubun='".$p_gubun."' where po_id='".$row["po_id"]."'";
// 		echo $amt;
// 		echo "<br>";
// 		echo $usql;
// 		echo "<br>";
// 		@sql_query($usql);
// 	}
// }





// exit;

// $sql = "select * from platform_consulting where  reason='DISCONNECT' order by wr_datetime desc";
// $result = sql_query($sql);

// if($result){
// 	while($row=sql_fetch_array($result)){
// 		$p_gubun = "";
// 		$amt = (int)$row["amt"];
// 		if($amt >10000){
// 			$p_gubun = "Y";
// 		}else{
// 			$p_gubun = "N";
// 		}

		
// 		$usql = "update platform_consulting set p_gubun='".$p_gubun."' where no='".$row["no"]."'";
// 		echo $amt;
// 		echo "<br>";
// 		echo $usql;
// 		echo "<br>";
// 		@sql_query($usql);
// 	}
// }





// exit;

// $flags = mail("jkb@joagift.com", "This is test", "This i s body");

// if($flags) {
//         echo "Success !!";
// } else {
//         echo "Failed !!";
// }




// exit;
// $sql = "select * from platform_consulting where reason='DISCONNECT' order by wr_datetime";
// $result = sql_query($sql);
// if($result){
// 	while($row=sql_fetch_array($result)){
		
// 		$amt = (int)$row["amt"];
// 		if($amt > 0){
// 			$p_gubun = "N";
// 			if($amt >=10000){
// 				$p_gubun = "Y";
// 			}
// 			$usql = "update platform_consulting set p_gubun='".$p_gubun."' where no='".$row["no"]."'";
// 			//echo $usql;
// 			//echo "<br>";
// 			sql_query($usql);
// 		}
// 	}
// }


// //$sql = "select state from g5_member where mb_level='5'";
// //$r = sql_query($sql);
// //if($r){
// //	while($row=sql_fetch_array($r)){
// //	
// //		$sql1 = "select count(*) as ct from member_status_history where mb_id='".$row["mb_id"]."'";
// //		$row1 = sql_fetch($sql1);
// //
// //		if(!$row1["ct"]){
// //			set_constate($row["mb_id"], $mode);  /// 기록을 남긴다 
// //		}
// //
// //	
// //	}
// //}

// //$sql = "SELECT * FROM g5_member WHERE mb_level = '5' AND LENGTH( mb_1 ) = '6' order by mb_datetime desc limit 0,2000";
// //$result = sql_query($sql);
// //if($result){
// //	while($row=sql_fetch_array($result)){
// //		
// //		
// //
// //		$len = strlen($row["mb_1"]);
// //
// //		if($len=="6"){
// //		
// //		$mb_1 = substr($row["mb_1"],1,6);
// //
// //		$usql = "update g5_member set mb_1='".$mb_1."' where mb_id='".$row["mb_id"]."'";
// //		sql_query($usql);
// //		echo $usql;
// //		echo "<br>";
// //		}
// //	}
// //}



// //exit;

// exit;
// $mb_id = "cktpfkd1@naver.com";
// $minfo = get_member($mb_id);
// $po_mb_point= "38900";

// $data = '{"membnm":"'.$minfo["mb_name"].'","amt":'.$po_mb_point.'}';
// $murl1 = "memb-mgr";
// $jresult = send_mjson($murl1, $data, 'PUT', $minfo["mb_1"]);

// print_r($jresult);



// exit;


// $flags = mail("jkb@joagift.com", "This is test", "This i s body");

// if($flags) {
//         echo "Success !!";
// } else {
//         echo "Failed !!";
// }








?>