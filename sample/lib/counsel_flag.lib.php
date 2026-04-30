<?php
// lib/counsel_flag.lib.php
if (!defined('_GNUBOARD_')) exit;

/**
 * 단일 스위치 (이 값 하나로 전역 제어)
 * 'Y' = 노출, 'N' = 비노출
 * // eun 만약 심리 카테고리를 다시 노출할 경우 : 주석 해제해서 사용하기
 */
$chk_f = 'N';
//$chk_f = 'Y';

// 한 요청에서 한 번만 고정되도록 상수로 바인딩
if (!defined('CS_PSYCH_FLAG')) {
    define('CS_PSYCH_FLAG', (strtoupper($chk_f) === 'Y') ? 'Y' : 'N');
}

/** 노출 여부 반환 */
function cs_show_simli(): bool {
    return CS_PSYCH_FLAG === 'Y';
}

/** 숨길 카테고리 목록 */
function cs_hidden_cats(): array {
    return cs_show_simli() ? [] : ['심리'];
}

/** 전달된 카테고리가 숨김 대상인지 여부 */
function cs_is_hidden_cat($name): bool {
    return in_array((string)$name, cs_hidden_cats(), true);
}
