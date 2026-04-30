<?php
// /coin/_pay_log.lib.php
if (!function_exists('sp_log_inbox')) {
    function sp_log_inbox($path, $method, $payload, $ip, $raw='') {
        // 그누보드가 있으면 G5_DATA_PATH 사용, 없으면 로컬 logs 폴더
        $base = defined('G5_DATA_PATH') ? G5_DATA_PATH.'/logs' : __DIR__.'/logs';
        if (!is_dir($base)) @mkdir($base, 0777, true);

        $file = $base.'/pay_inbox_'.date('Ymd').'.log';
        $line =
            '--- ['.date('Y-m-d H:i:s').'] '."$ip $method $path".PHP_EOL.
            'REQUEST='.json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL.
            ($raw !== '' ? 'RAW='.$raw.PHP_EOL : '').
            PHP_EOL;

        // 동시성 안전: PHP의 error_log append 사용
        @error_log($line, 3, $file);
    }
}
