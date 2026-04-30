<?php
// !! 절대로 이 줄 위에 공백/개행/BOM 이 있으면 안 됩니다 !!

require_once dirname(__FILE__) . '/../common.php';

// 모든 버퍼/압축 비활성화 (헤더 먼저 보내기 위함)
if (function_exists('ob_get_level')) { while (ob_get_level()) { ob_end_clean(); } }
if (function_exists('ini_set')) { @ini_set('zlib.output_compression', 'Off'); }

$bn_id = isset($_GET['bn_id']) ? preg_replace('/\D/','', $_GET['bn_id']) : '';
if ($bn_id === '') { http_response_code(404); exit; }

$path = G5_DATA_PATH . '/banner/' . $bn_id;
if (!is_file($path) || !is_readable($path)) { http_response_code(404); exit; }

// MIME 판별
$mime = '';
if (function_exists('mime_content_type')) $mime = mime_content_type($path);
if (!$mime && function_exists('finfo_open')) {
    $f = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($f, $path);
    finfo_close($f);
}
// 시그니처 기반 보정 (확장자 없이 저장되는 환경 대비)
if (!$mime || $mime === 'application/octet-stream') {
    $fh = @fopen($path, 'rb');
    $head = $fh ? fread($fh, 12) : '';
    if ($fh) fclose($fh);
    if (strlen($head) >= 12 && substr($head,0,4)==='RIFF' && substr($head,8,4)==='WEBP') $mime = 'image/webp';
    elseif (substr($head,0,3)==="\xFF\xD8\xFF") $mime = 'image/jpeg';
    elseif (substr($head,0,8)==="\x89PNG\x0D\x0A\x1A\x0A") $mime = 'image/png';
    elseif (substr($head,0,6)==="GIF87a" || substr($head,0,6)==="GIF89a") $mime = 'image/gif';
    elseif (substr($head,4,4)==='ftyp') $mime = 'video/mp4';
}

$allowed = ['image/gif','image/jpeg','image/png','image/bmp','image/webp','video/mp4'];
if (!in_array($mime, $allowed, true)) { http_response_code(415); exit; }

$mtime = filemtime($path);
$size  = filesize($path);
$etag  = '"'.md5($mtime.$size.$bn_id).'"';

// 조건부 GET 처리
if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    header('ETag: '.$etag);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Last-Modified: '.gmdate('D, d M Y H:i:s', $mtime).' GMT');
    http_response_code(304); exit;
}
if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) >= $mtime) {
    header('ETag: '.$etag);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Last-Modified: '.gmdate('D, d M Y H:i:s', $mtime).' GMT');
    http_response_code(304); exit;
}

// 최종 헤더
header('Content-Type: '.$mime);
header('Content-Length: '.$size);
header('ETag: '.$etag);
header('Last-Modified: '.gmdate('D, d M Y H:i:s', $mtime).' GMT');
header('Cache-Control: public, max-age=31536000, immutable');

// 바이트 전송
$fp = fopen($path, 'rb');
fpassthru($fp);
fclose($fp);
exit;
