<?php
include_once('../common.php');

// 페이지 제목
$g5['title'] = "코인내역";
include_once(G5_THEME_MOBILE_PATH.'/head.php');

#####################################################################

// 로그인 체크
if(!$member["mb_id"]){
    alert('로그인 하셔야합니다', '/bbs/login.php');
    exit;
}

// 입력값
$md_raw = isset($_REQUEST["md"]) ? $_REQUEST["md"] : '';
$md = in_array($md_raw, ['Y','N'], true) ? $md_raw : '';

$nowday = date("Y-m",time())."-01 00:00:00";

$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';

// 정렬 컬럼/방향 (필요시 화이트리스트 확장)
$sst = isset($_GET['sst']) ? $_GET['sst'] : '';
$sod = isset($_GET['sod']) ? $_GET['sod'] : '';
if (!in_array($sst, ['gp.po_datetime','gp.po_point','gp.po_content'], true)) {
    $sst = 'gp.po_datetime';
}
if (!in_array(strtolower($sod), ['asc','desc'], true)) {
    $sod = 'desc';
}

// 페이지네이션 기본값
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;

// JOIN: g5_point → platform_consulting → g5_member
$sql_common = "
  FROM g5_point gp
  LEFT JOIN platform_consulting tc ON tc.no = gp.c_no
  LEFT JOIN g5_member gm ON gm.mb_1 = tc.membid
";

// 검색 조건
$sql_search  = " WHERE gp.mb_id = '".sql_real_escape_string($member['mb_id'])."' ";
if ($md !== '') {
    $sql_search .= " AND gp.p_gubun = '".sql_real_escape_string($md)."' ";
}
if ($fr_date && $to_date) {
    $sql_search .= " AND gp.po_datetime BETWEEN '{$fr_date} 00:00:00' AND '{$to_date} 23:59:59' ";
}

// 정렬
$sql_order = " ORDER BY {$sst} {$sod} ";

// 전체 건수
$sql = "SELECT COUNT(*) AS cnt {$sql_common} {$sql_search}";
$row = sql_fetch($sql);
$total_count = (int)$row['cnt'];

// 페이징 계산
$rows = (int)$config['cf_page_rows'];
if ($rows < 1) $rows = 15;
$total_page  = max(1, (int)ceil($total_count / $rows));
if ($page > $total_page) $page = $total_page;
$from_record = ($page - 1) * $rows;

// 데이터 조회
$sql = "
  SELECT gp.*,
         tc.membid,
         tc.preflag,
         tc.no AS tc_no,
         gm.mb_id   AS cust_mb_id,
         gm.mb_name AS cust_mb_name
  {$sql_common}
  {$sql_search}
  {$sql_order}
  LIMIT {$from_record}, {$rows}
";
$result = sql_query($sql);

// 페이징용 qstr 구성
$qparams = [];
if ($md !== '') { $qparams['md'] = $md; }
if ($fr_date)    { $qparams['fr_date'] = $fr_date; }
if ($to_date)    { $qparams['to_date'] = $to_date; }
if ($sst)        { $qparams['sst'] = $sst; }
if ($sod)        { $qparams['sod'] = $sod; }
$qstr = http_build_query($qparams);
?>

<?php
include_once(G5_PATH.'/include/counselor_settlement_navi.php');
?>

    <style>
        #main_bn { width:100%; float:left;}
        #main_bn img { margin-bottom:15px; margin-top:10px; border-radius:10px;}
        .top_nav{
           margin-bottom : 20px;
        }
        .top_nav_01 {
            border-color: #8259f5 !important;
            color: #8259f5;
            font-weight: 600;
            
        }


        /* top_nav 탭 글자 1.1배 */
        .top_nav a ul {
            font-size: 1.1em;
        }

        /* 1. 상단 누적 코인 한줄 표기 */
        .coin_summary_box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(135deg, #8259f5, #6b3fe4);
            border-radius: 12px;
            padding: 16px 20px;
            margin: 30px 15px 10px;
            
            color: #fff;
            white-space: nowrap;
        }
        .coin_summary_box .coin_label {
            font-size: 14px;
            font-weight: 500;
            opacity: 0.85;
        }
        .coin_summary_box .coin_title {
            font-size: 13px;
            font-weight: 600;
            text-align: center;
        }
        .coin_summary_box .coin_value {
            font-size: 17px;
            font-weight: 700;
            text-align: center;
            margin-top: 2px;
        }
        .coin_summary_box .coin_divider {
            width: 1px;
            height: 36px;
            background: rgba(255,255,255,0.3);
            margin: 0 10px;
            flex-shrink: 0;
        }
        .coin_summary_box .coin_item {
            flex: 1;
            text-align: center;
        }

        /* 2. 라디오 버튼 스타일 탭 */
        .filter_radio_group {
            display: flex;
            gap: 10px;
            padding: 12px 15px 4px;
        }
        .filter_radio_group input[type="radio"] {
            display: none;
        }
        .filter_radio_group label {
            flex: 1;
            text-align: center;
            padding: 10px 0;
            font-size: 14px;
            font-weight: 600;
            border-radius: 50px;
            border: 2px solid #e0e0e0;
            color: #999;
            background: #fff;
            cursor: pointer;
            transition: all 0.2s;
        }
        .filter_radio_group input[type="radio"]:checked + label {
            background: #8259f5;
            border-color: #8259f5;
            color: #fff;
            box-shadow: 0 2px 8px rgba(130,89,245,0.3);
        }

        /* 3. 날짜 검색 영역 */
        .date_search_box {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
        }
        .date_search_box input[type="date"] {
            flex: 1;
            height: 42px;
            border: 1.5px solid #e0e0e0;
            border-radius: 8px;
            padding: 0 10px;
            font-size: 14px;
            color: #333;
            background: #fafafa;
            transition: border-color 0.2s;
        }
        .date_search_box input[type="date"]:focus {
            border-color: #8259f5;
            outline: none;
            background: #fff;
        }
        .date_search_box .date_sep {
            color: #bbb;
            font-size: 14px;
            flex-shrink: 0;
        }
        .date_search_box .btn_date_search {
            height: 42px;
            padding: 0 18px;
            background: #8259f5;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .date_search_box .btn_date_search:hover {
            background: #6b3fe4;
        }

        /* 4. 리스트 스타일 */
        .list_wrap {
            padding: 0 15px 20px;
        }
        .list_wrap table {
            width: 100%;
            border-collapse: collapse;
        }
        .list_wrap thead th {
            padding: 12px 6px;
            font-size: 12px;
            font-weight: 700;
            color: #8259f5;
            background: #f3efff;
            border-bottom: 2px solid #8259f5;
            border-right: 1px solid #e0d8f5;
            text-align: center;
            white-space: nowrap;
        }
        .list_wrap thead th:last-child {
            border-right: none;
        }
        .list_wrap tbody td {
            padding: 12px 6px;
            font-size: 13px;
            color: #444;
            border-bottom: 1px solid #f0f0f0;
            border-right: 1px solid #f0f0f0;
            text-align: center;
            vertical-align: middle;
        }
        .list_wrap tbody td:last-child {
            border-right: none;
        }
        .list_wrap tbody tr:hover {
            background: #faf8ff;
        }
        .list_wrap tbody tr:last-child td {
            border-bottom: none;
        }
        .coin_amount {
            font-weight: 700;
            color: #8259f5;
            white-space: nowrap;
        }
        .coin_amount.minus {
            color: #e8426c;
        }
        .badge_pre, .badge_post {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 50px;
            font-size: 11px;
            font-weight: 600;
        }
        .badge_pre {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .badge_post {
            background: #fff3e0;
            color: #e65100;
        }
        .right { text-align: right; }
        .no_data_row td {
            text-align: center;
            padding: 40px 0 !important;
            color: #bbb;
            font-size: 14px;
        }
    </style>

    <!-- 1. 상단 누적 코인 (한줄) -->
    <div class="coin_summary_box">
        <div class="coin_item">
            <div class="coin_title">이번달 누적 코인</div>
        </div>
        <div class="coin_divider"></div>
        <div class="coin_item">
            <div class="coin_title">전달</div>
            <div class="coin_value"><?=number_format(get_con_total_account_befre($member["mb_id"]))?>원</div>
        </div>
        <div class="coin_divider"></div>
        <div class="coin_item">
            <div class="coin_title">이달</div>
            <div class="coin_value"><?=number_format(get_con_total_account($member["mb_id"]))?>원</div>
        </div>
    </div>

    <div class="con_section sub_section_100 c_coin_wrap">

        <!-- 2. 전체/후불/선불 라디오 스타일 -->
        <div class="filter_radio_group">
            <input type="radio" name="md_filter" id="md_all" <?php if($md=='') echo 'checked'; ?> onclick="location.href='?'">
            <label for="md_all">전체</label>
            <input type="radio" name="md_filter" id="md_y" <?php if($md=='Y') echo 'checked'; ?> onclick="location.href='?md=Y'">
            <label for="md_y">후불</label>
            <input type="radio" name="md_filter" id="md_n" <?php if($md=='N') echo 'checked'; ?> onclick="location.href='?md=N'">
            <label for="md_n">선불</label>
        </div>

        <!-- 3. 날짜 검색 -->
        <form name="fsearch" method="get">
            <?php if($md !== ''): ?><input type="hidden" name="md" value="<?php echo $md; ?>"><?php endif; ?>
            <div class="date_search_box">
                <input type="date" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date">
                <span class="date_sep">~</span>
                <input type="date" name="to_date" value="<?php echo $to_date ?>" id="to_date">
                <button type="submit" class="btn_date_search">검색</button>
            </div>
        </form>

        <div style="padding:0 15px;"><?php echo display_banner('상담사-코인내역', 'mainbanner.10.skin.php'); ?></div>

        <!-- 4. 리스트 -->
        <div class="list_wrap">
            <table border="0" cellpadding="0" cellspacing="0">
                <thead>
                <tr>
                    <th scope="col">일자</th>
                    <th scope="col">상담유형</th>
                    <th scope="col">고객명</th>
                    <th scope="col">구분</th>
                    <th scope="col">획득코인</th>
                </tr>
                </thead>
                <tbody>
                <?php
                for ($i=0; $row = sql_fetch_array($result); $i++) {
                    $customer_disp = $row['cust_mb_name'] ? $row['cust_mb_name'] : ($row['cust_mb_id'] ? $row['cust_mb_id'] : '-');
                    $flag_disp = '-';
                    $flag_class = '';
                    if (!empty($row['tc_no'])) {
                        if ($row['preflag'] === 'Y') {
                            $flag_disp = '선불';
                            $flag_class = 'badge_pre';
                        } else {
                            $flag_disp = '후불';
                            $flag_class = 'badge_post';
                        }
                    }
                    $point_val = (int)$row["po_point"];
                    $amount_class = $point_val < 0 ? 'coin_amount minus' : 'coin_amount';
                    ?>
                    <tr>
                        <td><?= date('Y.m.d', strtotime($row["po_datetime"])) ?></td>
                        <td><?= $row["po_content"] ?></td>
                        <td><?= $customer_disp ?></td>
                        <td><?php if($flag_class): ?><span class="<?= $flag_class ?>"><?= $flag_disp ?></span><?php else: ?>-<?php endif; ?></td>
                        <td class="right">
                            <span class="<?= $amount_class ?>"><?= number_format($point_val) ?>원</span>
                        </td>
                    </tr>
                <?php } ?>

                <?php
                if ($i == 0) {
                    echo "<tr class='no_data_row'><td colspan='5'>자료가 없습니다.</td></tr>";
                }
                ?>
                </tbody>
            </table>

            <?php
            echo get_paging(
                G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'],
                $page,
                $total_page,
                '?'.$qstr.'&amp;page='
            );
            ?>
        </div>
    </div>

<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
