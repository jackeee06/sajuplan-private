<?php
if (!defined('_GNUBOARD_')) exit;

/**
 * 리스트 스크립트 (counselor 전용 정렬/필터 분리 버전)
 * - counselor: 회원(m) 조인 + 상태(state) 정렬/필터/후기수(aft) 지원
 * - 그 외(board: review/apply/charm/new 등): 심플 경로 (회원조인/상태정렬 제거)
 * - 공지/검색/페이징/마스킹 기존 동작 유지
 */


/* -------------------------------------------------
 * 0) DEBUG 유틸
 * ------------------------------------------------- */
define('DBG', isset($_SERVER['REMOTE_ADDR']) && $_SERVER['REMOTE_ADDR'] === '115.93.39.5');
function dbg($label, $val){
    if (!DBG) return;
    if (!is_string($val)) $val = print_r($val, true);
    //echo '<b>['.htmlspecialchars($label).']</b> '.htmlspecialchars($val)."<br>\n";
}

/* -------------------------------------------------
 * 1) 유틸/헬퍼
 * ------------------------------------------------- */
if (!function_exists('sql_escape_string')) {
    function sql_escape_string($s){ return addslashes($s); }
}
$like_wrap = function($v){
    $v = sql_escape_string($v);
    $v = str_replace(['%','_'], ['\\%','\\_'], $v);
    return "%{$v}%";
};

/* -------------------------------------------------
 * 2) 파라미터 수집 / 정규화
 * ------------------------------------------------- */
// GET
$state_raw = isset($_GET['state'])   ? trim($_GET['state'])   : ''; // 예: "IDLE" 또는 "IDLE,RDVC"
$s_wr_5    = isset($_GET['s_wr_5'])  ? trim($_GET['s_wr_5'])  : ''; // 예: "금전"
$s_wr_6    = isset($_GET['s_wr_6'])  ? trim($_GET['s_wr_6'])  : ''; // 예: "솔직담백"
$s_mb_10   = isset($_GET['s_mb_10']) ? trim($_GET['s_mb_10']) : ''; // "성별" placeholder면 무시
$s_desc    = isset($_GET['s_desc'])  ? trim($_GET['s_desc'])  : ''; // 정렬키: aft, wr_datetime, amt, damt...

// 그누 보드 기본
$sop = strtolower($sop);
if ($sop !== 'and' && $sop !== 'or') $sop = 'and';
$stx = trim($stx);
$is_search_bbs = (bool)($sca || $stx || $stx === '0');

if ($s_mb_10 === '성별') $s_mb_10 = '';

$is_counselor = ($bo_table === 'counselor');
$is_admin_allview = (!empty($member['mb_level']) && $member['mb_level'] == 10);

// state 파싱
$allowed_states = ['IDLE','RDVC','CONN','ABSE'];
$state_list = [];
if ($state_raw !== '') {
    foreach (explode(',', $state_raw) as $sv) {
        $sv = strtoupper(trim($sv));
        if (in_array($sv, $allowed_states, true)) $state_list[] = $sv;
    }
    // IDLE 선택 시 RDVC 자동 포함(= 상담가능 묶음)
    if (in_array('IDLE', $state_list, true) && !in_array('RDVC', $state_list, true)) {
        $state_list[] = 'RDVC';
    }
    $state_list = array_values(array_unique($state_list));
}

dbg('bo_table', $bo_table);
dbg('state_raw', $state_raw);
dbg('state_list', $state_list);
dbg('inputs', compact('sca','s_wr_5','s_wr_6','s_mb_10','s_desc','stx','sfl','sop'));

/* -------------------------------------------------
 * 3) 검색 SQL (alias 버전/심플 버전)
 *    - get_sql_search($sca, $sfl, $stx, $sop, $with_alias)
 * ------------------------------------------------- */
$sql_search_alias  = $is_search_bbs ? get_sql_search($sca, $sfl, $stx, $sop, true)  : '';
$sql_search_simple = $is_search_bbs ? get_sql_search($sca, $sfl, $stx, $sop, false) : '';

/* -------------------------------------------------
 * 4) 공통 WHERE(조각) – counselor 심화, 나머지 심플
 * ------------------------------------------------- */
if ($bo_table == 'counselor') {
    $base_where_alias = ["gwc.wr_is_comment = 0 AND NOT (m.use_phone = 'N' AND m.use_chat = 'N')"]; // counselor/alias 경로
    $base_where_simple = ["gwc.wr_is_comment = 0 AND NOT (m.use_phone = 'N' AND m.use_chat = 'N')"]; // 심플 경로
}
else {
    $base_where_alias = ["gwc.wr_is_comment = 0"]; // counselor/alias 경로
    $base_where_simple = ["gwc.wr_is_comment = 0"]; // 심플 경로
}
// 카테고리(선택 시에만 필터)
if (!empty($sca)) {
    $base_where_alias[]  = "gwc.ca_name = '".sql_escape_string($sca)."'";
    $base_where_simple[] = "gwc.ca_name = '".sql_escape_string($sca)."'";
}

// counselor 전용(회원상태/성별/부가 필터)
if ($is_counselor) {
    if (!empty($state_list)) {
        $in = "'".implode("','",$state_list)."'";
        $base_where_alias[] = "m.state IN ({$in})";
    }
    if ($s_mb_10 !== '') $base_where_alias[] = "m.mb_10 = '".sql_escape_string($s_mb_10)."'";
    if ($s_wr_5  !== '') $base_where_alias[] = "gwc.wr_5 LIKE '".$like_wrap($s_wr_5)."'";
    if ($s_wr_6  !== '') $base_where_alias[] = "gwc.wr_6 LIKE '".$like_wrap($s_wr_6)."'";
}

// 권한별 필터 (wish)
if ($bo_table === 'wish') {
    if (empty($member['mb_id'])) {
        alert('로그인 하셔야합니다!','/bbs/login.php');
    }

    // 관리자 판별: super/group/board 또는 레벨 10
    $is_admin_any =
        ($is_admin === 'super' || $is_admin === 'group' || $is_admin === 'board' || (int)$member['mb_level'] === 10);

    if ($is_admin_any) {
        // 관리자: 검색(stx) 완전 무시
        // - 검색 여부 플래그/검색문 초기화
        $stx = '';
        $sfl = '';
        $is_search_bbs = false;         // 이후 "검색 파트 제한" 구문도 비활성화
        $sql_search_alias  = '';
        $sql_search_simple = '';
        // 관리자이므로 추가 where 없음 (전체 글)
    } else {
        // 일반 사용자: 내 글만
        $my_own = "gwc.mb_id = '" . sql_escape_string($member['mb_id']) . "'";
        $base_where_alias[]  = $my_own;
        $base_where_simple[] = $my_own;
    }
}


// review: mymbid(내 리뷰 보기)가 켜진 경우에만 본인글 제한 — 관리자면 무시
if ($bo_table === 'review' && !empty($mymbid) && !$is_admin_allview) {
    $base_where_alias[]  = "gwc.mb_id = '".sql_escape_string($member['mb_id'])."'";
    $base_where_simple[] = "gwc.mb_id = '".sql_escape_string($member['mb_id'])."'";
}

// review: 특정 상담사(csrid) 필터는 '명시적' 필터이므로 관리자라도 허용(원하면 전체 보려면 파라미터 제거)
if ($bo_table === 'review' && !empty($csrid)) {
    $base_where_alias[]  = "gwc.wr_1 = '".sql_escape_string($csrid)."'";
    $base_where_simple[] = "gwc.wr_1 = '".sql_escape_string($csrid)."'";
}

// QA: 기본은 '내 글만', 단 관리자(레벨 10)는 전체 열람
if ($bo_table === 'qa') {
    if (empty($member['mb_id'])) {
        alert('로그인 하셔야합니다!','/bbs/login.php'); // 환경에 맞게 경로 조정
    }

    if (!$is_admin_allview) {
        // 상담사(레벨 5)는 wr_1=본인, 일반회원은 mb_id=본인
        $my_cond = ((string)$member['mb_level'] === '5')
            ? "gwc.wr_1 = '" . sql_escape_string($member['mb_id']) . "'"
            : "gwc.mb_id = '" . sql_escape_string($member['mb_id']) . "'";

        $base_where_alias[]  = $my_cond;
        $base_where_simple[] = $my_cond;
    }
}

// review 전용 옵션
if ($bo_table === 'review' && !empty($photo_view) && $photo_view === 'Y') {
    $base_where_alias[]  = "gwc.wr_file > 0";
    $base_where_simple[] = "gwc.wr_file > 0";
}
if ($bo_table === 'review' && !empty($re_counsel) && $re_counsel === 'Y') {
    $base_where_alias[]  = "gwc.wr_comment = '0'";
    $base_where_simple[] = "gwc.wr_comment = '0'";
}

// 검색 파트 제한
$min_spt = null;
if ($is_search_bbs) {
    $row = sql_fetch("SELECT MIN(wr_num) AS min_wr_num FROM {$write_table}");
    $min_spt = (int)$row['min_wr_num'];
    if (!$spt) $spt = $min_spt;
    $base_where_alias[]  = "(gwc.wr_num BETWEEN {$spt} AND ({$spt} + {$config['cf_search_part']}))";
    $base_where_simple[] = "(gwc.wr_num BETWEEN {$spt} AND ({$spt} + {$config['cf_search_part']}))";
}

// get_sql_search 결합
if (!empty($sql_search_alias))  $base_where_alias[]  = $sql_search_alias;
//if (!empty($sql_search_simple)) $base_where_simple[] = $sql_search_simple;
if (!empty($sql_search_simple)) {
    // mb_id(단어 경계)만 gwc.mb_id 로 치환
    $sql_search_simple = preg_replace('/\bmb_id\b/', 'gwc.mb_id', $sql_search_simple);
    $base_where_simple[] = $sql_search_simple;
}

// 최종 WHERE 문자열
$where_alias  = implode(' AND ', $base_where_alias);
$where_simple = implode(' AND ', $base_where_simple);

/* -------------------------------------------------
 * 5) 정렬 정의
 * ------------------------------------------------- */
$state_order = "CASE WHEN m.state IN ('IDLE','RDVC','CONN','ABSE') THEN 0 ELSE 1 END, FIELD(m.state,'IDLE','RDVC','CONN','ABSE','')";
switch ($s_desc) {
    case 'wr_datetime': $order_expr_c = "{$state_order}, gwc.wr_datetime DESC"; break;
    case 'aft':         $order_expr_c = "{$state_order}, rc.afcnt DESC";       break; // 후기수
    case 'fat':         $order_expr_c = "{$state_order}, rc.afcnt DESC";       break; // fat==aft
    case 'amt':         $order_expr_c = "{$state_order}, m.mb_4 ASC";          break;
    case 'damt':        $order_expr_c = "{$state_order}, m.mb_4 DESC";         break;
    default:            $order_expr_c = "{$state_order}, gwc.wr_num, gwc.wr_reply";
}
$order_expr_simple = ($bo_table === 'review')
    ? "gwc.wr_datetime DESC"
    : "gwc.wr_num, gwc.wr_reply";

/* -------------------------------------------------
 * 6) COUNT
 * ------------------------------------------------- */
$review_count_sql = "SELECT wr_1, COUNT(*) AS afcnt FROM g5_write_review GROUP BY wr_1";

if ($is_counselor) {
    $sql_cnt = "
      SELECT COUNT(*) AS cnt
      FROM (
        SELECT DISTINCT gwc.wr_parent
        FROM {$write_table} AS gwc
        LEFT JOIN g5_member AS m ON m.mb_id = gwc.mb_id
        LEFT JOIN ({$review_count_sql}) AS rc ON rc.wr_1 = gwc.mb_id
        WHERE {$where_alias}
      ) AS x
    ";
} else {
    $sql_cnt = "
      SELECT COUNT(DISTINCT gwc.wr_parent) AS cnt
      FROM {$write_table} gwc
      WHERE {$where_simple}
    ";
}
dbg('COUNT_SQL', $sql_cnt);
$row = sql_fetch($sql_cnt);
$total_count = (int)$row['cnt'];

/* -------------------------------------------------
 * 7) 페이징
 * ------------------------------------------------- */
if(G5_IS_MOBILE) {
    $page_rows = $board['bo_mobile_page_rows'];
    $list_page_rows = $board['bo_mobile_page_rows'];
} else {
    $page_rows = $board['bo_page_rows'];
    $list_page_rows = $board['bo_page_rows'];
}
if ($page < 1) $page = 1;

$today2 = G5_TIME_YMD;
$list = [];
$i = 0;
$notice_count = 0;
$notice_array = [];

/* -------------------------------------------------
 * 8) 공지 처리
 * ------------------------------------------------- */
if (!$is_search_bbs) {
    $arr_notice = explode(',', trim($board['bo_notice']));
    $from_notice_idx = ($page - 1) * $page_rows;
    if ($from_notice_idx < 0) $from_notice_idx = 0;
    $board_notice_count = count($arr_notice);

    for ($k=0; $k<$board_notice_count; $k++) {
        if (trim($arr_notice[$k]) == '') continue;

        


        

        $row = sql_fetch("SELECT * FROM {$write_table} WHERE wr_id = '".sql_escape_string($arr_notice[$k])."'");
        if (empty($row['wr_id'])) continue;

        $notice_array[] = $row['wr_id'];

        if ($k < $from_notice_idx) continue;

        $list[$i] = get_list($row, $board, $board_skin_url, G5_IS_MOBILE ? $board['bo_mobile_subject_len'] : $board['bo_subject_len']);
        $list[$i]['is_notice'] = true;
        $list[$i]['num'] = 0;
        $i++;
        $notice_count++;

        


        

        if ($notice_count >= $list_page_rows) break;
    }
}

/* -------------------------------------------------
 * 9) 페이지 계산 및 공지 반영
 * ------------------------------------------------- */
$total_page  = (int)ceil($total_count / $page_rows);
$from_record = ($page - 1) * $page_rows;

if(!empty($notice_array)) {
    $from_record -= count($notice_array);
    if($from_record < 0) $from_record = 0;

    if($notice_count > 0) $page_rows -= $notice_count;
    if($page_rows < 0) $page_rows = $list_page_rows;
}

/* -------------------------------------------------
 * 10) LIST 쿼리
 * ------------------------------------------------- */
$notice_ex = '';
if (!empty($notice_array)) {
    $notice_in = implode(', ', array_map('intval',$notice_array));
    $notice_ex = " AND gwc.wr_id NOT IN ({$notice_in})";
}

if ($is_counselor) {
    // 외부 where(회원 상태) 보강용
    $outer_state_where = '';
    if (!empty($state_list)) {
        $outer_state_where = " AND m2.state IN ('".implode("','", $state_list)."')";
    }
    if ($bo_table == 'counselor'){
        $sql_list = "
      SELECT p.*, m2.*, rc2.afcnt
      FROM (
        SELECT gwc.wr_parent
        FROM {$write_table} AS gwc
        LEFT JOIN g5_member AS m ON m.mb_id = gwc.mb_id
        LEFT JOIN ({$review_count_sql}) AS rc ON rc.wr_1 = gwc.mb_id
        WHERE {$where_alias}
        GROUP BY gwc.wr_parent
        ORDER BY {$order_expr_c}
        LIMIT {$from_record}, {$page_rows}
      ) ids
      JOIN {$write_table} p    ON p.wr_id = ids.wr_parent
      LEFT JOIN g5_member m2   ON m2.mb_id = p.mb_id
      LEFT JOIN ({$review_count_sql}) rc2 ON rc2.wr_1 = p.mb_id
      WHERE 1=1 AND NOT (m2.use_phone = 'N' AND m2.use_chat = 'N') {$outer_state_where}
    ";
    
    } else
        $sql_list = "
      SELECT p.*, m2.*, rc2.afcnt
      FROM (
        SELECT gwc.wr_parent
        FROM {$write_table} AS gwc
        LEFT JOIN g5_member AS m ON m.mb_id = gwc.mb_id
        LEFT JOIN ({$review_count_sql}) AS rc ON rc.wr_1 = gwc.mb_id
        WHERE {$where_alias}
        GROUP BY gwc.wr_parent
        ORDER BY {$order_expr_c}
        LIMIT {$from_record}, {$page_rows}
      ) ids
      JOIN {$write_table} p    ON p.wr_id = ids.wr_parent
      LEFT JOIN g5_member m2   ON m2.mb_id = p.mb_id
      LEFT JOIN ({$review_count_sql}) rc2 ON rc2.wr_1 = p.mb_id
      WHERE 1=1 {$outer_state_where}
      
    ";
    




} else {

    $sql_list = "
      SELECT gwc.*
       FROM {$write_table} gwc
      LEFT JOIN 
       g5_member as m
      on 
       gwc.mb_id = m.mb_id
      WHERE {$where_simple}
      {$notice_ex}
      ORDER BY {$order_expr_simple}
      LIMIT {$from_record}, {$page_rows}
    ";
    
    // if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
    //     echo "===>".$sql_list;
    // }

}



dbg('LIST_SQL', $sql_list);

// if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
//     echo $sql_list;
//     exit;
//   }
/* -------------------------------------------------
 * 11) 결과 가공
 * ------------------------------------------------- */
$result = sql_query($sql_list);

$k = 0;
while ($row = sql_fetch_array($result)) {

    $list[$i] = get_list($row, $board, $board_skin_url, G5_IS_MOBILE ? $board['bo_mobile_subject_len'] : $board['bo_subject_len']);

    if (strstr($sfl, 'subject')) {
        $list[$i]['subject'] = search_font($stx, $list[$i]['subject']);
    }

    
        

    $list[$i]['is_notice'] = false;

    $list_num = $total_count - ($page - 1) * $list_page_rows - $notice_count;
    $list[$i]['num'] = $list_num - $k;

    // 신고/차단 마스킹
    if (!empty($member['mb_id'])) {
        $rsql = "
          SELECT * FROM g5_board_singo
           WHERE mb_id='".sql_escape_string($member['mb_id'])."'
             AND bo_table='".sql_escape_string($bo_table)."'
             AND wr_id='".intval($list[$i]['wr_id'])."'
        ";
        $rrt = sql_fetch($rsql);
        if(!empty($rrt['no']) && $rrt['mode'] == '2'){
            $list[$i]["subject"]    = "회원님이 차단하신 글입니다";
            $list[$i]["wr_subject"] = "회원님이 차단하신 글입니다";
            $list[$i]["wr_content"] = "회원님이 차단하신 글입니다";
            $list[$i]["href"]       = "";
            $list[$i]["sing_flag"]  = true;
        }
    }

    $i++; $k++;
}

/* -------------------------------------------------
 * 12) 캐시/페이징 링크 등 마무리
 * ------------------------------------------------- */
g5_latest_cache_data($board['bo_table'], $list);

$write_pages = get_paging(
    G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'],
    $page,
    $total_page,
    get_pretty_url($bo_table, '', $qstr.'&amp;page=')
);

$list_href = '';
$prev_part_href = '';
$next_part_href = '';

if ($is_search_bbs) {
    $list_href = get_pretty_url($bo_table);
    $patterns = ['#&amp;page=[0-9]*#', '#&amp;spt=[0-9\-]*#'];

    $prev_spt = $spt - $config['cf_search_part'];
    if (isset($min_spt) && $prev_spt >= $min_spt) {
        $qstr1 = preg_replace($patterns, '', $qstr);
        $prev_part_href = get_pretty_url($bo_table, 0, $qstr1.'&amp;spt='.$prev_spt.'&amp;page=1');
        $write_pages = page_insertbefore($write_pages, '<a href="'.$prev_part_href.'" class="pg_page pg_search pg_prev">이전검색</a>');
    }

    $next_spt = $spt + $config['cf_search_part'];
    if ($next_spt < 0) {
        $qstr1 = preg_replace($patterns, '', $qstr);
        $next_part_href = get_pretty_url($bo_table, 0, $qstr1.'&amp;spt='.$next_spt.'&amp;page=1');
        $write_pages = page_insertafter($write_pages, '<a href="'.$next_part_href.'" class="pg_page pg_search pg_next">다음검색</a>');
    }
}

$write_href = '';
if (!empty($member['mb_level']) && $member['mb_level'] >= $board['bo_write_level']) {
    $write_href = short_url_clean(G5_BBS_URL . '/write.php?bo_table=' . $bo_table);
}

$nobr_begin = $nobr_end = '';
if (!empty($_SERVER['HTTP_USER_AGENT']) && preg_match("/gecko|firefox/i", $_SERVER['HTTP_USER_AGENT'])) {
    $nobr_begin = '<nobr>';
    $nobr_end   = '</nobr>';
}

$rss_href = '';
if (!empty($board['bo_use_rss_view'])) {
    $rss_href = G5_BBS_URL.'/rss.php?bo_table='.$bo_table;
}

$stx = get_text(stripslashes($stx));

/* -------------------------------------------------
 * 13) 최종 스킨
 * ------------------------------------------------- */

// if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
//     echo $board_skin_path.'/list.skin.php';
//     exit;
// }
// 
// /home/thesaju7/www/theme/basic/mobile/skin/board/counselor/list.skin.php

// if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
//    echo $board_skin_path.'/list.skin.php';
// }
// echo "--------------------";
// echo $board_skin_path.'/list.skin.php';
// echo "--------------------";

include_once($board_skin_path.'/list.skin.php');
