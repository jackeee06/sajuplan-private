<?php
/**
 * [일회용] counselor 게시판 원글 전체 → JSON (상담사 수가 많아도 한 번에 내보내기)
 *
 * - FTP로는 DB 내용이 안 내려옵니다. 이 스크립트는 DB에서 원글만 읽어 JSON 한 덩어리로 만듭니다.
 * - 메모리 절약: 글을 배열에 쌓지 않고 한 건씩 파일/브라우저로 씁니다.
 *
 * 사용 순서:
 * 1. 아래 EXPORT_SECRET 을 긴 임의 문자열로 변경
 * 2. 사이트 루트(common.php 와 같은 폴더)에 FTP 업로드
 * 3-A) 한 파일로 PC 저장(권장, 상담사 매우 많을 때):
 *    https://도메인/export_counselor_intros_once_DELETE_ME.php?key=비밀값&save_file=1
 *    → data/ 아래 counselor_export_날짜.json 생성 → FTP로 그 파일만 다운로드
 * 3-B) 브라우저에서 바로 다운로드(용량·시간 제한에 따라 실패할 수 있음):
 *    https://도메인/export_counselor_intros_once_DELETE_ME.php?key=비밀값
 * 4. 서버에서 이 PHP 파일 반드시 삭제
 */
if (PHP_VERSION_ID < 50600) {
    exit('PHP 5.6+ required for hash_equals');
}

// ▼▼▼ IT 몰라도 됨: 아래 따옴표 안은 그대로 두세요. (원하면 본인만 아는 영문+숫자로 바꿔도 됩니다. 바꾸면 주소의 key= 도 똑같이.)
const EXPORT_SECRET = 'SajuExportOneTime9284';

if (!isset($_GET['key'])) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: text/plain; charset=utf-8');
    exit("Forbidden\n\n주소가 짧습니다. PHP 파일을 메모장으로 열어 'EXPORT_SECRET' 옆 따옴표 안 비밀번호를 확인한 뒤,\n주소 끝에 이렇게 붙이세요 (한 번만 접속).\n\n?key=그비밀번호&save_file=1");
}
if (!hash_equals(EXPORT_SECRET, (string) $_GET['key'])) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: text/plain; charset=utf-8');
    exit('Forbidden — key 값이 파일 안의 비밀번호와 다릅니다. FTP로 올린 파일과 주소의 key= 가 같은지 확인하세요.');
}

include_once __DIR__ . '/_common.php';

@set_time_limit(0);
@ini_set('memory_limit', '512M');

$bo_table = 'counselor';
$write_table = $g5['write_prefix'] . $bo_table;

$sql_count = "SELECT COUNT(*) AS cnt FROM `{$write_table}` WHERE wr_is_comment = 0";
$cnt_row = sql_fetch($sql_count, false);
if ($cnt_row === false || $cnt_row === null) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('Count query failed. Table may not exist: ' . $write_table);
}
$total = (int) $cnt_row['cnt'];

$sql = "SELECT wr_id, wr_parent, wr_reply, wr_comment, wr_comment_reply, wr_is_comment,
               wr_subject, wr_content, wr_datetime, wr_last, mb_id, wr_name,
               wr_1, wr_2, wr_3, wr_4, wr_5, wr_6, wr_7, wr_8, wr_9, wr_10
        FROM `{$write_table}`
        WHERE wr_is_comment = 0
        ORDER BY wr_id ASC";

$result = sql_query($sql, false);
if ($result === false) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('Query failed. Table: ' . $write_table);
}

$json_flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
    $json_flags |= JSON_INVALID_UTF8_SUBSTITUTE;
}

$meta = [
    'exported_at' => date('c'),
    'table'       => $write_table,
    'count'       => $total,
];
$meta_json = json_encode($meta, $json_flags);
if ($meta_json === false) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('meta json_encode failed');
}
$prefix = substr($meta_json, 0, -1) . ',"posts":[';
$suffix = ']}';

$save_file = isset($_GET['save_file']) && $_GET['save_file'] === '1';
if ($save_file) {
    $name = 'counselor_export_' . date('Ymd_His') . '.json';
    $path = G5_DATA_PATH . '/' . $name;
    $fp = @fopen($path, 'wb');
    if ($fp === false) {
        header('HTTP/1.1 500 Internal Server Error');
        exit('Cannot write: ' . $path);
    }
} else {
    $name = 'counselor_posts_' . date('Ymd_His') . '.json';
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    $fp = fopen('php://output', 'wb');
    if ($fp === false) {
        header('HTTP/1.1 500 Internal Server Error');
        exit('Cannot open output stream');
    }
}

if (fwrite($fp, $prefix) === false) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('Write failed (prefix)');
}

$first_row = true;
while ($row = sql_fetch_array($result)) {
    $chunk = json_encode($row, $json_flags);
    if ($chunk === false) {
        fclose($fp);
        if ($save_file && is_file($path)) {
            @unlink($path);
        }
        header('HTTP/1.1 500 Internal Server Error');
        exit('json_encode failed for wr_id ' . (isset($row['wr_id']) ? $row['wr_id'] : '?'));
    }
    if (!$first_row) {
        if (fwrite($fp, ',') === false) {
            header('HTTP/1.1 500 Internal Server Error');
            exit('Write failed (comma)');
        }
    }
    $first_row = false;
    if (fwrite($fp, $chunk) === false) {
        header('HTTP/1.1 500 Internal Server Error');
        exit('Write failed (row)');
    }
}

if (fwrite($fp, $suffix) === false) {
    header('HTTP/1.1 500 Internal Server Error');
    exit('Write failed (suffix)');
}
fclose($fp);

if ($save_file) {
    header('Content-Type: text/plain; charset=utf-8');
    echo "OK — exported {$total} posts.\n";
    echo "FTP로 내려받을 경로:\n" . G5_DATA_DIR . '/' . $name . "\n";
    echo "Full path on server:\n" . $path . "\n";
}
