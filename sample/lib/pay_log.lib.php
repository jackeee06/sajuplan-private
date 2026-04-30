<?php
function _sp_json($v){ return is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); }

function sp_log_inbox($endpoint, $method, $payload, $remote_ip){
    $sql = "INSERT INTO saju_pay_inbox (endpoint, method, payload, remote_ip, created_at)
            VALUES ('".sql_escape_string($endpoint)."','".sql_escape_string($method)."',
                    '".sql_escape_string(_sp_json($payload))."','".sql_escape_string($remote_ip)."', NOW())";
    sql_query($sql);
    return sql_insert_id();
}

function sp_log_outbox($url, $method, $payload, $http_code, $response, $duration_ms){
    $sql = "INSERT INTO saju_pay_outbox (url, method, payload, http_code, response, duration_ms, created_at)
            VALUES ('".sql_escape_string($url)."','".sql_escape_string($method)."',
                    '".sql_escape_string(_sp_json($payload))."', ".(int)$http_code.",
                    '".sql_escape_string(_sp_json($response))."', ".(int)$duration_ms.", NOW())";
    sql_query($sql);
}
