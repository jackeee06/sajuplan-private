<?php
include_once('../common.php'); // DB연결 등
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
include_once($_SERVER["DOCUMENT_ROOT"].'/lib/latest.lib.php');

header('Content-Type: text/html; charset=utf-8');

$status = $_GET['status'] ?? 'best';
$html = '';

if ($itab == 'best') {
    // 3일간 상담시간 top15
    $sql = "SELECT a.mb_id, m.mb_nick, m.mb_4, m.mb_5, m.state, SUM(a.usetm) as total_time
              FROM platform_consulting a
             LEFT JOIN g5_member m ON a.csrid = m.mb_id
             WHERE a.reason = 'DISCONNECT' AND a.wr_datetime >= DATE_SUB(NOW(), INTERVAL 3 DAY)
             GROUP BY a.csrid
             ORDER BY total_time DESC
             LIMIT 15";
    $result = sql_query($sql);
    $html .= '<ul class="counselor_ul">';
    while ($row = sql_fetch_array($result)) {
        $profile_url = "/bbs/board.php?bo_table=counselor&wr_id=".get_wr_id($row['mb_id']);
        $thumb = get_counselor_thumb($row['mb_id']);
        $html .= '<li>
                    <a href="'.$profile_url.'">
                        <img src="'.$thumb.'" alt="프로필" />
                        <p>'.$row['mb_nick'].'</p>
                        <span>'.number_format($row['mb_4']).'원/'.$row['mb_5'].'초</span>
                        <span>최근 3일간 '.number_format($row['total_time']).'분</span>
                    </a>
                  </li>';
    }
    $html .= '</ul>';

} else if ($status == 'sco') {
    // 등록 30일 이내 상담사
    $sql = "SELECT m.mb_id, m.mb_nick, m.mb_4, m.mb_5, m.state, MIN(w.wr_datetime) as first_reg
            FROM g5_member m
            LEFT JOIN g5_write_counselor w ON m.mb_id = w.mb_id
            WHERE m.mb_level = '5'
              AND m.mb_leave_date = ''
              AND w.wr_is_comment = 0
              AND DATEDIFF(NOW(), MIN(w.wr_datetime)) <= 30
            GROUP BY m.mb_id
            ORDER BY first_reg DESC
            LIMIT 20";
    $result = sql_query($sql);
    $html .= '<ul class="counselor_ul">';
    while ($row = sql_fetch_array($result)) {
        $profile_url = "/bbs/board.php?bo_table=counselor&wr_id=".get_wr_id($row['mb_id']);
        $thumb = get_counselor_thumb($row['mb_id']);
        $html .= '<li>
                    <a href="'.$profile_url.'">
                        <img src="'.$thumb.'" alt="프로필" />
                        <p>'.$row['mb_nick'].'</p>
                        <span>'.number_format($row['mb_4']).'원/'.$row['mb_5'].'초</span>
                        <span>등록 '.(int)(30 - (strtotime('now') - strtotime($row['first_reg']))/86400).'일 남음</span>
                    </a>
                  </li>';
    }
    $html .= '</ul>';

} else if ($status == 'idle') {
    // 채팅 가능한 상담사
    $sql = "SELECT m.mb_id, m.mb_nick, m.mb_4, m.mb_5, m.state
              FROM g5_member m
             WHERE m.mb_level='5'
               AND m.mb_leave_date = ''
               AND m.state = 'IDLE'
               AND m.use_chat = 'Y'
             ORDER BY m.mb_nick ASC
             LIMIT 20";
    $result = sql_query($sql);
    $html .= '<ul class="counselor_ul">';
    while ($row = sql_fetch_array($result)) {
        $profile_url = "/bbs/board.php?bo_table=counselor&wr_id=".get_wr_id($row['mb_id']);
        $thumb = get_counselor_thumb($row['mb_id']);
        $html .= '<li>
                    <a href="'.$profile_url.'">
                        <img src="'.$thumb.'" alt="프로필" />
                        <p>'.$row['mb_nick'].'</p>
                        <span>'.number_format($row['mb_4']).'원/'.$row['mb_5'].'초</span>
                        <span>상태: '.$row['state'].'</span>
                    </a>
                  </li>';
    }
    $html .= '</ul>';

} else if ($status == 'all') {
    // 현재 상담 가능(대기중(IDLE) or 접속(CONN)) 상담사
    $sql = "SELECT m.mb_id, m.mb_nick, m.mb_4, m.mb_5, m.state
              FROM g5_member m
             WHERE m.mb_level='5'
               AND m.mb_leave_date = ''
               AND (m.state = 'IDLE' OR m.state = 'CONN')
             ORDER BY FIELD(m.state,'IDLE','CONN'), m.mb_nick ASC
             LIMIT 40";
    $result = sql_query($sql);
    $html .= '<ul class="counselor_ul">';
    while ($row = sql_fetch_array($result)) {
        $profile_url = "/bbs/board.php?bo_table=counselor&wr_id=".get_wr_id($row['mb_id']);
        $thumb = get_counselor_thumb($row['mb_id']);
        $html .= '<li>
                    <a href="'.$profile_url.'">
                        <img src="'.$thumb.'" alt="프로필" />
                        <p>'.$row['mb_nick'].'</p>
                        <span>'.number_format($row['mb_4']).'원/'.$row['mb_5'].'초</span>
                        <span>상태: '.$row['state'].'</span>
                    </a>
                  </li>';
    }
    $html .= '</ul>';

} else if ($status == 'review') {
    // 최근 후기 (상담 후기 테이블 가정: review_board)
    $sql = "SELECT r.wr_id, r.wr_subject, r.wr_content, r.mb_id, r.wr_datetime, c.mb_nick
              FROM g5_write_review r
              LEFT JOIN g5_member c ON r.mb_id = c.mb_id
              WHERE r.wr_is_comment = 0
              ORDER BY r.wr_datetime DESC
              LIMIT 15";
    $result = sql_query($sql);
    $html .= '<ul class="review_ul">';
    while ($row = sql_fetch_array($result)) {
        $html .= '<li>
                    <div class="review_head">
                        <span>'.$row['mb_nick'].'</span>
                        <span class="review_date">'.substr($row['wr_datetime'],0,10).'</span>
                    </div>
                    <div class="review_body">
                        <p class="review_title">'.htmlspecialchars($row['wr_subject']).'</p>
                        <p class="review_content">'.htmlspecialchars($row['wr_content']).'</p>
                    </div>
                  </li>';
    }
    $html .= '</ul>';
}

echo $html;


// ====== 헬퍼 함수 예시 (index.php에 넣거나 functions.inc.php에 넣어도 됨) ======
// wr_id 추출
function get_wr_id($mb_id) {
    $row = sql_fetch("SELECT wr_id FROM g5_write_counselor WHERE mb_id = '{$mb_id}' ORDER BY wr_num ASC LIMIT 1");
    return $row['wr_id'] ?? 0;
}

// 썸네일
function get_counselor_thumb($mb_id) {
    $wr_id = get_wr_id($mb_id);
    if ($wr_id) {
        $thumb = get_list_thumbnail('counselor', $wr_id, 60, 60, false, true);
        return $thumb['src'] ? $thumb['src'] : '/img/common/noimage.png';
    }
    return '/img/common/noimage.png';
}
