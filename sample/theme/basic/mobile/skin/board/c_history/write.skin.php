
<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);


$no = $_REQUEST["no"];

$md = $_REQUEST["md"];

if($no){

	$sql = "select * from platform_consulting where no='".$no."'";
	$vrow = sql_fetch($sql);

	if($vrow["membid"]){
		$minfo = get_mbid($vrow["membid"]);
	}

	if($vrow["membid"]){
		$cinfo = get_csrid($vrow["csrid"]);
	}

}

?>

<style>
/* ===== 상담 기록 작성 ===== */
#bo_w {
    padding: 0 0 40px;
    background: #f9f9fb;
    min-height: 100vh;
}

/* 상단 헤더 */
.cw_header {
    background: #8259f5;
    padding: 18px 20px;
}
.cw_header_inner {
    display: flex;
    align-items: center;
    gap: 10px;
}
.cw_header_icon {
    display: none;
}
.cw_header h2 {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    margin: 0;
}
.cw_header p {
    font-size: 12px;
    color: rgba(255,255,255,0.8);
    margin: 2px 0 0;
}

/* 폼 전체 컨테이너 */
.cw_body {
    padding: 16px 16px 0;
}

/* 섹션 공통 카드 */
.cw_card {
    background: #fff;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid #eee;
}
.cw_card_label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #555;
    margin-bottom: 12px;
}
.cw_card_label span.dot {
    width: 5px; height: 5px;
    background: #8259f5;
    border-radius: 50%;
    display: inline-block;
}

/* 상담정보 카드 - 2x2 그리드 */
.cw_info_grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.cw_info_item {
    background: #fafafa;
    border-radius: 8px;
    padding: 10px 12px;
    border: 1px solid #eee;
}
.cw_info_item .info_key {
    font-size: 11px;
    color: #999;
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.cw_info_item .info_key svg {
    width: 12px; height: 12px;
    opacity: 0.5;
}
.cw_info_item .info_val {
    font-size: 14px;
    color: #333;
    font-weight: 700;
    word-break: break-all;
}
.cw_info_item.time .info_val {
    font-size: 12px;
    font-weight: 600;
    color: #666;
}

/* 상담분류 라디오 */
.cw_type_toggle {
    display: flex;
    gap: 12px;
}
.cw_type_btn {
    position: relative;
    cursor: pointer;
}
.cw_type_btn input[type="radio"] {
    display: none;
}
.cw_type_btn label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: 2px solid #ddd;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.2s;
    background: #fff;
}
.cw_type_btn label .type_icon {
    font-size: 13px;
    line-height: 1;
}
.cw_type_btn label .type_name {
    font-size: 14px;
    font-weight: 600;
    color: #888;
}
.cw_type_btn label .type_desc {
    display: none;
}
.cw_type_btn input[type="radio"]:checked + label {
    border-color: #8259f5;
    background: #8259f5;
}
.cw_type_btn input[type="radio"]:checked + label .type_name {
    color: #fff;
}

/* 상담주제 커스텀 셀렉트 */
.cw_select_wrap {
    position: relative;
}
.cw_select_wrap::after {
    content: '';
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #aaa;
    pointer-events: none;
}
.cw_select {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    background: #fafafa;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    padding: 12px 40px 12px 14px;
    font-size: 14px;
    color: #333;
    font-weight: 500;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
}
.cw_select:focus {
    border-color: #8259f5;
    background: #fff;
}
.cw_select option[value=""] {
    color: #aaa;
}

/* 상담주제 토글 */
.cw_topic_toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.cw_topic_btn input[type="radio"] {
    display: none;
}
.cw_topic_btn label {
    display: inline-block;
    padding: 7px 14px;
    border: 1.5px solid #ddd;
    border-radius: 50px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: #888;
    background: #fff;
    transition: all 0.2s;
    white-space: nowrap;
}
.cw_topic_btn label:active {
    transform: scale(0.96);
}
.cw_topic_btn input[type="radio"]:checked + label {
    border-color: #8259f5;
    background: #8259f5;
    color: #fff;
}

/* 내용 입력 */
.cw_textarea_wrap {
    position: relative;
}
.cw_textarea {
    width: 100%;
    min-height: 130px;
    background: #fafafa;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 14px;
    color: #333;
    line-height: 1.7;
    resize: none;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    font-family: inherit;
}
.cw_textarea:focus {
    border-color: #8259f5;
    background: #fff;
}
.cw_textarea::placeholder {
    color: #bbb;
    font-size: 13px;
}
.cw_char_count {
    text-align: right;
    font-size: 12px;
    color: #aaa;
    margin-top: 6px;
}
.cw_char_count span {
    color: #8259f5;
    font-weight: 700;
}

/* 제출 버튼 */
.cw_submit_wrap {
    padding: 6px 16px 20px;
}
.cw_submit_btn {
    width: 100%;
    padding: 15px;
    background: #8259f5;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s;
}
.cw_submit_btn:active {
    background: #6b3fe4;
}
.cw_submit_btn:disabled {
    background: #ccc;
}
.cw_submit_btn svg {
    width: 18px; height: 18px;
}

/* 숨김 처리 */
.sound_only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
}
</style>

<section id="bo_w">
    <!-- 상단 헤더 -->
    <div class="cw_header">
        <div class="cw_header_inner">
            <div class="cw_header_icon">📋</div>
            <div>
                <h2>상담 내역 작성</h2>
                <p>상담 내용을 정확하게 기록해 주세요</p>
            </div>
        </div>
    </div>

    <form name="fwrite" id="fwrite" action="<?php echo $action_url ?>" onsubmit="return fwrite_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off">
    <input type="hidden" name="w" value="<?php echo $w ?>">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="wr_id" value="<?php echo $wr_id ?>">
    <input type="hidden" name="sca" value="<?php echo $sca ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
    <input type="hidden" name="stx" value="<?php echo $stx ?>">
    <input type="hidden" name="spt" value="<?php echo $spt ?>">
    <input type="hidden" name="sst" value="<?php echo $sst ?>">
    <input type="hidden" name="sod" value="<?php echo $sod ?>">
    <input type="hidden" name="page" value="<?php echo $page ?>">
    <input type="hidden" name="wr_subject" value="상담완료">
    <input type="hidden" name="wr_10" value="<?=$no?>">
    <input type="hidden" name="md" value="<?=$md?>">

    <?php
    $option = '';
    $option_hidden = '';
    if ($is_notice || $is_html || $is_secret || $is_mail) { 
        $option = '';
        if ($is_notice) {
            $option .= PHP_EOL.'<li class="chk_box"><input type="checkbox" id="notice" name="notice"  class="selec_chk" value="1" '.$notice_checked.'>'.PHP_EOL.'<label for="notice"><span></span>공지</label></li>';
        }
        if ($is_html) {
            if ($is_dhtml_editor) {
                $option_hidden .= '<input type="hidden" value="html1" name="html">';
            } else {
                $option .= PHP_EOL.'<li class="chk_box"><input type="checkbox" id="html" name="html" onclick="html_auto_br(this);" class="selec_chk" value="'.$html_value.'" '.$html_checked.'>'.PHP_EOL.'<label for="html"><span></span>html</label></li>';
            }
        }
        if ($is_secret) {
            if ($is_admin || $is_secret==1) {
                $option .= PHP_EOL.'<li class="chk_box"><input type="checkbox" id="secret" name="secret"  class="selec_chk" value="secret" '.$secret_checked.'>'.PHP_EOL.'<label for="secret"><span></span>비밀글</label></li>';
            } else {
                $option_hidden .= '<input type="hidden" name="secret" value="secret">';
            }
        }
        if ($is_mail) {
            $option .= PHP_EOL.'<li class="chk_box"><input type="checkbox" id="mail" name="mail"  class="selec_chk" value="mail" '.$recv_email_checked.'>'.PHP_EOL.'<label for="mail"><span></span>답변메일받기</label></li>';
        }
    }
    echo $option_hidden;
    ?>

    <div class="cw_body">

        <h2 class="sound_only"><?php echo $g5['title'] ?></h2>

        <?php if ($is_category) { ?>
        <div class="cw_card">
            <div class="cw_card_label"><span class="dot"></span>분류</div>
            <div class="cw_select_wrap">
                <select class="cw_select" id="ca_name" name="ca_name" required>
                    <option value="">선택하세요</option>
                    <?php echo $category_option ?>
                </select>
            </div>
        </div>
        <?php } ?>

        <?php if ($is_name) { ?>
        <div class="cw_card">
            <div class="cw_select_wrap">
                <input type="text" name="wr_name" value="<?php echo $name ?>" id="wr_name" required class="cw_select" maxlength="20" placeholder="이름">
            </div>
        </div>
        <?php } ?>

        <?php if ($is_password) { ?>
        <div class="cw_card">
            <input type="password" name="wr_password" id="wr_password" <?php echo $password_required ?> class="cw_select" maxlength="20" placeholder="비밀번호">
        </div>
        <?php } ?>

        <?php if ($is_email) { ?>
        <div class="cw_card">
            <input type="email" name="wr_email" value="<?php echo $email ?>" id="wr_email" class="cw_select" maxlength="100" placeholder="이메일">
        </div>
        <?php } ?>

        <?php if ($is_homepage) { ?>
        <div class="cw_card">
            <input type="text" name="wr_homepage" value="<?php echo $homepage ?>" id="wr_homepage" class="cw_select" placeholder="홈페이지">
        </div>
        <?php } ?>

        <!-- 상담정보 카드 -->
        <div class="cw_card">
            <div class="cw_card_label"><span class="dot"></span>상담정보</div>
            <div class="cw_info_grid">
                <div class="cw_info_item">
                    <div class="info_key">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9b5de5" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        상담사
                    </div>
                    <div class="info_val"><?=htmlspecialchars($cinfo["mb_nick"] ?? '-')?></div>
                </div>
                <div class="cw_info_item">
                    <div class="info_key">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9b5de5" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        고객명
                    </div>
                    <div class="info_val"><?=htmlspecialchars($minfo["mb_name"] ?? '-')?></div>
                </div>
                <div class="cw_info_item time">
                    <div class="info_key">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9b5de5" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                        상담시작
                    </div>
                    <div class="info_val"><?=htmlspecialchars($vrow["start"] ?? '-')?></div>
                </div>
                <div class="cw_info_item time">
                    <div class="info_key">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9b5de5" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                        상담종료
                    </div>
                    <div class="info_val"><?=htmlspecialchars($vrow["end"] ?? '-')?></div>
                </div>
            </div>
        </div>

        <!-- 상담분류 토글 카드 -->
        <div class="cw_card" style="display:flex; align-items:center; gap:12px; flex-wrap:nowrap;">
            <div class="cw_card_label" style="margin-bottom:0; white-space:nowrap; flex-shrink:0;">
                <span class="dot"></span>상담분류 <span style="color:#e05ec0;margin-left:2px;">*</span>
            </div>
            <input type="hidden" name="wr_1" id="wr_1_hidden" value="<?php echo htmlspecialchars($write['wr_1'] ?? ''); ?>">
            <div class="cw_type_toggle" style="flex:1;">
                <div class="cw_type_btn">
                    <input type="radio" name="wr_1_ui" id="type_phone" value="전화상담" <?php echo (($write['wr_1'] ?? '') == "전화상담") ? "checked" : ""; ?>>
                    <label for="type_phone">
                        <span class="type_icon">📞</span>
                        <span class="type_name">전화상담</span>
                        <span class="type_desc">음성 통화 상담</span>
                    </label>
                </div>
                <div class="cw_type_btn">
                    <input type="radio" name="wr_1_ui" id="type_chat" value="채팅상담" <?php echo (($write['wr_1'] ?? '') == "채팅상담") ? "checked" : ""; ?>>
                    <label for="type_chat">
                        <span class="type_icon">💬</span>
                        <span class="type_name">채팅상담</span>
                        <span class="type_desc">텍스트 채팅 상담</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- 상담주제 -->
        <div class="cw_card">
            <div class="cw_card_label"><span class="dot"></span>상담주제 <span style="color:#e05ec0;margin-left:2px;">*</span></div>
            <input type="hidden" name="wr_2" id="wr_2_hidden" value="<?php echo htmlspecialchars($write['wr_2'] ?? ''); ?>">
            <div class="cw_topic_toggle">
                <?php
                $topics = ['운세','속마음','연애','짝사랑','재회','궁합','금전','건강','취업','합격','사업','택일','이사','작명/개명','불륜/이혼','삼재','고민','꿈해몽','기타'];
                foreach($topics as $i => $t) {
                    $chk = (($write['wr_2'] ?? '') == $t) ? ' checked' : '';
                ?>
                <div class="cw_topic_btn">
                    <input type="radio" name="wr_2_ui" id="topic_<?=$i?>" value="<?=$t?>"<?=$chk?>>
                    <label for="topic_<?=$i?>"><?=$t?></label>
                </div>
                <?php } ?>
            </div>
        </div>

        <!-- 내용 입력 -->
        <div class="cw_card">
            <div class="cw_card_label"><span class="dot"></span>상담 특이사항</div>
            <label for="wr_content" class="sound_only">내용<strong>필수</strong></label>
            <?php if($write_min || $write_max) { ?>
            <p style="font-size:12px;color:#b0a0cc;margin:0 0 10px;">최소 <strong style="color:#9b5de5;"><?php echo $write_min; ?></strong>자 이상 · 최대 <strong style="color:#9b5de5;"><?php echo $write_max; ?></strong>자 이하</p>
            <?php } ?>
            <div class="cw_textarea_wrap">
                <?php echo $editor_html; ?>
            </div>
            <?php if($write_min || $write_max) { ?>
            <div class="cw_char_count"><span id="char_count">0</span>글자</div>
            <?php } ?>
        </div>

        <?php if ($is_use_captcha) { ?>
        <div class="cw_card">
            <span class="sound_only">자동등록방지</span>
            <?php echo $captcha_html ?>
        </div>
        <?php } ?>

    </div><!-- /cw_body -->

    <div class="cw_submit_wrap">
        <button type="submit" id="btn_submit" class="cw_submit_btn" accesskey="s">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            상담 기록 저장
        </button>
    </div>

    </form>
</section>

<script>
<?php if($write_min || $write_max) { ?>
var char_min = parseInt(<?php echo $write_min; ?>);
var char_max = parseInt(<?php echo $write_max; ?>);
check_byte("wr_content", "char_count");

$(function() {
    $("#wr_content").on("keyup", function() {
        check_byte("wr_content", "char_count");
    });
});
<?php } ?>

// 상담분류 라디오 → hidden input 동기화
$(function() {
    $('input[name="wr_1_ui"]').on('change', function() {
        $('#wr_1_hidden').val($(this).val());
    });
    var initVal = $('input[name="wr_1_ui"]:checked').val();
    if (initVal) $('#wr_1_hidden').val(initVal);

    // 상담주제 라디오 → hidden input 동기화
    $('input[name="wr_2_ui"]').on('change', function() {
        $('#wr_2_hidden').val($(this).val());
    });
    var initTopic = $('input[name="wr_2_ui"]:checked').val();
    if (initTopic) $('#wr_2_hidden').val(initTopic);
});

function html_auto_br(obj)
{
    if (obj.checked) {
        result = confirm("자동 줄바꿈을 하시겠습니까?\n\n자동 줄바꿈은 게시물 내용중 줄바뀐 곳을<br>태그로 변환하는 기능입니다.");
        if (result)
            obj.value = "html2";
        else
            obj.value = "html1";
    }
    else
        obj.value = "";
}

function fwrite_submit(f)
{
    <?php echo $editor_js; ?>

    // 상담분류 검증
    if (!$('#wr_1_hidden').val()) {
        alert("상담분류를 선택해 주세요.");
        return false;
    }
    f.wr_1.value = $('#wr_1_hidden').val();

    // 상담주제 검증
    if (!$('#wr_2_hidden').val()) {
        alert("상담주제를 선택해 주세요.");
        return false;
    }
    f.wr_2.value = $('#wr_2_hidden').val();

    var subject = "";
    var content = "";
    $.ajax({
        url: g5_bbs_url+"/ajax.filter.php",
        type: "POST",
        data: {
            "subject": f.wr_subject.value,
            "content": f.wr_content.value
        },
        dataType: "json",
        async: false,
        cache: false,
        success: function(data, textStatus) {
            subject = data.subject;
            content = data.content;
        }
    });

    if (subject) {
        alert("제목에 금지단어('"+subject+"')가 포함되어있습니다");
        f.wr_subject.focus();
        return false;
    }

    if (content) {
        alert("내용에 금지단어('"+content+"')가 포함되어있습니다");
        if (typeof(ed_wr_content) != "undefined")
            ed_wr_content.returnFalse();
        else
            f.wr_content.focus();
        return false;
    }

    if (document.getElementById("char_count")) {
        if (char_min > 0 || char_max > 0) {
            var cnt = parseInt(check_byte("wr_content", "char_count"));
            if (char_min > 0 && char_min > cnt) {
                alert("내용은 "+char_min+"글자 이상 쓰셔야 합니다.");
                return false;
            }
            else if (char_max > 0 && char_max < cnt) {
                alert("내용은 "+char_max+"글자 이하로 쓰셔야 합니다.");
                return false;
            }
        }
    }

    <?php echo $captcha_js; ?>

    document.getElementById("btn_submit").disabled = "disabled";

    return true;
}

var uploadFile = $('.filebox .uploadBtn');
uploadFile.on('change', function(){
    if(window.FileReader){
        var filename = $(this)[0].files[0].name;
    } else {
        var filename = $(this).val().split('/').pop().split('\\').pop();
    }
    $(this).siblings('.fileName').val(filename);
});
</script>





