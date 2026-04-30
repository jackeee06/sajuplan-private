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

    $sql = "INSERT INTO chat_t (mb_id,token,msg,wdate) VALUES ('{$_POST['mbid']}','{$_POST['token']}','{$_POST['msg']}',NOW())";

    // echo $sql;
    sql_query($sql);
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
    ob_clean(); // 버퍼 내용 지우기
    header('Content-Type: application/json'); // JSON 응답 명시
    $token = $_POST['token'] ?? '';
    $response = [
        'success' => false,
        'message' => '',
        'token' => $token
    ];

    // 토큰 끝에 1 또는 2가 붙어있다면 제거a
    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1);
        $response['token'] = $token;
    }

    if ($token) {
        // 실제 UPDATE 쿼리 실행
        $sql = "
            UPDATE chat_room
            SET try_out = 'Y'
            WHERE room_token = '{$token}'
        ";
        //20250817 , status = 'DISCONNECT' 추가
        $result = sql_query($sql); // 업데이트 실행 (성공 여부 확인 불가 시 dummy로 처리)

        $response['success'] = true;
        $response['message'] = 'Room leaved successfully.';
    } else {
        $response['message'] = 'Invalid or missing token.';
    }

    echo json_encode($response);
    exit;
    //20250819 eun 페이지 이탈은 따로 정의
} else if ($_POST['act'] == 'rejoin') {
    ob_clean();
    header('Content-Type: application/json; charset=utf-8');

    $token = $_POST['token'] ?? '';

    // 토큰 끝에 1 또는 2가 붙어있다면 제거
    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1);
    }

    if ($token) {
        $safe = sql_real_escape_string($token);

        // 이전에 잠깐 이탈(try_out='Y')이었던 경우에만 rejoin='Y'로 표기
        // (첫 입장은 try_out='N'이므로 rejoin이 Y로 바뀌지 않음)
        $sql = "
          UPDATE chat_room
             SET rejoin = 'Y', rejoin_cnt = rejoin_cnt + 1,
                    rejoin_last = NOW() 
           WHERE room_token = '{$safe}'
             AND try_out = 'Y'
        ";
        sql_query($sql);

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid or missing token.']);
    }
    exit;

} else if ($_POST['act'] == 'closeRoom') {

    ob_clean(); // 버퍼 내용 지우기
    header('Content-Type: application/json'); // JSON 응답 명시
    $token = $_POST['token'] ?? '';
    $response = [
        'success' => false,
        'message' => '',
        'token' => $token
    ];

    // 토큰 끝에 1 또는 2가 붙어있다면 제거a
    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1);
        $response['token'] = $token;
    }

    if ($token) {
        // 실제 UPDATE 쿼리 실행
        $sql = "
            UPDATE chat_room
            SET try_out = 'Y', status = 'DISCONNECT', chat_edate = NOW()
            WHERE room_token = '{$token}'
        ";
        //20250817 , status = 'DISCONNECT' 추가
        $result = sql_query($sql); // 업데이트 실행 (성공 여부 확인 불가 시 dummy로 처리)

        $response['success'] = true;
        $response['message'] = 'Room closed successfully.';
    } else {
        $response['message'] = 'Invalid or missing token.';
    }

    echo json_encode($response);
    exit;
} else if ($_POST['act'] == 'getStatus') {
    ob_clean(); // 버퍼 내용 지우기
    header('Content-Type: application/json; charset=utf-8');

   /* $token = $_POST['token'] ?? '';
    // 토큰 꼬리(1/2) 제거
    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1);
    }
    if (!$token) {
        $response['message'] = 'Invalid or missing token.';
        exit;
    }

    $safe = sql_real_escape_string($token);
    // $row = sql_fetch("SELECT status, try_out, chat_wdate, chat_edate FROM chat_room WHERE room_token = '{$safe}'");
    $row = sql_fetch("SELECT status, rejoin, try_out, use_time, chat_wdate, chat_edate FROM chat_room WHERE room_token = '{$safe}'");

    if ($row) {
        echo json_encode([
            'success' => true,
            'status' => $row['status'],
            'try_out' => $row['try_out'],
            'rejoin'     => $row['rejoin'], //20250822 eun 재입장 관련 추가
            'use_time'    => (int)$row['use_time'],   // 20250822 eun 입장 관련 추가
            'chat_wdate' => $row['chat_wdate'],
            'chat_edate' => $row['chat_edate']
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'room not found']);
    }
    exit;*/

    $token = $_POST['token'] ?? '';

    // 1) 폴링 시마다 증가분 동기화(결제 발생시 즉시 반영)
    $sync = sync_room_point_increase($token);

    if (preg_match('/[12]$/', $token)) $token = substr($token, 0, -1);

    $room = sql_fetch("SELECT status, try_out, rejoin, use_time, alloc_sec_user
                         FROM chat_room
                        WHERE room_token = '".sql_real_escape_string($token)."'");

    if (!$room) { echo json_encode(['success'=>false]); exit; }

    $remain = max(0, (int)$room['alloc_sec_user'] - (int)$room['use_time']);
    echo json_encode([
        'success'  => true,
        'status'   => $room['status'],
        'try_out'  => $room['try_out'],
        'rejoin'   => $room['rejoin'],
        'use_time' => (int)$room['use_time'],
        'remain'   => $remain,
        'added_sec'=> ($sync['ok']??false) ? ($sync['added_sec']??0) : 0
    ]);
    exit;

}

