<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

//if (G5_IS_MOBILE) {
//include_once(G5_THEME_MOBILE_PATH.'/head.php');
//return;
//}

//if(G5_COMMUNITY_USE === false) {
//define('G5_IS_COMMUNITY_PAGE', true);
//include_once(G5_THEME_SHOP_PATH.'/shop.head.php');
//return;
//}

include_once(G5_THEME_PATH . '/head.sub.php');
include_once(G5_LIB_PATH . '/latest.lib.php');
include_once(G5_LIB_PATH . '/outlogin.lib.php');
include_once(G5_LIB_PATH . '/poll.lib.php');
include_once(G5_LIB_PATH . '/visit.lib.php');
include_once(G5_LIB_PATH . '/connect.lib.php');
include_once(G5_LIB_PATH . '/popular.lib.php');

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
// echo 'tp : '.G5_THEME_PATH;
?>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
<link
        href="https://netdna.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css"
        rel="stylesheet"
/>
<style>

    #container_title.scrolled {
        background-color: #000 !important;
        transition: background-color 200ms linear;
    }


    .navbar {
        position: fixed !important;
        top: 0 !important;
        z-index: 999 !important;
        width: 100%;
    }

    .navbar ul {
        list-style-type: none;
        padding: 0;
    }

    .navbar ul li {
        display: inline-block;
        width: 100px;
        color: white;
    }

    #container_title {
        background: none !important;
    }


    .haed_menu .push,
    .search {
        display: none;
    }

    .haed_menu .home {
        display: block !important;
    }

</style>


<script>
    $(document).ready(function () {
        $(window).scroll(function () {
            var scroll = $(window).scrollTop();
            if (scroll > 1) {
                $(".navbar").css("background", "linear-gradient(to top, rgba(255,255,255,0), rgba(255,255,255,.6))"); // 스크롤 시
            } else {
                $(".navbar").css("background", "rgba(255,255,255,.0)"); // 기본
            }
        })
    })
</script>
<!--
--><?/*
$token = $_GET['token'] ?? '';

if (preg_match('/[12]$/', $token)) {
    $room_token = substr($token, 0, -1); // 마지막 문자 제거
}

//  토큰 fallback (정규식이 안 맞을 경우 대비)
if (empty($room_token)) {
    $room_token = $token;
}

$room_row = sql_fetch("SELECT * FROM chat_room where room_token = '{$room_token}'");
$mb_row = sql_fetch("SELECT * FROM g5_member WHERE mb_1 = '{$room_row['mb_id']}' LIMIT 1");
$csr_row = sql_fetch("SELECT * FROM g5_member WHERE mb_1 = {$room_row['csr_id']} LIMIT 1");

if ($member['mb_1'] == $room_row['csr_id']) { // 여기 로직이 상담사
    $op_row = sql_fetch("SELECT mb_point, mb_nick FROM g5_member WHERE mb_1 = '{$room_row['mb_id']}' ");

    $is_csr = 'Y';
    $op_name = $op_row['mb_nick'];
    $op_id = $room_row['mb_id'];

    //20250825 eun 상담사 시간 처리 작업 시작
    // ===== [추가 시작] : 방 단가/초기 배정 스냅샷 =====
    $room_token_safe = sql_real_escape_string($room_token);

    $room_snap = sql_fetch("SELECT unit_sec, unit_cost, alloc_sec_user, point_residue, snap_mb_point, use_time
                          FROM chat_room
                         WHERE room_token = '{$room_token_safe}'
                         LIMIT 1");

    if ((int)$room_snap['unit_sec'] <= 0 || (int)$room_snap['unit_cost'] <= 0 || (int)$room_snap['snap_mb_point'] <= 0) {
        $unit_sec  = (int)$csr_row['mb_12']; // 초/단위
        $unit_cost = (int)$csr_row['mb_13']; // 포인트/단위

        // 방의 '회원' 지갑 포인트로 초기 배정 (상담사/사용자 화면 구분 없이 동일)
        $user = sql_fetch("SELECT mb_point FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['mb_id'])."' LIMIT 1");
        $curr_pts = (int)$user['mb_point'];

        $alloc_units = intdiv(max(0, $curr_pts), max(1, $unit_cost));
        $alloc_sec   = $alloc_units * $unit_sec;
        $residue     = $curr_pts - ($alloc_units * $unit_cost);

        sql_query("
        UPDATE chat_room
           SET unit_sec = {$unit_sec},
               unit_cost = {$unit_cost},
               alloc_sec_user = GREATEST(alloc_sec_user, {$alloc_sec}),
               alloc_sec_csr  = GREATEST(alloc_sec_csr , {$alloc_sec}),
               point_residue  = {$residue},
               snap_mb_point  = {$curr_pts}
         WHERE room_token = '{$room_token_safe}'
         LIMIT 1
    ");

        // 새로 읽어 남은 시간 계산에 사용
        $room_snap = sql_fetch("SELECT alloc_sec_user, use_time FROM chat_room WHERE room_token = '{$room_token_safe}' LIMIT 1");
    }
// ===== [추가 끝] =====

    //20250825 eun 상담사 시간 처리 작업 마감

    // $sec = ((int)$csr_row["mb_5"]*(int)$op_row["mb_point"])/(int)$csr_row["mb_4"] - $room_row['use_time'];
   // $sec = ((int)$csr_row["mb_12"] * (int)$op_row["mb_point"]) / (int)$csr_row["mb_13"] - $room_row['use_time'];
    // 남은 시간(초) = 배정 - 사용
    $remain = 0;
    if (isset($room_snap['alloc_sec_user'])) {
        $remain = max(0, (int)$room_snap['alloc_sec_user'] - (int)$room_row['use_time']);
    }

    if ($remain > 0) {
        $sec = $remain;   // alloc 기반(권장)
    } else {
        // 하위호환(alloc 미사용 방일 때만)
        if ($member['mb_1'] == $room_row['csr_id']) { // 상담사 화면
            $op_row = sql_fetch("SELECT mb_point, mb_nick FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['mb_id'])."' ");
            $sec = ((int)$csr_row["mb_12"] * (int)$op_row["mb_point"]) / (int)$csr_row["mb_13"] - $room_row['use_time'];
        } else { // 사용자 화면
            $sec = ((int)$csr_row["mb_12"] * (int)$member["mb_point"]) / (int)$csr_row["mb_13"] - $room_row['use_time'];
        }
    }

} else {
    $is_csr = 'N';
    // $sec = ((int)$csr_row["mb_5"]*(int)$member["mb_point"])/(int)$csr_row["mb_4"] - $room_row['use_time'];
    $sec = ((int)$csr_row["mb_12"] * (int)$member["mb_point"]) / (int)$csr_row["mb_13"] - $room_row['use_time'];
    $op_name = $csr_row['mb_nick'];
    $op_id = $csr_row['mb_id'];
}
*/?>

<?php
// ... (include, header 등 기존 그대로)

// 토큰 파싱
/*$token = $_GET['token'] ?? '';
if (preg_match('/[12]$/', $token)) {
    $room_token = substr($token, 0, -1);
}*/
$token = $_GET['token'] ?? '';
$room_token = '';   // 실제 방 고유번호 (6자리)
$flag = null;       // 1: 상담사, 2: 회원

if (strlen($token) >= 6) {
    // 항상 앞 6자리가 room_token
    $room_token = substr($token, 0, 6);

    // 7번째 자리가 1 또는 2이면 flag로 인식
    $flag_char = substr($token, 6, 1);
    if ($flag_char === '1' || $flag_char === '2') {
        $flag = $flag_char;
    }
}

//  토큰 fallback (정규식이 안 맞을 경우 대비)
if (empty($room_token)) {
    $room_token = $token;
}

// 방/회원/상담사 조회
$room_row = sql_fetch("SELECT * FROM chat_room WHERE room_token = '".sql_real_escape_string($room_token)."'");
$mb_row   = sql_fetch("SELECT * FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['mb_id'])."' LIMIT 1");
$csr_row  = sql_fetch("SELECT * FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['csr_id'])."' LIMIT 1");

//  [공통] 스냅샷 & 초기 배정 — 분기(if 상담사/사용자) 위에서 한 번만
$room_token_safe = sql_real_escape_string($room_token);
$room_snap = sql_fetch("
    SELECT unit_sec, unit_cost, alloc_sec_user, point_residue, snap_mb_point, use_time
      FROM chat_room
     WHERE room_token = '{$room_token_safe}'
     LIMIT 1
");

if ((int)$room_snap['unit_sec'] <= 0 || (int)$room_snap['unit_cost'] <= 0 || (int)$room_snap['snap_mb_point'] <= 0) {
    $unit_sec  = (int)$csr_row['mb_12']; // 초/단위
    $unit_cost = (int)$csr_row['mb_13']; // 포인트/단위

    // 방의 "회원" 지갑 포인트로 초기 배정 (상담사/사용자 화면 동일)
    $user     = sql_fetch("SELECT mb_point FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['mb_id'])."' LIMIT 1");
    $curr_pts = (int)$user['mb_point'];

    $alloc_units = intdiv(max(0, $curr_pts), max(1, $unit_cost));
    $alloc_sec   = $alloc_units * $unit_sec;
    $residue     = $curr_pts - ($alloc_units * $unit_cost);

    sql_query("
        UPDATE chat_room
           SET unit_sec       = {$unit_sec},
               unit_cost      = {$unit_cost},
               alloc_sec_user = GREATEST(alloc_sec_user, {$alloc_sec}),
               alloc_sec_csr  = GREATEST(alloc_sec_csr , {$alloc_sec}),
               point_residue  = {$residue},
               snap_mb_point  = {$curr_pts}
         WHERE room_token     = '{$room_token_safe}'
         LIMIT 1
    ");

    // 재조회(남은 시간 계산용 최신값)
    $room_snap = sql_fetch("SELECT alloc_sec_user, use_time FROM chat_room WHERE room_token = '{$room_token_safe}' LIMIT 1");
}

// 공통 남은시간(alloc - use_time)
$remain = 0;
if (isset($room_snap['alloc_sec_user'])) {
    $remain = max(0, (int)$room_snap['alloc_sec_user'] - (int)$room_row['use_time']);
}

// --------------- 여기서부터 기존 상담사/사용자 분기 ---------------
if ($member['mb_1'] == $room_row['csr_id']) {
    // 상담사 화면
    $op_row  = sql_fetch("SELECT mb_point, mb_nick FROM g5_member WHERE mb_1 = '".sql_real_escape_string($room_row['mb_id'])."' ");
    $is_csr  = 'Y';
    $op_name = $op_row['mb_nick'];
    $op_id   = $room_row['mb_id'];

    // ️ alloc 우선, 없을 때만 구식 공식
    $sec = ($remain > 0)
        ? $remain
        : ((int)$csr_row["mb_12"] * (int)$op_row["mb_point"]) / (int)$csr_row["mb_13"] - (int)$room_row['use_time'];

} else {
    // 사용자 화면
    $is_csr  = 'N';
    $op_name = $csr_row['mb_nick'];
    $op_id   = $csr_row['mb_id'];

    //  alloc 우선, 없을 때만 구식 공식
    $sec = ($remain > 0)
        ? $remain
        : ((int)$csr_row["mb_12"] * (int)$member["mb_point"]) / (int)$csr_row["mb_13"] - (int)$room_row['use_time'];
}
?>

<header id="hd_roll" class="navbar">
    <!--<h1 id="hd_h1"><?php echo $g5['title'] ?></h1>-->

    <div class="to_content"><a href="#container">본문 바로가기</a></div>

    <?php
    if (defined('_INDEX_')) { // index에서만 실행
        include G5_MOBILE_PATH . '/newwin.inc.php'; // 팝업레이어
    } ?>

    <div id="hd_wrapper" style="padding: 18px 20px; border-bottom: 1px solid #f2f2f2; background-color:#fff;">
        <div style="display: flex; align-items: center;  justify-content: space-between;  gap: 10px;">
            <div style="display:flex; align-items:center; gap:5px;">
                <!--				<a href="javascript:history.back();">-->
                <a href="#" id="back_btn">
                    <img src="<?php echo G5_IMG_URL ?>/head/icon_back.png" style="width:24px;"/>
                    <span class="sound_only">뒤로가기</span>
                </a>
                <p style="font-size:18px; font-weight:700; margin-bottom: 0px;"><?php echo $op_name ?></p>
                <!-- 해당 채팅 대상 닉네임 -->
            </div>
            <div id="countdown" style="font-size: 16px; font-weight: 500; color: #E84263; white-space: nowrap;">
                00:00:00
            </div>
        </div>
        <?php if (defined('_SHOP_')) { ?>
        <?php } else { ?>
        <?php } ?>
        <?php ?>
    </div>
</header>
<!-- } 상단 끝 -->


<!-- <script>
    $(document).scroll(function () {
        var $nav = $("#container_title");
        $header.toggleClass('scrolled', $(this).scrollTop() > $header.height());
    });

</script> -->
<script>
    document.addEventListener('DOMContentLoaded', function () {
        // head_chat.php에 버튼이 있고, 모달은 counsel_chat.php에 있어야 동작합니다!
        const backBtn = document.getElementById('back_btn');
        if (!backBtn) return;
        backBtn.addEventListener('click', function (e) {
            e.preventDefault();
            // #chat-exit 모달을 찾아 show 클래스 추가
            var modal = document.getElementById('chat-exit');
            if (modal) {
                modal.classList.add('show');
                modal.style.display = 'block'; // 혹시 CSS에서 display:none 처리되어 있으면!
            } else {
                // 만약 해당 id가 없다면, 그냥 history.back();
                history.back();
            }
        });
    });
</script>

<hr>

<!-- 콘텐츠 시작 { -->
<div id="wrapper">
    <div id="container_wr">

        <div id="container">
            <!--<?php if (!defined("_INDEX_")) { ?><h2 id="container_title"><span title="<?php echo get_text($g5['title']); ?>"><?php echo get_head_title($g5['title']); ?></span></h2><?php } ?>-->