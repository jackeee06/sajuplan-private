<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$latest_skin_url.'/style.css">', 0);

$thumb_width  = 210;
$thumb_height = 150;
$list_count   = (is_array($list) && $list) ? count($list) : 0;

// 카테고리별 배경이미지 Class (사용하지 않지만 남겨둠)
$cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');

// 상담사별 후기수
$rct = sql_fetch("select count(*) as ct from g5_write_review where wr_1='".sql_real_escape_string($csr_id)."' and wr_is_comment='0'");

// -----------------------------
// ★ 유틸: 상담시간 정규화
// -----------------------------
if (!function_exists('ts_norm_use_time')) {
    function ts_norm_use_time($raw) {
        $raw = trim((string)$raw);
        if ($raw === '') return '';
        // 숫자(초) -> H시i분s초
        if (ctype_digit($raw)) {
            return gmdate('H시i분s초', (int)$raw);
        }
        // H:i:s -> H시i분s초
        if (preg_match('/^\d{1,2}:\d{2}:\d{2}$/', $raw)) {
            list($h,$i,$s) = explode(':', $raw);
            return sprintf('%02d시%02d분%02d초', $h, $i, $s);
        }
        // 이미 "시/분/초"가 포함되면 그대로
        if (strpos($raw, '시') !== false || strpos($raw, '분') !== false || strpos($raw, '초') !== false) {
            return $raw;
        }
        // 그 외 텍스트는 그대로(출력 시 이스케이프)
        return $raw;
    }
}

// -----------------------------
// ★ 유틸: 상담채널 라벨 (wr_3 > sa_info > 기본: 전화상담)
// -----------------------------
if (!function_exists('ts_pick_consult_label')) {
    function ts_pick_consult_label(array $row, array $sa_info = null) {
        // 1) wr_3 최우선
        $wr3 = isset($row['wr_3']) ? trim((string)$row['wr_3']) : '';
        if ($wr3 !== '') {
            $norm  = preg_replace('/[()\s_-]|상담/u', '', $wr3); // 괄호/공백/‘상담’ 제거
            $normU = strtoupper($norm);
            if (in_array($normU, ['CALL','TEL','PHONE']) || $norm === '전화') return '전화상담';
            if (in_array($normU, ['CHAT']) || $norm === '채팅')           return '채팅상담';
        }
        // 2) 상담 로그 단서
        if (is_array($sa_info) && $sa_info) {
            if (!empty($sa_info['roomid'])) return '채팅상담';
            if (!empty($sa_info['to']) || !empty($sa_info['telno'])) return '전화상담';
            if (!empty($sa_info['reason']) && $sa_info['reason'] === 'END_CHAT') return '채팅상담';
        }
        // 3) 기본
        return '전화상담';
    }
}
?>

<div class="review_sort">
    <ul class="review_sort_item">
        <h2 class="bo_vc_tit">상담 후기 <span class="point"><?=number_format((int)$rct["ct"])?></span>건</h2>
    </ul>
</div>

<div class="pic_lt">
    <ul>
        <?php for ($i=0; $i<$list_count; $i++):
            // 글쓴이/상담사
            $wmb = get_member($list[$i]["mb_id"]);
            $mb  = get_member($list[$i]["wr_1"]);

            // 상담 로그(sa_info): wr_10이 있을 때만 직접 매핑
            $sa_info = array();
            if (!empty($list[$i]["wr_10"])) {
                $no  = sql_real_escape_string($list[$i]["wr_10"]);
                $rst = sql_query("SELECT * FROM platform_consulting WHERE no='{$no}'");
                if ($rst) $sa_info = sql_fetch_array($rst);
            }

            // 상담 유형 뱃지 (★ wr_3 > sa_info > 기본 전화)
            $consult_label = ts_pick_consult_label($list[$i], $sa_info);
            $badge_class   = 'review_info' . ($consult_label === '채팅상담' ? ' chat' : ' call');

            // 상담사 대표글/카테고리(카테고리는 출력 안 함)
            $crow = array('wr_id'=>0,'ca_name'=>'');
            if (!empty($mb["mb_id"])) {
                $crow = sql_fetch("select wr_id, ca_name from g5_write_counselor where mb_id='".sql_real_escape_string($mb["mb_id"])."' order by wr_num asc limit 1");
                if (!$crow) $crow = array('wr_id'=>0,'ca_name'=>'');
            }

            // 썸네일
            $img = G5_IMG_URL.'/no_img.png';
            if (!empty($crow['wr_id'])) {
                $thumb1 = get_list_thumbnail('counselor', $crow['wr_id'], 48, 48, false, true);
                if (!empty($thumb1['src'])) $img = $thumb1['src'];
            }

            // 작성자 마스킹
            $masked_name = preg_replace("/(^.)./u", "$1*", $list[$i]['wr_name']);

            // 상담시간 (★ wr_2 > sa_info.usetm > 기본)
            if (!empty($list[$i]['wr_2'])) {
                $disp_time_raw = ts_norm_use_time($list[$i]['wr_2']);
            } elseif (isset($sa_info['usetm']) && (int)$sa_info['usetm'] > 0) {
                $disp_time_raw = gmdate('H시i분s초', (int)$sa_info['usetm']);
            } else {
                $disp_time_raw = '00시12분28초';
            }
            $disp_time = htmlspecialchars($disp_time_raw, ENT_QUOTES);

            // 일자
            $date_text = $list[$i]['datetime'];
            ?>
            <div class="review_wrap">
                <ul class="review_user counsel_info">
                    <?php if ($is_checkbox) { ?>
                        <div class="bo_chk chk_box">
                            <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                            <label for="chk_wr_id_<?php echo $i ?>">
                                <span></span>
                                <b class="sound_only">
                                    <?php
                                    if(!$list[$i]['icon_secret']){
                                        echo $list[$i]['subject'];
                                    } else {
                                        if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
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

                    <!-- 상담사 프로필 이미지 -->
                    <li class="review_user_img type_bg tarot">
                        <a href="../bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                            <p class="review_user_img_item" style="background-image:url('<?=$img?>');"></p>
                        </a>
                    </li>

                    <li class="review_user_score">
                        <a href="../bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                            <p class="review_user_id">
                                <span class="cate point"><?=$crow["ca_name"]?></span>
                                <?=htmlspecialchars($mb["mb_nick"] ?? '', ENT_QUOTES)?>
                            </p>
                        </a>
                        <!-- 신고/차단 -->
                        <?php include(G5_PATH.'/include/singo_wrap.php'); ?>
                    </li>
                </ul>

                <!-- 작성자/상담 정보 -->
                <ul class="review_user">
                    <li class="review_user_score">
                        <p class="review_user_id"><?=$masked_name?> <img src="../img/common/icon_mem_ok.png" /></p>
                    </li>
                    <li class="review_user_score">
                        <!-- ★ 라벨: consult_label 없으면 기본 전화상담(유틸에서 이미 기본 처리) -->
                        <span class="<?=$badge_class?>"><?=htmlspecialchars($consult_label, ENT_QUOTES)?></span>
                        <span class="review_info">상담시간 <?=$disp_time?></span>
                        <span class="review_info"><?=htmlspecialchars($date_text, ENT_QUOTES)?></span>
                    </li>
                </ul>

                <!-- 후기 내용 -->
                <ul class="review_con">
                    <a href="<?php echo $list[$i]['href'] ?>">
                        <li class="review_con_text">
                            <p class="review_text">
                            <span class="review_title">
                                <?php if (isset($list[$i]['icon_secret'])) echo rtrim($list[$i]['icon_secret'])."&nbsp;"; ?>
                                <?php
                                if(!$list[$i]['icon_secret']){
                                    echo $list[$i]['subject'];
                                } else {
                                    if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
                                        echo $list[$i]['subject'];
                                    } else {
                                        echo "비밀글 입니다.";
                                    }
                                }
                                ?>
                            </span>
                                <span class="review_txt">
                                <?php
                                if(!$list[$i]['icon_secret']){
                                    echo strip_tags($list[$i]['wr_content']);
                                } else {
                                    if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
                                        echo strip_tags($list[$i]['wr_content']);
                                    } else {
                                        echo "비밀글 입니다.";
                                    }
                                }
                                ?>
                            </span>
                            </p>

                            <!-- 후기사진 -->
                            <?php
                            $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);
                            if($thumb['src']) {
                                $img_content = '<p class="review_photo"><a href="'.$list[$i]['href'].'"><img src="'.$thumb['ori'].'" alt="'.$thumb['alt'].'"></a></p>';
                            } else {
                                $img_content = '';
                            }
                            echo run_replace('thumb_image_tag', $img_content, $thumb);
                            ?>
                        </li>
                    </a>
                </ul>

                <?php
                // 댓글(상담사 답변 등)
                $sql1 = " select * from g5_write_review
                      where wr_parent = '".intval($list[$i]["wr_id"])."'
                        and wr_is_comment = 1
                      order by wr_comment, wr_comment_reply ";
                $result1 = sql_query($sql1);
                for ($j=0; $row1=sql_fetch_array($result1); $j++):
                    $wwmb = get_member($row1["mb_id"]);
                    $row1['content'] = conv_content($row1['wr_content'], 0, 'wr_content');
                    if (!$is_admin)
                        $row1['ip'] = preg_replace("/([0-9]+).([0-9]+).([0-9]+).([0-9]+)/", G5_IP_DISPLAY, $row1['wr_ip']);
                    ?>
                    <a href="<?php echo $list[$i]['href'] ?>">
                        <ul class="review_user counsel">
                            <li class="review_re_name"><?=htmlspecialchars($wwmb["mb_nick"] ?? '', ENT_QUOTES)?><span class="re_date"><?=substr($row1["wr_datetime"],0,10);?></span></li>
                            <li class="review_re_con">
                                <?php
                                if(!$list[$i]['icon_secret']){
                                    echo nl2br($row1['content']);
                                } else {
                                    if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
                                        echo nl2br($row1['content']);
                                    } else {
                                        echo "비밀글 입니다.";
                                    }
                                }
                                ?>
                            </li>
                        </ul>
                    </a>
                <?php endfor; ?>
            </div>
        <?php endfor; ?>

        <?php if ($list_count == 0) { ?>
            <li class="empty_li">게시물이 없습니다.</li>
        <?php } ?>
    </ul>
</div>
