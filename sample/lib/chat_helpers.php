<?php

// chat_helpers.php : 공통 헬퍼(행위자 식별, 스냅샷, 이벤트 로깅)

if (!function_exists('snapshot_from_room')) {
    function snapshot_from_room(array $room): array
    {
        $alloc = isset($room['alloc_sec_user']) ? (int)$room['alloc_sec_user'] : 0;
        $used = isset($room['use_time']) ? (int)$room['use_time'] : 0;
        return [
            'status' => (string)($room['status'] ?? ''),
            'try_out' => (string)($room['try_out'] ?? ''),
            'm_try_out' => (string)($room['m_try_out'] ?? ''),
            'c_try_out' => (string)($room['c_try_out'] ?? ''),
            'alloc_sec_user' => $alloc,
            'use_time' => $used,
            'remain' => max(0, $alloc - $used),
        ];
    }
}

if (!function_exists('resolve_actor_and_authorize')) {
    // $session_mb_id = $_SESSION['ss_mb_id']
    function resolve_actor_and_authorize(array $room, ?string $session_mb_id)
    {
        if (!$session_mb_id) return [false, 'not-logged-in'];
        $is_memb = isset($room['mb_id']) && $room['mb_id'] === $session_mb_id;
        $is_csr = isset($room['csr_id']) && $room['csr_id'] === $session_mb_id;
        if (!$is_memb && !$is_csr) return [false, 'not-a-participant'];
        return [true, $is_csr ? 'CSR' : 'MEMB'];
    }
}

if (!function_exists('event_log')) {
    function event_log(string $room_token, string $actor_type, string $action,
                       string $reason_code, ?string $message = null,
                              $client_meta = null, $snapshot = null, ?string $server_note = null)
    {

        $rtok = sql_real_escape_string($room_token);
        $actr = sql_real_escape_string($actor_type);
        $act = sql_real_escape_string($action);
        $rsn = sql_real_escape_string($reason_code);
        $ms = sql_real_escape_string($message ?? '');

        // _meta는 문자열(JSON)로 올 수도 있고 배열일 수도 있음
        if (is_string($client_meta)) {
            $meta_json = $client_meta;
        } else {
            $meta_json = json_encode($client_meta ?? [], JSON_UNESCAPED_UNICODE);
        }
        $snap_json = json_encode($snapshot ?? [], JSON_UNESCAPED_UNICODE);

        $meta = sql_real_escape_string($meta_json);
        $snap = sql_real_escape_string($snap_json);
        $note = sql_real_escape_string($server_note ?? '');

        sql_query("
      INSERT INTO chat_room_event
      (room_token, actor_type, action, reason_code, message, client_meta, snapshot, server_note)
      VALUES ('{$rtok}', '{$actr}', '{$act}', '{$rsn}', '{$ms}', '{$meta}', '{$snap}', '{$note}')
    ");
    }
}
