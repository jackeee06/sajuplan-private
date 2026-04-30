<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "실시간 코인 정산";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');

#####################################################################
if(!$member["mb_id"]){
	alert('로그인 하셔야합니다', '/bbs/login.php');
	exit;
}

// 월 검색 (기본: 이번달)
$sel_month = (isset($_GET['month']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])$/", $_GET['month'])) ? $_GET['month'] : date("Y-m");

// 구분 필터
$md_raw = isset($_REQUEST["md"]) ? $_REQUEST["md"] : '';
$md = in_array($md_raw, ['Y','N'], true) ? $md_raw : '';

// 페이지네이션
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;

// 날짜 범위
$startday = $sel_month . "-01 00:00:00";
$endday   = date("Y-m-d", strtotime($sel_month . "-01 +1 month")) . "-01 00:00:00";

// 로열티 비율
$royalty_free = (int)$member['mb_19'];
$royalty_pro  = (int)$member['mb_20'];

$mb_id_esc = sql_real_escape_string($member['mb_id']);

// 정산 완료 여부 확인
$settlement = sql_fetch("
    SELECT * FROM g5_point_end
    WHERE mb_id='{$mb_id_esc}' AND month='{$sel_month}'
");
$is_settled = !empty($settlement['no']);

// === 요약 데이터 ===
if ($is_settled) {
    $sum_price_free      = (int)$settlement['price_free'];
    $sum_price_paid      = (int)$settlement['price_paid'];
    $sum_price_other     = (int)$settlement['price_other'];
    $sum_price_tot       = (int)$settlement['price_tot'];
    $sum_supply_price    = (int)floor($sum_price_tot / 1.1);
    $sum_vat_amount      = (int)$settlement['vat_amount'];
    $sum_withholding_tax = (int)$settlement['withholding_tax'];
    $sum_reply_fee       = (int)$settlement['reply_fee'];
    $sum_price           = (int)$settlement['price'];
} else {
    $con_sum = sql_fetch("
        SELECT
            IFNULL(SUM(amt_free), 0) as amt_free,
            IFNULL(SUM(amt_pro), 0) as amt_pro
        FROM platform_consulting
        WHERE mb_id='{$mb_id_esc}'
          AND reason IN ('DISCONNECT','END_CHAT')
          AND wr_datetime >= '{$startday}'
          AND wr_datetime < '{$endday}'
    ");
    $amt_free_sum = (int)$con_sum['amt_free'];
    $amt_pro_sum  = (int)$con_sum['amt_pro'];
    $sum_price_free      = (int)floor($amt_free_sum * $royalty_free / 100);
    $sum_price_paid      = (int)floor($amt_pro_sum * $royalty_pro / 100);
    $other_sum = sql_fetch("
        SELECT 
            IFNULL(SUM(CASE WHEN po_point > 0 THEN po_point ELSE 0 END), 0) as amt_plus,
            IFNULL(SUM(CASE WHEN po_point < 0 THEN po_point ELSE 0 END), 0) as amt_minus
        FROM g5_point
        WHERE mb_id='{$mb_id_esc}'
          AND po_datetime >= '{$startday}' AND po_datetime < '{$endday}'
          AND po_rel_table NOT IN ('@member', '@platform_consulting')
    ");
    $sum_price_other     = (int)floor((int)$other_sum['amt_plus'] * $royalty_pro / 100) + (int)$other_sum['amt_minus'];
    $sum_price_tot       = $sum_price_free + $sum_price_paid + $sum_price_other;
    $sum_supply_price    = (int)floor($sum_price_tot / 1.1);
    $sum_vat_amount      = $sum_price_tot - $sum_supply_price;
    $sum_withholding_tax = (int)floor($sum_supply_price * 0.033);
    $sum_reply_fee       = 20000; // 실시간: 우선차감
    $sum_price           = $sum_supply_price - $sum_withholding_tax - $sum_reply_fee;
}

$sum_deduction_total = $sum_vat_amount + $sum_withholding_tax + $sum_reply_fee;

// 구분 필터 SQL
$md_sql = "";
if ($md === 'Y') {
    $md_sql = " AND tc.reason = 'DISCONNECT' AND (tc.preflag = '' OR tc.preflag IS NULL) ";
} elseif ($md === 'N') {
    $md_sql = " AND (tc.preflag = 'Y' OR tc.reason = 'END_CHAT') ";
}

// 건수
$row_cnt = sql_fetch("
    SELECT COUNT(*) AS cnt
    FROM platform_consulting tc
    WHERE tc.mb_id='{$mb_id_esc}'
      AND tc.reason IN ('DISCONNECT','END_CHAT')
      AND tc.wr_datetime >= '{$startday}'
      AND tc.wr_datetime < '{$endday}'
      {$md_sql}
");
$total_count = (int)$row_cnt['cnt'];

// 필터 합계
$row_fsum = sql_fetch("
    SELECT
        IFNULL(SUM(tc.amt_free), 0) as sum_free,
        IFNULL(SUM(tc.amt_pro), 0) as sum_pro
    FROM platform_consulting tc
    WHERE tc.mb_id='{$mb_id_esc}'
      AND tc.reason IN ('DISCONNECT','END_CHAT')
      AND tc.wr_datetime >= '{$startday}'
      AND tc.wr_datetime < '{$endday}'
      {$md_sql}
");
$filtered_total = (int)floor((int)$row_fsum['sum_free'] * $royalty_free / 100)
                + (int)floor((int)$row_fsum['sum_pro'] * $royalty_pro / 100);

// 페이징
$rows = 15;
$total_page = max(1, (int)ceil($total_count / $rows));
if ($page > $total_page) $page = $total_page;
$from_record = ($page - 1) * $rows;

// 상담 내역
$result = sql_query("
    SELECT tc.*, tc.`from` AS tc_from
    FROM platform_consulting tc
    WHERE tc.mb_id='{$mb_id_esc}'
      AND tc.reason IN ('DISCONNECT','END_CHAT')
      AND tc.wr_datetime >= '{$startday}'
      AND tc.wr_datetime < '{$endday}'
      {$md_sql}
    ORDER BY tc.wr_datetime DESC
    LIMIT {$from_record}, {$rows}
");

// 페이징용 qstr
$qparams = ['month' => $sel_month];
if ($md !== '') { $qparams['md'] = $md; }
$qstr = http_build_query($qparams);

// 월 표시
$display_year  = substr($sel_month, 0, 4);
$display_month = ltrim(substr($sel_month, 5, 2), '0');
$prev_month = date("Y-m", strtotime($sel_month . "-01 -1 month"));
$next_month = date("Y-m", strtotime($sel_month . "-01 +1 month"));
$is_future  = ($next_month > date("Y-m"));
?>

<?php
include_once(G5_PATH.'/include/counselor_settlement_navi.php');
?>

<style>
#main_bn { width:100%; float:left;margin-top:15px;}
#main_bn img { border-radius:10px;}

.top_nav_03 {
    border-color: #8259f5 !important;
    color: #8259f5;
    font-weight: 600;
}

/* 요약 카드 */
.rt_summary {
    padding: 20px 16px;
    background: #fff;
    border-bottom: 10px solid #f5f5f5;
}
.rt_summary_title {
    font-size: 16px;
    font-weight: 700;
    color: #222;
    margin-bottom: 14px;
}
.rt_card_row {
    display: flex;
    gap: 10px;
}
.rt_card {
    flex: 1;
    padding: 14px 12px;
    border-radius: 10px;
    text-align: center;
}
.rt_card.card_current {
    background: #f3efff;
    border: 1px solid #e0d8f5;
}
.rt_card.card_total {
    background: #8259f5;
    border: 1px solid #8259f5;
}
.rt_card .rc_label {
    font-size: 11px;
    color: #888;
    margin-bottom: 6px;
    font-weight: 500;
}
.rt_card.card_total .rc_label {
    color: rgba(255,255,255,0.8);
}
.rt_card .rc_value {
    font-size: 17px;
    font-weight: 700;
    color: #333;
}
.rt_card.card_current .rc_value {
    color: #8259f5;
}
.rt_card.card_total .rc_value {
    color: #fff;
}

/* 검색 영역 */
.rt_search_wrap {
    padding: 14px 16px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    gap: 6px;
}
.rt_search_wrap input[type="date"] {
    flex: 1;
    padding: 9px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
}
.rt_search_wrap .rt_wave {
    font-size: 13px;
    color: #999;
}
.rt_search_wrap .rt_search_btn {
    padding: 9px 14px;
    background: #8259f5;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

/* 구분 탭 */
.rt_filter_tap {
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    gap: 8px;
}
.rt_filter_tap .rt_tap_item {
    flex: 1;
    padding: 8px 10px;
    font-size: 14px;
    border-radius: 6px;
    text-align: center;
    background-color: #e9e9e9;
    color: #999;
    list-style: none;
}
.rt_filter_tap .rt_tap_item.on {
    background-color: #8259f5;
    color: #fff;
    font-weight: 600;
}
.rt_filter_tap .rt_tap_item.on a {
    color: #fff;
}
.rt_filter_tap .rt_tap_item a {
    text-decoration: none;
    color: #999;
}

/* 테이블 */
.rt_list_section {
    padding: 0 16px 20px;
}
.rt_table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    border: 1px solid #e0d8f5;
}
.rt_table th {
    text-align: center;
    vertical-align: middle;
    padding: 11px 8px;
    background: #f3efff;
    border: 1px solid #e0d8f5;
    font-size: 12px;
    color: #8259f5;
    font-weight: 700;
    letter-spacing: -0.3px;
}
.rt_table td {
    text-align: center;
    vertical-align: middle;
    padding: 11px 8px;
    border: 1px solid #e0d8f5;
    font-size: 13px;
    color: #444;
    background: #fff;
}
.rt_table tr:nth-child(odd) td {
    background: #faf8ff;
}
.rt_table td.rt_price {
    font-weight: 700;
    color: #8259f5;
    font-size: 14px;
}

/* 빈 데이터 */
.rt_empty {
    text-align: center;
    padding: 40px 20px;
    color: #bbb;
    font-size: 14px;
}

/* 합계 행 */
.rt_table tr.rt_total_row td {
    background: #f3efff;
    font-weight: 700;
    color: #8259f5;
    font-size: 14px;
    border-top: 2px solid #8259f5;
}

/* 월 네비게이션 */
.rt_month_nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 16px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
}
.rt_month_input {
    flex: 1;
    padding: 9px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: #fff;
    text-align: center;
}
.rt_month_arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    color: #555;
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
}
.rt_month_arrow.disabled {
    color: #ccc;
    cursor: default;
}

/* 상태 배지 */
.rt_badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    vertical-align: middle;
    margin-left: 6px;
}
.badge_settled {
    background: #e8f5e9;
    color: #2e7d32;
}
.badge_realtime {
    background: #fff3e0;
    color: #e65100;
}

/* 정산 상세 카드 */
.rt_detail_card {
    background: #fff;
    border: 1px solid #e0d8f5;
    border-radius: 10px;
    padding: 14px 10px;
    margin-bottom: 12px;
}
.rt_detail_row {
    display: flex;
    gap: 4px;
}
.rt_detail_row_4 {
    margin-top: 0;
}
.rt_detail_item {
    flex: 1;
    text-align: center;
    padding: 6px 2px;
}
.rt_detail_divider {
    height: 1px;
    background: #e0d8f5;
    margin: 10px 0;
}
.rd_label {
    display: block;
    font-size: 12px;
    color: #999;
    margin-bottom: 4px;
}
.rd_value {
    display: block;
    font-size: 15px;
    font-weight: 700;
    color: #333;
}
.rd_highlight {
    color: #8259f5;
    font-size: 16px;
}
.rd_minus {
    color: #999;
}

/* 공제계 토글 */
.rt_deduct_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
}
.rt_deduct_left {
    display: flex;
    align-items: center;
    gap: 6px;
}
.rt_deduct_left .rd_label {
    margin-bottom: 0;
    font-size: 12px;
}
.rt_deduct_left .rd_value {
    font-size: 14px;
    font-weight: 600;
    color: #8259f5;
    margin-bottom: 0;
}
.rt_detail_toggle {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    color: #888;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.rt_detail_toggle .toggle_arrow {
    font-size: 10px;
    transition: transform 0.2s;
}
.rt_detail_toggle.open .toggle_arrow {
    transform: rotate(180deg);
}
.rt_detail_expand {
    display: none;
    padding: 8px 6px 2px;
}
.rt_detail_expand.open {
    display: flex;
    gap: 4px;
}
.rt_detail_expand .rt_detail_item .rd_label {
    font-size: 10px;
    color: #aaa;
}
.rt_detail_expand .rt_detail_item .rd_value {
    font-size: 12px;
    font-weight: 500;
    color: #888;
}

/* 정산구조 버튼 */
.rt_info_btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: #8259f5;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-top: 2px;
}
.rt_info_icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #8259f5;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
}

/* 팝업 오버레이 */
.rt_modal_overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.45);
    z-index: 9999;
    align-items: center;
    justify-content: center;
}
.rt_modal_overlay.active {
    display: flex;
}
.rt_modal {
    background: #fff;
    border-radius: 14px;
    width: 90%;
    max-width: 380px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0,0,0,0.2);
}
.rt_modal_header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #f0f0f0;
}
.rt_modal_header h3 {
    font-size: 16px;
    font-weight: 700;
    color: #222;
    margin: 0;
}
.rt_modal_close {
    background: none;
    border: none;
    font-size: 22px;
    color: #999;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}
.rt_modal_body {
    padding: 16px 18px 20px;
}
.rt_modal_body .rt_calc_step {
    margin-bottom: 14px;
}
.rt_calc_step .step_num {
    display: inline-block;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #8259f5;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    line-height: 22px;
    margin-right: 6px;
}
.rt_calc_step .step_title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
}
.rt_calc_step .step_desc {
    margin-top: 4px;
    padding-left: 28px;
    font-size: 12.5px;
    color: #666;
    line-height: 1.6;
}
.rt_calc_step .step_formula {
    display: inline-block;
    margin-top: 3px;
    padding: 3px 8px;
    background: #f3efff;
    border-radius: 4px;
    font-size: 12px;
    color: #8259f5;
    font-weight: 600;
}
.rt_modal_body .rt_calc_divider {
    height: 1px;
    background: #f0f0f0;
    margin: 12px 0;
}
.rt_modal_body .rt_calc_note {
    font-size: 11.5px;
    color: #999;
    line-height: 1.5;
    padding-left: 4px;
}
</style>

<!-- 월 선택 -->
<form name="fsearch" method="get">
<?php if($md !== '') { ?><input type="hidden" name="md" value="<?=htmlspecialchars($md)?>" /><?php } ?>
<div class="rt_month_nav">
    <a href="?month=<?=$prev_month?><?=($md !== '' ? '&md='.$md : '')?>" class="rt_month_arrow">&lt;</a>
    <input type="month" name="month" value="<?=htmlspecialchars($sel_month)?>" class="rt_month_input" onchange="this.form.submit()" />
    <?php if(!$is_future){ ?>
    <a href="?month=<?=$next_month?><?=($md !== '' ? '&md='.$md : '')?>" class="rt_month_arrow">&gt;</a>
    <?php } else { ?>
    <span class="rt_month_arrow disabled">&gt;</span>
    <?php } ?>
</div>
</form>

<!-- 요약 카드 -->
<div class="rt_summary">
    <div class="rt_summary_title">
        <?=$display_year?>년 <?=$display_month?>월 코인 정산
        <span class="rt_badge <?=$is_settled ? 'badge_settled' : 'badge_realtime'?>"><?=$is_settled ? '정산완료' : '실시간'?></span>
    </div>
    <div class="rt_detail_card">
        <div class="rt_detail_row">
            <div class="rt_detail_item">
                <span class="rd_label">쿠폰상담</span>
                <span class="rd_value"><?=number_format($sum_price_free)?>원</span>
            </div>
            <div class="rt_detail_item">
                <span class="rd_label">충전+후불 상담</span>
                <span class="rd_value"><?=number_format($sum_price_paid)?>원</span>
            </div>
            <div class="rt_detail_item" style="flex:0.55">
                <span class="rd_label">기타정산비</span>
                <span class="rd_value"><?=number_format($sum_price_other)?>원</span>
            </div>
            <div class="rt_detail_item">
                <span class="rd_label">정산비전체</span>
                <span class="rd_value rd_highlight"><?=number_format($sum_price_tot)?>원</span>
            </div>
        </div>
        <div class="rt_detail_divider"></div>
        <div class="rt_deduct_row">
            <div class="rt_deduct_left">
                <span class="rd_label">공제계</span>
                <span class="rd_value">-<?=number_format($sum_deduction_total)?>원</span>
            </div>
            <button type="button" class="rt_detail_toggle" onclick="var e=document.getElementById('rtDeductDetail');var o=e.classList.toggle('open');this.classList.toggle('open',o)">
                세부사항 <span class="toggle_arrow">▼</span>
            </button>
        </div>
        <div class="rt_detail_expand" id="rtDeductDetail">
            <div class="rt_detail_item">
                <span class="rd_label">공급가</span>
                <span class="rd_value"><?=number_format($sum_supply_price)?>원</span>
            </div>
            <div class="rt_detail_item">
                <span class="rd_label">부가세</span>
                <span class="rd_value rd_minus">-<?=number_format($sum_vat_amount)?>원</span>
            </div>
            <div class="rt_detail_item">
                <span class="rd_label">원천세</span>
                <span class="rd_value rd_minus">-<?=number_format($sum_withholding_tax)?>원</span>
            </div>
            <div class="rt_detail_item">
                <span class="rd_label">회선비</span>
                <span class="rd_value rd_minus">-<?=number_format($sum_reply_fee)?>원</span>
            </div>
        </div>
        <div class="rt_detail_divider"></div>
        <div style="text-align:right; padding:2px 6px;">
            <button type="button" class="rt_info_btn" onclick="document.getElementById('rtCalcModal').classList.add('active')">
                <span class="rt_info_icon">?</span> 정산구조 설명
            </button>
        </div>
    </div>
    <div class="rt_card card_total">
        <div class="rc_label">예상 실수령액</div>
        <div class="rc_value"><?=number_format($sum_price)?>원</div>
    </div>
</div>

<!-- 정산구조 설명 팝업 -->
<div class="rt_modal_overlay" id="rtCalcModal" onclick="if(event.target===this)this.classList.remove('active')">
    <div class="rt_modal">
        <div class="rt_modal_header">
            <h3>정산구조 설명</h3>
            <button type="button" class="rt_modal_close" onclick="document.getElementById('rtCalcModal').classList.remove('active')">&times;</button>
        </div>
        <div class="rt_modal_body">
            <div class="rt_calc_step">
                <span class="step_num">1</span>
                <span class="step_title">정산비 계산</span>
                <div class="step_desc">
                    쿠폰상담 금액 &times; 쿠폰 로열티(<?=$royalty_free?>%)<br>
                    충전+후불 상담 금액 &times; 유료 로열티(<?=$royalty_pro?>%)<br>
                    기타 포인트 지급분 &times; 유료 로열티(<?=$royalty_pro?>%) + 차감분 전액 반영<br>
                    <span class="step_formula">정산비전체 = 쿠폰정산 + 유료정산 + 기타정산비</span>
                </div>
            </div>
            <div class="rt_calc_step">
                <span class="step_num">2</span>
                <span class="step_title">공급가 산출</span>
                <div class="step_desc">
                    정산비전체에서 부가세(10%)를 분리합니다.<br>
                    <span class="step_formula">공급가 = 정산비전체 &divide; 1.1</span><br>
                    현재: <?=number_format($sum_supply_price)?>원
                </div>
            </div>
            <div class="rt_calc_step">
                <span class="step_num">3</span>
                <span class="step_title">부가세 공제</span>
                <div class="step_desc">
                    <span class="step_formula">부가세 = 정산비전체 - 공급가</span><br>
                    현재: -<?=number_format($sum_vat_amount)?>원
                </div>
            </div>
            <div class="rt_calc_step">
                <span class="step_num">4</span>
                <span class="step_title">원천세 공제</span>
                <div class="step_desc">
                    공급가의 3.3%를 원천징수합니다.<br>
                    <span class="step_formula">원천세 = 공급가 &times; 3.3%</span><br>
                    현재: -<?=number_format($sum_withholding_tax)?>원
                </div>
            </div>
            <div class="rt_calc_step">
                <span class="step_num">5</span>
                <span class="step_title">회선비 공제</span>
                <div class="step_desc">
                    정산비전체가 50,000원 이상일 경우<br>회선비 20,000원이 공제됩니다.<br>
                    <span class="step_formula">회선비 = <?=$sum_reply_fee > 0 ? '20,000원' : '0원 (5만원 미만)'?></span>
                </div>
            </div>
            <div class="rt_calc_divider"></div>
            <div class="rt_calc_step">
                <span class="step_num" style="background:#2e7d32;">✓</span>
                <span class="step_title">예상 실수령액</span>
                <div class="step_desc">
                    <span class="step_formula">공급가 - 원천세 - 회선비</span><br>
                    <?=number_format($sum_supply_price)?>원 - <?=number_format($sum_withholding_tax)?>원 - <?=number_format($sum_reply_fee)?>원<br>
                    <b style="color:#8259f5; font-size:14px;">= <?=number_format($sum_price)?>원</b>
                </div>
            </div>
            <div class="rt_calc_divider"></div>
            <p class="rt_calc_note">
                * 부가세는 정산비에 포함되어 있어 별도 지급되지 않습니다.<br>
                * 원천세는 국세청에 신고되며, 종합소득세 신고 시 기납부세액으로 공제됩니다.<br>
                * 실시간 표시 금액은 예상 금액이며, 정산 완료 후 확정됩니다.
            </p>
        </div>
    </div>
</div>

<!-- 구분 탭 -->
<div class="rt_filter_tap">
    <ul class="rt_tap_item <?php if($md=='') echo 'on'; ?>"><a href="?month=<?=$sel_month?>">전체</a></ul>
    <ul class="rt_tap_item <?php if($md=='Y') echo 'on'; ?>"><a href="?month=<?=$sel_month?>&md=Y">후불</a></ul>
    <ul class="rt_tap_item <?php if($md=='N') echo 'on'; ?>"><a href="?month=<?=$sel_month?>&md=N">선불</a></ul>
</div>

<div style="padding:0 16px 4px;">
    <?php echo display_banner('상담사-코인내역', 'mainbanner.10.skin.php'); ?>
</div>

<!-- 리스트 -->
<div class="rt_list_section">
    <table class="rt_table">
        <thead>
            <tr>
                <th>일자</th>
                <th>고객명</th>
                <th>구분</th>
                <th>정산코인</th>
            </tr>
        </thead>
        <tbody>
        <?php
        for ($i=0; $row = sql_fetch_array($result); $i++) {
            // 고객명 조회
            $customer_disp = '-';
            $bind_member = null;
            if (!empty($row['membid'])) {
                $membid_esc = sql_real_escape_string($row['membid']);
                $bind_member = sql_fetch("SELECT mb_id, mb_name FROM g5_member WHERE mb_1 = '{$membid_esc}' LIMIT 1");
                if (empty($bind_member['mb_id'])) {
                    $bind_member = sql_fetch("SELECT mb_id, mb_name FROM g5_member WHERE mb_id = '{$membid_esc}' LIMIT 1");
                }
            }
            if (empty($bind_member['mb_id']) && !empty($row['tc_from'])) {
                $bind_phone = preg_replace('/[^0-9]/', '', $row['tc_from']);
                if ($bind_phone !== '') {
                    $bind_phone_esc = sql_real_escape_string($bind_phone);
                    $bind_member = sql_fetch("SELECT mb_id, mb_name FROM g5_member WHERE REPLACE(mb_hp, '-', '') = '{$bind_phone_esc}' LIMIT 1");
                }
            }
            if (!empty($bind_member['mb_name'])) {
                $customer_disp = $bind_member['mb_name'];
            } elseif (!empty($bind_member['mb_id'])) {
                $customer_disp = $bind_member['mb_id'];
            }

            // 구분
            if ($row['reason'] === 'END_CHAT') {
                $flag_disp = '채팅';
            } else {
                $flag_disp = ($row['preflag'] === 'Y') ? '선불' : '후불';
            }

            // 정산코인
            $row_coin = (int)floor((int)$row['amt_free'] * $royalty_free / 100)
                      + (int)floor((int)$row['amt_pro'] * $royalty_pro / 100);
        ?>
            <tr>
                <td><?=substr($row["wr_datetime"], 0, 10)?></td>
                <td><?=$customer_disp?></td>
                <td><?=$flag_disp?></td>
                <td class="rt_price"><?=number_format($row_coin)?>원</td>
            </tr>
        <?php
        }

        if ($i > 0) {
        ?>
            <tr class="rt_total_row">
                <td colspan="3">합계 (<?=$total_count?>건)</td>
                <td class="rt_price"><?=number_format($filtered_total)?>원</td>
            </tr>
        <?php
        }

        if ($i == 0) {
            echo "<tr><td colspan='4' class='rt_empty'>조회된 내역이 없습니다.</td></tr>";
        }
        ?>
        </tbody>
    </table>

    <div style="padding-top:12px; text-align:center;">
    <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>
    </div>
</div>

<?php if($member['mb_id'] === 'demonster1' && !$is_settled){ ?>
<!-- 기타정산비 디버그 -->
<div style="margin:20px 16px; padding:12px; background:#f9f9f9; border:1px solid #ddd; border-radius:8px; font-size:12px;">
    <b>[기타정산비 상세]</b> royalty_pro=<?=$royalty_pro?>%<br>
    지급합(amt_plus): <?=number_format($other_sum['amt_plus'])?>원 × <?=$royalty_pro?>% = <?=number_format((int)floor((int)$other_sum['amt_plus'] * $royalty_pro / 100))?>원<br>
    차감합(amt_minus): <?=number_format($other_sum['amt_minus'])?>원 (전액반영)<br>
    <b>기타정산비 = <?=number_format($sum_price_other)?>원</b>
    <hr style="margin:8px 0">
    <b>[기타 포인트 내역]</b>
    <table border="1" cellpadding="3" style="font-size:11px; border-collapse:collapse; width:100%; margin-top:4px">
    <tr style="background:#eee"><th>po_id</th><th>po_point</th><th>po_content</th><th>po_rel_table</th><th>po_datetime</th></tr>
    <?php
    $dbg = sql_query("
        SELECT po_id, po_point, po_content, po_rel_table, po_datetime
        FROM g5_point
        WHERE mb_id='{$mb_id_esc}'
          AND po_datetime >= '{$startday}' AND po_datetime < '{$endday}'
          AND po_rel_table NOT IN ('@member', '@platform_consulting')
        ORDER BY po_datetime
    ");
    while($dr = sql_fetch_array($dbg)){
        $dc = (int)$dr['po_point'] < 0 ? 'color:red' : 'color:blue';
        echo "<tr><td>{$dr['po_id']}</td><td style='text-align:right;{$dc};font-weight:bold'>".number_format($dr['po_point'])."</td><td>{$dr['po_content']}</td><td>{$dr['po_rel_table']}</td><td>{$dr['po_datetime']}</td></tr>";
    }
    ?>
    </table>
</div>
<?php } ?>

<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
