<?php
$sub_menu = "350410";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
#################################################################3

// 20250716 eun $_SERVER["REQREST_URI"] -> $_SERVER["REQUEST_URI"] 수정 시작
if(!$member["mb_id"]){
    alert('로그인하셔야합니다.','/bbs/login.php?url='.$_SERVER["REQUEST_URI"]);
}
// 20250716 eun $_SERVER["REQREST_URI"] -> $_SERVER["REQUEST_URI"] 수정 마감

// 날짜 파라미터 검증
$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';

// 뷰 파라미터: all | call | chat (기본값 all)
$view = (isset($_GET['view']) && in_array($_GET['view'], ['all','call','chat'], true)) ? $_GET['view'] : 'all';

// 공통 FROM
$sql_common = " from platform_consulting ";

// 공통 WHERE(검색/기간)과 reason WHERE(뷰 구분)를 분리
$where_base = " where (1) "; // 검색/기간 등 공통
$where_reason = "";          // view에 따른 reason
$sql_search_preflag = "";    // 060/070 전용 (preflag)

// 검색어 처리
if ($stx) {
    $where_base .= " and ( ";
    switch ($sfl) {
        case 'mb_id' :
            // 회원아이디 -> g5_member.mb_1 조회 후 membid 매칭
            $sql1 = "select mb_1 from g5_member where mb_id='".$stx."'";
            $rst1 = sql_query($sql1);
            if($rst1){
                $row1 = sql_fetch_array($rst1);
            }
            if(!empty($row1["mb_1"])){
                $where_base .= " membid='".$row1["mb_1"]."'";
            } else {
                $where_base .= " 1=1 "; // 매칭 없으면 noop
            }
            break;

        case 'cmb_id' :
            // 상담사 아이디: 현재 테이블의 mb_id 컬럼에 매칭
            $where_base .= " mb_id= '{$stx}'";
            break;

        case 'mb_hp' :
            // 휴대폰번호: 하이픈 제거하여 from 컬럼과 매칭
            $where_base .= " `from` = '".str_replace("-","",$stx)."'";
            break;

        case 'mb_nick' :
            // 상담사 닉네임 -> g5_member.mb_1 조회 후 csrid 매칭
            $sql1 = "select mb_1 from g5_member where mb_nick='".$stx."'";
            $rst1 = sql_query($sql1);
            if($rst1){
                $row1 = sql_fetch_array($rst1);
            }
            if(!empty($row1["mb_1"])){
                $where_base .= " csrid='".$row1["mb_1"]."'";
            } else {
                $where_base .= " 1=1 ";
            }
            break;

        default :
            // 기타 컬럼 LIKE
            $where_base .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $where_base .= " ) ";
}

// preflag(060/070) 전용
if ($sfl == "preflag") {
    $sql_search_preflag .= " and preflag='".$stx."'";
}

// 기간 검색
if ($fr_date && $to_date) {
    $where_base .= " and wr_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}

// 정렬 기본값
if (!$sst) {
    $sst = "wr_datetime";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

// view에 따른 reason WHERE
if ($view === 'call') {
    $where_reason = " and reason='DISCONNECT' ";
} elseif ($view === 'chat') {
    $where_reason = " and reason='END_CHAT' ";
} else { // all
    $where_reason = " and (reason='DISCONNECT' or reason='END_CHAT') ";
}

// 최종 리스트용 WHERE = 공통(검색/기간) + reason + (선택)preflag
$sql_search = $where_base . $where_reason . $sql_search_preflag;

// 총건수 (COUNT에는 ORDER BY 불필요)
$sql = " select count(*) as cnt {$sql_common} {$sql_search} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

// 페이징
$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);
if ($page < 1) $page = 1;
$from_record = ($page - 1) * $rows;

// 목록 조회
$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";
$result = sql_query($sql);

// 카운트(배지) — 검색/기간만 반영(= $where_base), reason은 고정
// 070
$sql2 = " select count(*) as cnt {$sql_common} {$where_base} and reason='DISCONNECT' and preflag='Y'";
$row = sql_fetch($sql2);
$count_070 = $row['cnt'];

// 060
$sql3 = " select count(*) as cnt {$sql_common} {$where_base} and reason='DISCONNECT' and preflag=''";
$row = sql_fetch($sql3);
$count_060 = $row['cnt'];

// 채팅
$sql4 = " select count(*) as cnt {$sql_common} {$where_base} and reason='END_CHAT'";
$row = sql_fetch($sql4);
$count_chat = $row['cnt'];

// 쿼리스트링 (view를 포함해 항상 유지)
$q = [
    'view'    => $view,
    'sfl'     => $sfl,
    'stx'     => $stx,
    'fr_date' => $fr_date,
    'to_date' => $to_date,
    'sort1'   => $sort1 ?? '',
    'sort2'   => $sort2 ?? '',
    'page'    => $page ?? 1,
];
$qstr_raw  = http_build_query($q);                                  // 로직/페이징용
$qstr_html = htmlspecialchars($qstr_raw, ENT_QUOTES, 'UTF-8');      // 링크용

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'?view=all" class="ov_listall">전체목록</a>';

$g5['title'] = '사용(상담) 내역';
include_once('./admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
$colspan = 16;
?>
    <style>
        .gray_bg { background-color:#FC0 !important;}
    </style>

    <div class="local_ov01 local_ov">
        <?php echo $listall ?>
        <span class="btn_ov01"><span class="ov_txt">총건수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>

        <!-- 060: 통화 뷰 고정 -->
        <a class="btn_ov01"
           href="?<?php echo htmlspecialchars(http_build_query(array_merge($q, ['view'=>'call','sfl'=>'preflag','stx'=>''])), ENT_QUOTES, 'UTF-8'); ?>">
            <span class="ov_txt">060</span><span class="ov_num"><?php echo number_format($count_060) ?>건</span>
        </a>

        <!-- 070: 통화 뷰 고정 -->
        <a class="btn_ov01"
           href="?<?php echo htmlspecialchars(http_build_query(array_merge($q, ['view'=>'call','sfl'=>'preflag','stx'=>'Y'])), ENT_QUOTES, 'UTF-8'); ?>">
            <span class="ov_txt">070</span><span class="ov_num"><?php echo number_format($count_070) ?>건</span>
        </a>

        <!-- CHAT: 채팅 뷰 전환 -->
        <a class="btn_ov01"
           href="?<?php echo htmlspecialchars(http_build_query(array_merge($q, ['view'=>'chat','sfl'=>'','stx'=>''])), ENT_QUOTES, 'UTF-8'); ?>">
            <span class="ov_txt">채팅</span><span class="ov_num"><?php echo number_format($count_chat) ?>건</span>
        </a>
    </div>

    <div class="sch_text_date_wrap" style="">
        <form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">
            <div class="sch_text_date" style="">
                <!-- 현재 view 유지 -->
                <input type="hidden" name="view" value="<?php echo htmlspecialchars($view, ENT_QUOTES, 'UTF-8'); ?>">

                <label for="sfl" class="sound_only">검색대상</label>
                <select name="sfl" id="sfl">
                    <option value="mb_id"<?php echo get_selected($sfl, "mb_id"); ?>>회원아이디</option>
                    <option value="mb_hp"<?php echo get_selected($sfl, "mb_hp"); ?>>휴대폰번호</option>
                    <option value="mb_nick"<?php echo get_selected($sfl, "mb_nick"); ?>>상담사닉네임</option>
                    <option value="cmb_id"<?php echo get_selected($sfl, "cmb_id"); ?>>상담사 아이디</option>
                </select>

                <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
                <input type="text" name="stx" value="<?php echo $stx ?>" id="stx" class="frm_input">
                <input type="submit" class="btn_submit" value="검색">

                <div class="sch_text_date_line" style=""> |</div>

                <div class="sch_last" style="margin:0;">
                    <strong>기간별검색</strong>
                    <input type="text" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date" class="frm_input" size="11" maxlength="10">
                    <label for="fr_date" class="sound_only">시작일</label>
                    ~
                    <input type="text" name="to_date" value="<?php echo $to_date ?>" id="to_date" class="frm_input" size="11" maxlength="10">
                    <label for="to_date" class="sound_only">종료일</label>
                    <input type="submit" value="검색" class="btn_submit">
                </div>
            </div>
        </form>

        <script>
            $(function(){
                $("#fr_date, #to_date").datepicker({
                    changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd",
                    showButtonPanel: true, yearRange: "c-99:c+99", maxDate: "+0d"
                });
            });
        </script>

        <a class="btn btn_excel" style="float:right;"
           href="coin_counsel_history_excel.php?<?php echo $qstr_html; ?>">엑셀다운로드</a>
    </div>

    <form name="fmemberlist" id="fmemberlist" action="./member_list_update.php" onsubmit="return fmemberlist_submit(this);" method="post">
        <input type="hidden" name="sst" value="<?php echo $sst ?>">
        <input type="hidden" name="sod" value="<?php echo $sod ?>">
        <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
        <input type="hidden" name="stx" value="<?php echo $stx ?>">
        <input type="hidden" name="page" value="<?php echo $page ?>">
        <input type="hidden" name="token" value="">

        <div class="tbl_head01 tbl_wrap">
            <div class="tbl_head01 tbl_wrap">
                <table>
                    <caption><?php echo $g5['title']; ?> 목록</caption>
                    <thead>
                    <tr>
                        <th scope="col" id="mb_list_auth">날짜</th>
                        <th scope="col" id="mb_list_mng">회원ID</th>
                        <th scope="col" id="mb_list_mng">회원이름</th>
                        <th scope="col" id="mb_list_mng">상담사ID</th>
                        <th scope="col" id="mb_list_mng">상담사닉네임</th>
                        <th scope="col" id="mb_list_auth">상담유형</th>
                        <th scope="col" id="mb_list_auth" class="">분야</th>
                        <th scope="col" id="mb_list_mng">상담시작</th>
                        <th scope="col" id="mb_list_mng">상담종료</th>
                        <th scope="col" id="mb_list_mng">진행시간</th>
                        <th scope="col" id="mb_list_mng">유·무료</th>
                        <th scope="col" id="mb_list_mng">사용포인트</th>
                        <th scope="col" id="mb_list_mng" class="">상담주제</th>
                        <th scope="col" id="mb_list_auth">채팅내용</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    for ($i=0; $row=sql_fetch_array($result); $i++) {

                        $cinfo = get_csrid($row["csrid"]);
                        $con_write_detail = get_con_detail($row["no"]);
                        $minfo = get_mbid($row["membid"]);
                        $img = get_con_img($cinfo["mb_id"], '70', '70');

                        $bg = 'bg'.($i%2);

                        $sql1 = "select * from g5_write_counselor where mb_id='".$cinfo["mb_id"]."'";
                        $rst1 = sql_fetch($sql1);
                        $coninfo = $rst1;

                        $is_chat = (isset($row['reason']) && $row['reason'] === 'END_CHAT');

                        $raw_token = $row['roomid'] ?? ($row['room_token'] ?? '');
                        $token = ($raw_token !== '') ? $raw_token.'1' : '';
                        ?>
                        <tr class="<?php echo $bg; ?>">
                            <td headers="mb_list_auth" class="td_mng_l">
                                <?=$row["eventtm"]?>
                            </td>
                            <td headers="mb_list_grp" class="">
                                <?php if($row["membid"]){ ?>
                                    <?=$minfo["mb_id"]?>
                                <?php } else { ?>
                                    <?=$cinfo["mb_id"]?>
                                <?php } ?>
                            </td>
                            <td headers="mb_list_grp" class="">
                                <?php if($row["membid"]){ ?>
                                    <?=$minfo["mb_name"]?>
                                <?php } else { ?>
                                    <?=$cinfo["mb_name"]?>
                                <?php } ?>
                            </td>
                            <td headers="mb_list_grp" class=""><?=$cinfo["mb_id"]?></td>
                            <td headers="mb_list_grp" class=""><?=$cinfo["mb_nick"]?></td>
                            <td headers="mb_list_auth" class="">
                                <?php
                                if ($is_chat) {
                                    echo "채팅";
                                } else {
                                    echo ($row["preflag"]=="Y") ? "선불" : "후불";
                                }
                                ?>
                            </td>
                            <td headers="mb_list_grp" class=""><?=$coninfo["ca_name"]?></td>
                            <td headers="mb_list_grp" class=""><?=$row["start"]?></td>
                            <td headers="mb_list_grp" class=""><?=$row["end"]?></td>
                            <td headers="mb_list_grp" class=""><?=gmdate("H시간i분s초", (int)$row["usetm"]);?></td>
                            <td headers="mb_list_grp" class=""><?php echo ($row["p_gubun"]=="Y") ? "유료" : "무료"; ?></td>
                            <td headers="mb_list_auth" class=""><?=number_format((int)$row["amt"])?></td>
                            <td headers="mb_list_grp" class="">
                                <?php
                                $mms = "";
                                if($con_write_detail["wr_2"]){
                                    $mms = $con_write_detail["wr_2"];
                                }else{
                                    $mms = "확인";
                                }
                                ?>
                                <?php if(!$con_write_detail["wr_id"]){ ?>
                                    <span onclick="window.open('../bbs/write.php?bo_table=c_history&no=<?=$row["no"]?>&md=conmy', '상담내용', 'width=450, height=650, location=no, status=no, scrollbars=yes');" style="text-decoration:underline; font-weight:600; cursor:pointer;"><?=$mms?></span>
                                <?php } else { ?>
                                    <span onclick="window.open('../bbs/write.php?bo_table=c_history&w=u&wr_id=<?=$con_write_detail["wr_id"]?>&no=<?=$row["no"]?>&md=conmy', '상담내용', 'width=450, height=650, location=no, status=no, scrollbars=yes');" style="text-decoration:underline; font-weight:600; cursor:pointer;"><?=$mms?></span>
                                <?php } ?>
                            </td>
                            <td headers="mb_list_mng" class="">
                                <?php if ($is_chat && $raw_token): ?>
                                    <a class="history_btn"
                                       href="/counsel/chat_history.php?token=<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>">
                                        채팅내역
                                    </a>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php
                    }
                    if ($i == 0)
                        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
                    ?>
                    </tbody>
                </table>
            </div>
        </div>

    </form>

<?php
// 페이징: raw 쿼리스트링 사용
echo get_paging(
    G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'],
    $page,
    $total_page,
    '?'.$qstr_raw.'&page='
);
?>

    <script>
        function fmemberlist_submit(f)
        {
            if (!is_checked("chk[]")) {
                alert(document.pressed+" 하실 항목을 하나 이상 선택하세요.");
                return false;
            }

            if(document.pressed == "선택삭제") {
                if(!confirm("선택한 자료를 정말 삭제하시겠습니까?")) {
                    return false;
                }
            }

            return true;
        }

        if(document.pressed == "완전삭제") {
            if(!confirm("선택한 자료를 정말 완전히 삭제하시겠습니까?\n\n삭제된 회원은 복구 불가능합니다.")) {
                return false;
            }
        }
    </script>

<?php
include_once ('./admin.tail.php');
