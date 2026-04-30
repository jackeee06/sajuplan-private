<?php
define('G5_IS_ADMIN', true);

$allowed_ips = array(
    '104.64.128.103',
    '115.93.39.5',
    '118.235.2.169',
    '223.39.85.92',
);
$remote_ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (! in_array($remote_ip, $allowed_ips, true)) {
    header('HTTP/1.1 403 Forbidden');
    exit('접근이 허용되지 않습니다.');
}

include_once ('../common.php');
include_once(G5_ADMIN_PATH.'/admin.lib.php');

if( isset($token) ){
    $token = @htmlspecialchars(strip_tags($token), ENT_QUOTES);
}

run_event('admin_common');