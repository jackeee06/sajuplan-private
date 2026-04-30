<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH . '/thumbnail.lib.php');

/* =========================
 * 상담 채널 라벨 유틸 (상단 선언)
 * ========================= */
if (!function_exists('ts_get_consult_label')) {
    function ts_get_consult_label(array $review, $counselor_id, ?array $sa_info = null)
    {

        // 0) 리뷰(wr_3)에 명시된 상담채널이 있으면 최우선 사용
        $wr3 = isset($review['wr_3']) ? trim((string)$review['wr_3']) : '';
        if ($wr3 !== '') {
            // CALL/CHAT 체계 저장(권장)과 자유입력 모두 수용
            $norm = preg_replace('/[()\s_-]|상담/u', '', $wr3); // 괄호/공백/‘상담’ 제거
            $normU = strtoupper($norm);

            if (in_array($normU, ['CALL', 'TEL', 'PHONE']) || $norm === '전화') {
                return '전화상담';
            }
            if (in_array($normU, ['CHAT']) || $norm === '채팅') {
                return '채팅상담';
            }
            // 매칭 안 되면 여기서 라벨 고정하지 않고 뒤 로직으로 폴백
        }

        // 1) sa_info 우선
        if (is_array($sa_info)) {
            if (!empty($sa_info['roomid'])) return '채팅상담';
            if (!empty($sa_info['to']) || !empty($sa_info['telno'])) return '전화상담';
        }

        // 2) 근접 컨설팅 로그 조회 (작성자/상담사 기준)
        $rv_mb_id = $review['mb_id'] ?? '';
        $rv_dt = $review['wr_datetime'] ?? '';
        if ($counselor_id === '' || $rv_mb_id === '') return '';

        $csrid = addslashes($counselor_id);
        $mbid = addslashes($rv_mb_id);

        // 너무 먼 과거/미래 매칭을 막고 싶다면 아래 주석 해제 (±7일)
        // $window = 7 * 24 * 3600;
        // $time_filter = $rv_dt ? "AND ABS(TIMESTAMPDIFF(SECOND, start, '".addslashes($rv_dt)."')) <= {$window}" : "";

        $order = $rv_dt
            ? "ORDER BY ABS(TIMESTAMPDIFF(SECOND, start, '" . addslashes($rv_dt) . "')) ASC, no DESC"
            : "ORDER BY no DESC";

        // (a) mb_id 기준
        $sql = "SELECT roomid, `to` AS dst_to, telno
                  FROM platform_consulting
                 WHERE csrid = '{$csrid}' AND mb_id = '{$mbid}'
                 {$order}
                 LIMIT 1";
        // {$time_filter} 를 WHERE 절에 넣고 싶다면 위 WHERE 끝에 추가
        $row = sql_fetch($sql);
        if ($row) {
            if (!empty($row['roomid'])) return '채팅상담';
            if (!empty($row['dst_to']) || !empty($row['telno'])) return '전화상담';
        }

        // (b) membid 기준
        $sql2 = "SELECT roomid, `to` AS dst_to, telno
                   FROM platform_consulting
                  WHERE csrid = '{$csrid}' AND membid = '{$mbid}'
                  {$order}
                  LIMIT 1";
        // {$time_filter} 동일하게 적용 가능
        $row2 = sql_fetch($sql2);
        if ($row2) {
            if (!empty($row2['roomid'])) return '채팅상담';
            if (!empty($row2['dst_to']) || !empty($row2['telno'])) return '전화상담';
        }

        return '';
    }
}


if (!function_exists('ts_norm_use_time')) {
    function ts_norm_use_time($v)
    {
        $v = trim((string)$v);
        if ($v === '') return '';

        // 1) 전부 숫자면 "초"로 간주
        if (ctype_digit($v)) {
            return gmdate('H시i분s초', (int)$v);
        }

        // 2) 콜론 형태 H:M[:S]
        if (preg_match('/^\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$/', $v, $m)) {
            $h = (int)$m[1];
            $mi = (int)$m[2];
            $s = isset($m[3]) ? (int)$m[3] : 0;
            return sprintf('%02d시%02d분%02d초', $h, $mi, $s);
        }

        // 3) 한글 형태 (예: 0시12분28초, 0시12분)
        if (preg_match_all('/\d+/', $v, $m) && count($m[0]) >= 2) {
            $h = (int)$m[0][0];
            $mi = (int)$m[0][1];
            $s = isset($m[0][2]) ? (int)$m[0][2] : 0;
            return sprintf('%02d시%02d분%02d초', $h, $mi, $s);
        }

        // 4) 그래도 모르겠으면 안전하게 그대로(이스케이프) 표시
        return htmlspecialchars($v, ENT_QUOTES);
    }
}


// 선택옵션으로 인해 셀합치기가 가변적으로 변함
$colspan = 2;
if ($is_checkbox) $colspan++;

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="' . $board_skin_url . '/style.css">', 0);

global $board, $group;
?>

<?php if ($member['mb_level'] == '10') { //권한5: 최고관리자 ?>
    <fieldset id="bo_sch">
        <legend>게시물 검색</legend>
        <form name="fsearch" method="get">
            <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
            <input type="hidden" name="sca" value="<?php echo $sca ?>">
            <input type="hidden" name="sop" value="and">
            <label for="sfl" class="sound_only">검색대상</label>
            <select name="sfl" id="sfl">
                <?php echo get_board_sfl_select_options($sfl); ?>
                <!--<option value="wr_subject||wr_1"<?php echo get_selected($sfl, 'wr_subject||wr_1'); ?>>제목+여분필드1</option>-->
                <option value="wr_1"<?php echo get_selected($sfl, 'wr_1'); ?>>상담사ID</option>
            </select>
            <input name="stx" value="<?php echo stripslashes($stx) ?>" placeholder="검색어를 입력하세요" required id="stx"
                   class="sch_input" size="15" maxlength="20">
            <button type="submit" value="검색" class="sch_btn" style="display:inline-block;"><i class="fa fa-search"
                                                                                              aria-hidden="true"></i>
                <span class="sound_only">검색</span></button>
        </form>
    </fieldset>
<?php } ?>

<form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php"
      onsubmit="return fboardlist_submit(this);" method="post">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
    <input type="hidden" name="stx" value="<?php echo $stx ?>">
    <input type="hidden" name="spt" value="<?php echo $spt ?>">
    <input type="hidden" name="sst" value="<?php echo $sst ?>">
    <input type="hidden" name="sod" value="<?php echo $sod ?>">
    <input type="hidden" name="page" value="<?php echo $page ?>">
    <input type="hidden" name="sw" value="">

    <div class="con_section_03">
        <?php include_once(G5_PATH . '/include/review_title.php'); ?>

        <div class="review_sort" style="">
            <ul class="review_sort_item" style="">
                <span class="review_sort_btn on">최신순</span>
            </ul>
            <ul class="review_sort_photo">
                <input type="checkbox" id="photo_view" name="photo_view" value="Y"
                       <?php if ($photo_view == "Y"){ ?>checked="checked"<?php } ?> onclick="search_enable_idle1();"/>
                <label for="photo_view">사진후기만 보기</label>
            </ul>
        </div>

        <?php if ($member['mb_level'] == '5') { //권한5: 상담사 ?>
            <div class="review_sort" style=" background-color:#f5f5f5;">
                답변을 달아주세요!
                <ul class="review_sort_photo">
                    <input type="checkbox" id="re_counsel" name="re_counsel" value="Y"
                           <?php if ($re_counsel == "Y"){ ?>checked="checked"<?php } ?> onclick="search_no_comment();"/>
                    <label for="re_counsel">답변 없는 후기만 보기</label>
                </ul>
            </div>
        <?php } ?>

        <?php
        $qstr1 = str_replace('&amp;', '&', $qstr);
        ?>

        <script>
            function search_enable_idle1() {
                var qstr = "<?=$qstr1?>";
                if ($('#photo_view').is(':checked') == true) {
                    location.href = '?bo_table=review&photo_view=Y' + qstr;
                } else {
                    location.href = '?bo_table=review' + qstr;
                }
            }

            function search_no_comment() {
                var qstr = "<?=$qstr1?>";
                if ($('#re_counsel').is(':checked') == true) {
                    location.href = '?bo_table=review&re_counsel=Y' + qstr;
                } else {
                    location.href = '?bo_table=review' + qstr;
                }
            }
        </script>

        <?php if ($is_checkbox) { ?>
            <div class="all_chk chk_box">
                <input type="checkbox" id="chkall"
                       onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
                <label for="chkall">
                    <span></span>
                    <b class="sound_only">현재 페이지 게시물 </b> 전체선택
                </label>
                <button type="submit" name="btn_submit" value="선택삭제" class="btn black_bg white"
                        onclick="document.pressed=this.value" style="float:right;"><i class="fa fa-trash-o"
                                                                                      aria-hidden="true"></i> 선택삭제
                </button>
            </div>
        <?php } ?>

        <div id="bo_list_total" style=" color:#000; border-bottom:1px solid #ddd;">
            <span>전체 <?php echo number_format($total_count) ?>건</span>
            / <?php echo $page ?> 페이지
        </div>

        <?php
        $update_href = $delete_href = '';
        set_session('ss_delete_token', $token = uniqid(time()));

        for ($i = 0; $i < count($list); $i++) {

            $sa_info = null; // 루프마다 초기화

            // 로그인중이고 자신의 글이라면 또는 관리자라면 비밀번호를 묻지 않고 바로 수정, 삭제 가능
            if (($member['mb_id'] && ($member['mb_id'] === $list[$i]['mb_id'])) || $is_admin) {
                $update_href = './write.php?w=u&amp;bo_table=' . $bo_table . '&amp;wr_id=' . $list[$i]['wr_id'] . '&amp;page=' . $page . $qstr;
                if ($list[$i]['wr_id']) $delete_href = './delete.php?bo_table=' . $bo_table . '&amp;wr_id=' . $list[$i]['wr_id'] . '&amp;token=' . $token . '&amp;page=' . $page . urldecode($qstr);
            }

            // 글쓴이 정보
            $wmb = get_member($list[$i]["mb_id"]);

            // 상담사 정보 (후기 wr_1을 상담사 ID로 사용)
            $mb = get_member($list[$i]["wr_1"]);

            // 상담정보 있으면 가져오기 (wr_10에 consulting.no 저장된 경우)
            if (!empty($list[$i]["wr_10"])) {
                $sql = "SELECT * FROM platform_consulting WHERE no='" . addslashes($list[$i]["wr_10"]) . "'";
                $rst = sql_query($sql);
                if ($rst) {
                    $sa_info = sql_fetch_array($rst);
                }
            }

            // 상담사 프로필
            $sql = "SELECT * FROM g5_write_counselor WHERE mb_id='" . addslashes($mb["mb_id"]) . "'";
            $crow = sql_fetch($sql);
            if (!is_array($crow)) $crow = [];
            $crow_wr_id = isset($crow['wr_id']) ? (int)$crow['wr_id'] : 0;
            $crow_ca_name = isset($crow['ca_name']) ? $crow['ca_name'] : '';
            $crow_mb_id = isset($crow['mb_id']) ? $crow['mb_id'] : '';

            $thumb1 = get_list_thumbnail('counselor', $crow_wr_id, '48', '48', false, true);
            $img = $thumb1['src'] ? $thumb1['src'] : G5_IMG_URL . '/no_img.png';
            ?>

            <div class="review_wrap">
                <?php if (!$list[$i]['reply']) { ?>
                    <ul class="review_user counsel_info">
                        <?php if ($is_checkbox) { ?>
                            <div class="bo_chk chk_box">
                                <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>"
                                       id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                                <label for="chk_wr_id_<?php echo $i ?>">
                                    <span></span>
                                    <b class="sound_only">
                                        <?php
                                        if (!$list[$i]['icon_secret']) {
                                            echo $list[$i]['subject'];
                                        } else {
                                            if ($list[$i]['mb_id'] == $member["mb_id"] || $is_admin || $list[$i]["wr_1"] == $member["mb_id"]) {
                                                echo $list[$i]['subject'];
                                            } else {
                                                echo "비밀글 입니다.";
                                            }
                                        }
                                        ?>
                                    </b>
                                </label>
                            </div>
                        <?php } ?>
                        <a href="../bbs/board.php?bo_table=counselor&wr_id=<?= $crow_wr_id ?>">
                            <li class="review_user_img type_bg tarot">
                                <p class="review_user_img_item" style=" background-image:url(<?= $img ?>);"></p>
                            </li>
                        </a>

                        <li class="review_user_score">
                            <a href="../bbs/board.php?bo_table=counselor&wr_id=<?= $crow_wr_id ?>">
                                <p class="review_user_id">
                                    <span class="cate point"><?= htmlspecialchars($crow_ca_name, ENT_QUOTES) ?></span>
                                    <?= $mb["mb_nick"] ?>
                                    <!-- 상담사 고유번호 -->
                                    <?php include(G5_PATH . '/include/counselor_num.php'); ?>
                                </p>
                            </a>
                            <!-- 신고/차단 -->
                            <?php include(G5_PATH . '/include/singo_wrap.php'); ?>
                        </li>
                    </ul>

                    <!-- 작성자 정보 -->
                    <ul class="review_user">
                        <li class="review_user_score">
                            <p class="review_user_id"><?php echo preg_replace("/(^.)./u", "$1*", $list[$i]['wr_name']); ?>
                                <img src="../img/common/icon_mem_ok.png"/></p>
                        </li>

                        <li class="review_user_score">
                            <?php
                            // 상담사 ID 폴백: mb_id > crow.mb_id > sa_info.csrid > wr_1
                            $counselor_id  = $mb['mb_id']
                                ?? ($crow_mb_id
                                    ?? ($sa_info['csrid'] ?? ($list[$i]['wr_1'] ?? '')));

                            // 채널 라벨
                            $consult_label = ts_get_consult_label(
                                $list[$i],
                                $counselor_id,
                                (isset($sa_info) && is_array($sa_info)) ? $sa_info : null
                            );

                            // 기본값 강제: consult_label이 없으면 '전화상담'
                            if ($consult_label === '' || $consult_label === null) {
                                $consult_label = '전화상담';
                            }

                            // 사용시간 표기: wr_2 > sa_info.usetm > 기본값
                            $wr2_raw = isset($list[$i]['wr_2']) ? trim((string)$list[$i]['wr_2']) : '';
                            if ($wr2_raw !== '') {
                                $use_tm_txt = ts_norm_use_time($wr2_raw); // 헬퍼 사용
                            } elseif (isset($sa_info['usetm']) && (int)$sa_info['usetm'] > 0) {
                                $use_tm_txt = gmdate('H시i분s초', (int)$sa_info['usetm']);
                            } else {
                                $use_tm_txt = '00시12분28초';
                            }
                            ?>
                            <span class="review_info"><?= $consult_label ?></span>
                            <span class="review_info"><?= $use_tm_txt ?></span>
                            <span class="review_info"><?php echo $list[$i]['datetime'] ?></span>
                        </li>
                    </ul>

                    <!-- 후기 내용 -->
                    <ul class="review_con">
                        <a href="<?php echo $list[$i]['href'] ?>">
                            <li class="review_con_text">
                                <div class="review_text">
                                    <ul class="review_title">
                                        <?php if (isset($list[$i]['icon_secret'])) echo rtrim($list[$i]['icon_secret']) . "&nbsp;"; ?>
                                        <?php
                                        if (!$list[$i]['icon_secret']) {
                                            echo $list[$i]['subject'];
                                        } else {
                                            if ($list[$i]['mb_id'] == $member["mb_id"] || $is_admin || $list[$i]["wr_1"] == $member["mb_id"]) {
                                                echo $list[$i]['subject'];
                                            } else {
                                                echo "비밀글 입니다.";
                                            }
                                        }
                                        ?>
                                    </ul>

                                    <ul class="review_txt">
                                        <?php
                                        if (!$list[$i]['icon_secret']) {
                                            echo strip_tags($list[$i]['wr_content']);
                                        } else {
                                            if ($list[$i]['mb_id'] == $member["mb_id"] || $is_admin || $list[$i]["wr_1"] == $member["mb_id"]) {
                                                echo strip_tags($list[$i]['wr_content']);
                                            } else {
                                                echo "비밀글 입니다.";
                                            }
                                        }
                                        ?>
                                    </ul>
                                </div>

                                <!-- 후기사진 -->
                                <?php
                                $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);
                                if ($thumb['src']) {
                                    $img_content = '<p class="review_photo"><img src="' . $thumb['ori'] . '" alt="' . $thumb['alt'] . '" ></p>';
                                } else {
                                    $img_content = '';
                                }
                                if (empty($list[$i]["sing_flag"])) {
                                    echo "<a href=" . $list[$i]['href'] . ">" . run_replace('thumb_image_tag', $img_content, $thumb) . "</a>";
                                }
                                ?>
                            </li>
                        </a>
                    </ul>

                    <ul class="review_con" style="min-height:0;">
                        <li class="review_con_text">
                            <div class="review_text">
                                <ul>
                                    <span class="review_topic">상담주제: <?= htmlspecialchars($crow_ca_name, ENT_QUOTES) ?></span>
                                    <span class="review_list_btn_wrap">
                        <?php if ($update_href) { ?><a class=" black_bo black review_list_btn"
                                                       href="<?php echo $update_href ?>&csr_id=<?= $mb["mb_id"] ?>">
                                수정</a><?php } ?>
                                        <?php if ($delete_href) { ?><a class=" point_bo point review_list_btn"
                                                                       href="<?php echo $delete_href ?>"
                                                                       onclick="del(this.href); return false;">
                                                삭제</a><?php } ?>
                    </span>
                                </ul>
                            </div>
                        </li>
                    </ul>
                <?php } // !$list[$i]['reply'] ?>

                <?php
                // 댓글(상담사 답변 등) 표시
                $sql1 = " SELECT * 
            FROM g5_write_review 
           WHERE wr_parent = '" . intval($list[$i]["wr_id"]) . "' 
             AND wr_is_comment = 1 
        ORDER BY wr_comment, wr_comment_reply ";
                $result1 = sql_query($sql1);
                for ($j = 0; $row1 = sql_fetch_array($result1); $j++) {
                    $wwmb = get_member($row1["mb_id"]);
                    $row1['datetime'] = substr($row1['wr_datetime'], 2, 14);
                    $row1['content'] = conv_content($row1['wr_content'], 0, 'wr_content');
                    if (!$is_admin)
                        $row1['ip'] = preg_replace("/([0-9]+).([0-9]+).([0-9]+).([0-9]+)/", G5_IP_DISPLAY, $row1['wr_ip']);
                    ?>
                    <a href="<?php echo $list[$i]['href'] ?>">
                        <ul class="review_user counsel">
                            <li class="review_re_name"><?= $wwmb["mb_nick"] ?><span class="re_date"
                                                                                    style=""><?= substr($row1["wr_datetime"], 0, 10); ?></span>
                            </li>
                            <li class="review_re_con">
                                <?php
                                if (!$list[$i]['icon_secret']) {
                                    echo nl2br($row1['content']);
                                } else {
                                    if ($list[$i]['mb_id'] == $member["mb_id"] || $is_admin || $list[$i]["wr_1"] == $member["mb_id"]) {
                                        echo nl2br($row1['content']);
                                    } else {
                                        echo "비밀글 입니다.";
                                    }
                                }
                                ?>
                            </li>
                        </ul>
                    </a>
                <?php } // for comments ?>
            </div> <!-- .review_wrap -->

        <?php } // for ($i...) ?>

        <?php if (count($list) == 0) {
            echo '<div class="empty_table">작성된 후기가 없습니다.</div>';
        } ?>
    </div>

    <!-- 게시판 목록 시작 -->
    <div id="bo_list"></div>
</form>

<?php if ($is_checkbox) { ?>
    <noscript>
        <p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
    </noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>

<?php if ($is_checkbox) { ?>
    <script>
        function all_checked(sw) {
            var f = document.fboardlist;
            for (var i = 0; i < f.length; i++) {
                if (f.elements[i].name == "chk_wr_id[]")
                    f.elements[i].checked = sw;
            }
        }

        function fboardlist_submit(f) {
            var chk_count = 0;
            for (var i = 0; i < f.length; i++) {
                if (f.elements[i].name == "chk_wr_id[]" && f.elements[i].checked)
                    chk_count++;
            }
            if (!chk_count) {
                alert(document.pressed + "할 게시물을 하나 이상 선택하세요.");
                return false;
            }
            if (document.pressed == "선택복사") {
                select_copy("copy");
                return;
            }
            if (document.pressed == "선택이동") {
                select_copy("move");
                return;
            }
            if (document.pressed == "선택삭제") {
                if (!confirm("선택한 게시물을 정말 삭제하시겠습니까?\n\n한번 삭제한 자료는 복구할 수 없습니다\n\n답변글이 있는 게시글을 선택하신 경우\n답변글도 선택하셔야 게시글이 삭제됩니다."))
                    return false;
                f.removeAttribute("target");
                f.action = g5_bbs_url + "/board_list_update.php";
            }
            return true;
        }

        function select_copy(sw) {
            var f = document.fboardlist;
            var sub_win = window.open("", "move", "left=50, top=50, width=500, height=550, scrollbars=1");
            f.sw.value = sw;
            f.target = "move";
            f.action = g5_bbs_url + "/move.php";
            f.submit();
        }

        jQuery(function ($) {
            $(".btn_more_opt.is_list_btn").on("click", function (e) {
                e.stopPropagation();
                $(".more_opt.is_list_btn").toggle();
            });
            $(document).on("click", function (e) {
                if (!$(e.target).closest('.is_list_btn').length) {
                    $(".more_opt.is_list_btn").hide();
                }
            });
        });
    </script>
<?php } ?>
<!-- 게시판 목록 끝 -->
