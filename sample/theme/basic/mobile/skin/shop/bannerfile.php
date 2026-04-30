<?php
// 절대로 공백/HTML 출력 금지 (BOM 금지)

// 그누보드 공통 상수(G5_DATA_PATH 등)만 필요합니다.
// shop/ 아래에 두는 경우 루트의 common.php 경로가 ../common.php 입니다.
require_once dirname(__FILE__) . '/../common.php';

$bn_id = isset($_GET['bn_id']) ? preg_replace('/[^0-9]/', '', $_GET['bn_id']) : '';
if (!$bn_id) { http_response_code(404); exit; }

$path = G5_DATA_PATH . '/banner/' . $bn_id;
if (!is_file($path)) { http_response_code(404); exit; }

// MIME 판별
$mime = '';
if (function_exists('mime_content_type')) {
    $mime = mime_content_type($path);
}
if (!$mime && function_exists('finfo_open')) {
    $f = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($f, $path);
    finfo_close($f);
}

// WEBP 시그니처 보정 (확장자 없이 저장된 경우 대비)
if (!$mime || $mime === 'application/octet-stream') {
    $fh   = @fopen($path, 'rb');
    $head = $fh ? fread($fh, 12) : '';
    if ($fh) fclose($fh);
    if (strlen($head) >= 12 && substr($head,0,4)==="RIFF" && substr($head,8,4)==="WEBP") {
        $mime = 'image/webp';
    }
}

$allowed = [
    'image/gif','image/jpeg','image/png','image/bmp','image/webp',
    'video/mp4'
];
if (!in_array($mime, $allowed, true)) {
    http_response_code(415); // Unsupported Media Type
    exit;
}

// 캐시 헤더(파일이 작아 범위요청은 생략)
$mtime = filemtime($path);
header('Content-Type: '.$mime);
header('Content-Length: '.filesize($path));
header('Last-Modified: '.gmdate('D, d M Y H:i:s', $mtime).' GMT');
header('Cache-Control: public, max-age=31536000, immutable');

$fp = fopen($path, 'rb');
fpassthru($fp);
