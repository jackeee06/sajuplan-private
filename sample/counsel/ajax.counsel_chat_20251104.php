<?php
include_once('./_common.php');



// ===== [교체본] : 포인트 증가분을 방 배정 초에 동기화(+초기화까지) =====
function sync_room_point_increase($token_raw) {

    $tok = $token_raw;
    if (preg_match('/[12]$/', $tok)) $tok = substr($tok, 0, -1);
    $safe = sql_real_escape_string($tok);

    sql_query("START TRANSACTION");

    $room = sql_fetch("
        SELECT room_token, mb_id, csr_id, unit_sec, unit_cost,
               alloc_sec_user, alloc_sec_csr, point_residue, snap_mb_point
          FROM chat_room
         WHERE room_token = '{$safe}'
         FOR UPDATE
    ");

    if (!$room) { sql_query("ROLLBACK"); return ['ok'=>false, 'msg'=>'no-room']; }

    $unit_sec  = (int)$room['unit_sec'];
    $unit_cost = (int)$room['unit_cost'];

    // 단가가 비어있으면 상담사에서 스냅샷
    if ($unit_sec <= 0 || $unit_cost <= 0) {
        $csr = sql_fetch("
            SELECT mb_12, mb_13
              FROM g5_member
             WHERE mb_1 = '".sql_real_escape_string($room['csr_id'])."'
             LIMIT 1 FOR UPDATE
        ");
        $unit_sec  = (int)$csr['mb_12'];
        $unit_cost = (int)$csr['mb_13'];
        sql_query("
            UPDATE chat_room
               SET unit_sec  = {$unit_sec},
                   unit_cost = {$unit_cost}
             WHERE room_token = '{$safe}'
             LIMIT 1
        ");
    }

    // 현재 사용자 지갑 포인트
    $user = sql_fetch("
        SELECT mb_point
          FROM g5_member
         WHERE mb_1 = '".sql_real_escape_string($room['mb_id'])."'
         LIMIT 1 FOR UPDATE
    ");
    $curr_pts = (int)$user['mb_point'];

    // snap이 0이면 "초기 배정" 수행
    if ((int)$room['snap_mb_point'] <= 0) {
        $alloc_units = ($unit_cost > 0) ? intdiv(max(0, $curr_pts), $unit_cost) : 0;
        $alloc_sec   = $alloc_units * max(0, $unit_sec);
        $residue     = ($unit_cost > 0) ? ($curr_pts - ($alloc_units * $unit_cost)) : 0;

        sql_query("
            UPDATE chat_room
               SET alloc_sec_user = GREATEST(alloc_sec_user, {$alloc_sec}),
                   alloc_sec_csr  = GREATEST(alloc_sec_csr , {$alloc_sec}),
                   point_residue  = {$residue},
                   snap_mb_point  = {$curr_pts}
             WHERE room_token = '{$safe}'
             LIMIT 1
        ");
        sql_query("COMMIT");
        return ['ok'=>true, 'added_sec'=>$alloc_sec, 'residue'=>$residue, 'init'=>true];
    }

    // 증가분 동기화
    $delta_pts = $curr_pts - (int)$room['snap_mb_point'];
    if ($delta_pts > 0) {
        $total_pts   = $delta_pts + (int)$room['point_residue'];
        $extra_units = ($unit_cost > 0) ? intdiv($total_pts, $unit_cost) : 0;
        $extra_sec   = $extra_units * max(0, $unit_sec);
        $residue     = ($unit_cost > 0) ? ($total_pts - ($extra_units * $unit_cost)) : 0;

        sql_query("
            UPDATE chat_room
               SET alloc_sec_user = alloc_sec_user + {$extra_sec},
                   alloc_sec_csr  = alloc_sec_csr  + {$extra_sec},
                   point_residue  = {$residue},
                   snap_mb_point  = snap_mb_point + {$delta_pts}
             WHERE room_token = '{$safe}'
             LIMIT 1
        ");
        sql_query("COMMIT");
        return ['ok'=>true, 'added_sec'=>$extra_sec, 'residue'=>$residue, 'init'=>false];
    }

    sql_query("COMMIT");
    return ['ok'=>true, 'added_sec'=>0, 'residue'=>(int)$room['point_residue'], 'init'=>false];
}
// ===== [교체 끝] =====



if($_POST['act'] == 'updateTime') {

    $token = $_POST['token'] ?? '';

    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1); // 마지막 문자 제거
    }

    /*  if ($token) {
          // 존재하는 방인지 확인 후 use_time + 10
          $sql = "
          UPDATE chat_room
          SET use_time = use_time + 10
          WHERE room_token = '{$token}'
      ";

          sql_query($sql);
      }*/
    sql_query("START TRANSACTION");
    $row = sql_fetch("SELECT alloc_sec_user, use_time FROM chat_room WHERE room_token='".sql_real_escape_string($token)."' FOR UPDATE");

    if (!$row) { sql_query("ROLLBACK"); echo json_encode(['success'=>false]); exit; }

    $remain = (int)$row['alloc_sec_user'] - (int)$row['use_time'];
    if ($remain >= 10) {
        sql_query("UPDATE chat_room SET use_time = use_time + 10 WHERE room_token='".sql_real_escape_string($token)."' LIMIT 1");
        sql_query("COMMIT");
        echo json_encode(['success'=>true, 'used'=>10, 'remain'=>$remain-10]); exit;
    } else {
        sql_query("UPDATE chat_room SET status='DISCONNECT' WHERE room_token='".sql_real_escape_string($token)."' LIMIT 1");
        sql_query("COMMIT");
        echo json_encode(['success'=>false, 'reason'=>'no_remain']); exit;
    }
} else if ($_POST['act'] == 'storeChat') {

    //$sql = "INSERT INTO chat_t (mb_id,token,msg,wdate) VALUES ('{$_POST['mbid']}','{$_POST['token']}','{$_POST['msg']}',NOW())";

    // echo $sql;
    // sql_query($sql);
//20250909 eun 위의 3줄에서 아래처럼 변경
    /*$tok = $_POST['token'] ?? '';
    if (preg_match('/[12]$/', $tok)) $tok = substr($tok, 0, -1);
    $safe = sql_real_escape_string($tok);

    // 🔒 방 상태 확인
    $st = sql_fetch("SELECT status FROM chat_room WHERE room_token = '{$safe}' LIMIT 1");
    if (!$st || $st['status'] === 'DISCONNECT') {
        http_response_code(409); // Conflict
        echo json_encode(['success'=>false, 'reason'=>'room_closed']);
        exit;
    }

    $msg = $_POST['msg'] ?? '';
    $mbid = sql_real_escape_string($_POST['mbid'] ?? '');

    $sql = "INSERT INTO chat_t (mb_id, token, msg, wdate)
            VALUES ('{$mbid}', '{$safe}', '".sql_real_escape_string($msg)."', NOW())";
    sql_query($sql);

    echo json_encode(['success'=>true]);*/
    //20251104 원래 토큰이 1이나 2로 끝나는 경우 처리
    // 원본 토큰 받기
    $token = $_POST['token'] ?? '';

    // room_token은 항상 앞 6자리
    $room_token = substr($token, 0, 6);

    // flag는 7번째 자리(인덱스 6) 기준
    $flag = substr($token, 6, 1);
    if ($flag !== '1' && $flag !== '2') {
        $flag = null; // 유효하지 않으면 null 처리
    }

    // SQL 인젝션 방지
    $safe_token = sql_real_escape_string($room_token);
    $mbid = sql_real_escape_string($_POST['mbid'] ?? '');
    $msg = sql_real_escape_string($_POST['msg'] ?? '');

    // 방 상태 확인
    $st = sql_fetch("SELECT status FROM chat_room WHERE room_token = '{$safe_token}' LIMIT 1");
    if (!$st || $st['status'] === 'DISCONNECT') {
        http_response_code(409); // Conflict
        echo json_encode(['success' => false, 'reason' => 'room_closed']);
        exit;
    }

    // 채팅 저장
    $sql = "
        INSERT INTO chat_t (mb_id, token, msg, wdate)
        VALUES ('{$mbid}', '{$safe_token}', '{$msg}', NOW())
    ";
    sql_query($sql);

    echo json_encode(['success' => true]);
} else if ($_POST['act'] == 'uploadChatImg') {

    ob_clean(); // 버퍼 내용 지우기
    header('Content-Type: application/json; charset=utf-8');

    if (!empty($_FILES['upload_file'])) {
        $file = $_FILES['upload_file'];

        $originalName = basename($file['name']); // 원본 파일명
        $ext = pathinfo($originalName, PATHINFO_EXTENSION);         // 확장자
        $base = pathinfo($originalName, PATHINFO_FILENAME);         // 이름 부분
        $rand = bin2hex(random_bytes(4)); // 랜덤 8자리 문자열 (ex: a1b2c3d4)

        $newName = $base . '_' . $rand . '.' . $ext; // 새 파일명

        $target = G5_DATA_PATH . '/chat/' . $newName;

        if (move_uploaded_file($file['tmp_name'], $target)) {
            echo json_encode([
                'status' => 'ok',
                'filename' => $newName,
                'url' => '/data/chat/' . urlencode($newName)
            ]);
        } else {
            echo json_encode(['status' => 'fail', 'msg' => '파일 저장 실패']);
        }
    }
    //20250819 eun 페이지 이탈은 따로 정의
} else if ($_POST['act'] == 'leaveRoom') {
    ob_clean();
    header('Content-Type: application/json');

    $raw = $_POST['token'] ?? '';
    $response = ['success'=>false,'message'=>'','token'=>$raw];

    // 꼬리 보존해서 행위자 판별
    $tail = '';
    if (preg_match('/[12]$/', $raw)) {
        $tail = substr($raw, -1);
        $token = substr($raw, 0, -1);
        $response['token'] = $token;
    } else {
        $token = $raw;
    }

    if ($token) {
        $safe = sql_real_escape_string($token);
        // 행위자별 try_out 컬럼 세팅
        $col = ($tail === '2') ? "c_try_out='Y'" : "m_try_out='Y'";
        $sql = "
            UPDATE chat_room
               SET try_out='Y', {$col}
             WHERE room_token = '{$safe}'
        ";
        sql_query($sql);

        $response['success'] = true;
        $response['message'] = 'Room leaved successfully.';
    } else {
        $response['message'] = 'Invalid or missing token.';
    }

    echo json_encode($response); exit;


    //20250819 eun 페이지 이탈은 따로 정의
} else if ($_POST['act'] == 'rejoin') {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');

    $raw = $_POST['token'] ?? '';
    $tail = '';
    if (preg_match('/[12]$/', $raw)) {
        $tail = substr($raw, -1);
        $token = substr($raw, 0, -1);
    } else {
        $token = $raw;
    }

    if ($token) {
        $safe = sql_real_escape_string($token);
        // 해당 행위자의 try_out만 해제
        $colN = ($tail === '2') ? "c_try_out='N'" : "m_try_out='N'";

        sql_query("
          UPDATE chat_room
             SET rejoin = 'Y',
                 rejoin_cnt = rejoin_cnt + 1,
                 rejoin_last = NOW(),
                 {$colN}
           WHERE room_token = '{$safe}'
             AND try_out = 'Y'
        ");

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid or missing token.']);
    }
    exit;


} else if ($_POST['act'] == 'closeRoom') {
    ob_clean();
    header('Content-Type: application/json');

    $raw = $_POST['token'] ?? '';
    $response = ['success'=>false,'message'=>'','token'=>$raw];

    $tail = '';
    if (preg_match('/[12]$/', $raw)) {
        $tail = substr($raw, -1);
        $token = substr($raw, 0, -1);
        $response['token'] = $token;
    } else {
        $token = $raw;
    }

    if ($token) {
        $safe = sql_real_escape_string($token);
        $col = ($tail === '2') ? "c_try_out='Y'" : "m_try_out='Y'";
        $sql = "
            UPDATE chat_room
               SET try_out='Y',
                   {$col},
                   status='DISCONNECT',
                   chat_edate=NOW()
             WHERE room_token = '{$safe}'
        ";
        sql_query($sql);

        $response['success'] = true;
        $response['message'] = 'Room closed successfully.';
    } else {
        $response['message'] = 'Invalid or missing token.';
    }

    echo json_encode($response); exit;

} else if ($_POST['act'] == 'getStatus') {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');

    $token = $_POST['token'] ?? '';

    // 동기화(충전 반영)는 기존 로직 그대로 유지
    $sync = sync_room_point_increase($token);

    if (preg_match('/[12]$/', $token)) $token = substr($token, 0, -1);

    $room = sql_fetch("
        SELECT status, try_out, rejoin, use_time, alloc_sec_user,
               m_try_out, c_try_out
          FROM chat_room
         WHERE room_token = '".sql_real_escape_string($token)."'
    ");

    if (!$room) { echo json_encode(['success'=>false]); exit; }

    $remain = max(0, (int)$room['alloc_sec_user'] - (int)$room['use_time']);
    echo json_encode([
        'success'    => true,
        'status'     => $room['status'],
        'try_out'    => $room['try_out'],
        'rejoin'     => $room['rejoin'],
        'use_time'   => (int)$room['use_time'],
        'remain'     => $remain,
        'added_sec'  => ($sync['ok']??false) ? ($sync['added_sec']??0) : 0,
        'm_try_out'  => $room['m_try_out'] ?? 'N',
        'c_try_out'  => $room['c_try_out'] ?? 'N',
    ]);
    exit;
}

