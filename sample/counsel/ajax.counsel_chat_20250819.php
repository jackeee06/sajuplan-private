<?php
include_once('./_common.php');

if($_POST['act'] == 'updateTime') {

    $token = $_POST['token'] ?? '';

    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1); // 마지막 문자 제거
    }

    if ($token) {
        // 존재하는 방인지 확인 후 use_time + 10
        $sql = "
        UPDATE chat_room
        SET use_time = use_time + 10
        WHERE room_token = '{$token}'
    ";

        sql_fetch($sql);
    }
} else if ($_POST['act'] == 'storeChat') {

    $sql = "INSERT INTO chat_t (mb_id,token,msg,wdate) VALUES ('{$_POST['mbid']}','{$_POST['token']}','{$_POST['msg']}',NOW())";

    // echo $sql;
    sql_fetch($sql);
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
        $result = sql_fetch($sql); // 업데이트 실행 (성공 여부 확인 불가 시 dummy로 처리)

        $response['success'] = true;
        $response['message'] = 'Room leaved successfully.';
    } else {
        $response['message'] = 'Invalid or missing token.';
    }

    echo json_encode($response);
    exit;
    //20250819 eun 페이지 이탈은 따로 정의

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
            SET try_out = 'Y', status = 'DISCONNECT' 
            WHERE room_token = '{$token}'
        ";
        //20250817 , status = 'DISCONNECT' 추가
        $result = sql_fetch($sql); // 업데이트 실행 (성공 여부 확인 불가 시 dummy로 처리)

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

    $token = $_POST['token'] ?? '';
    // 토큰 꼬리(1/2) 제거
    if (preg_match('/[12]$/', $token)) {
        $token = substr($token, 0, -1);
    }
    if (!$token) {
        $response['message'] = 'Invalid or missing token.';
        exit;
    }

    $safe = sql_real_escape_string($token);
    $row = sql_fetch("SELECT status, try_out, chat_wdate, chat_edate FROM chat_room WHERE room_token = '{$safe}'");

    if ($row) {
        echo json_encode([
            'success' => true,
            'status' => $row['status'],
            'try_out' => $row['try_out'],
            'chat_wdate' => $row['chat_wdate'],
            'chat_edate' => $row['chat_edate']
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'room not found']);
    }
    exit;

}


?>