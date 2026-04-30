<?php
if (!defined('_GNUBOARD_')) exit;
add_stylesheet('<link rel="stylesheet" href="'.$qa_skin_url.'/style.css">', 0);
?>

<style>
/* ===== QA 글쓰기 리디자인 ===== */
#bo_w, #bo_w *, #bo_w *::before, #bo_w *::after { box-sizing: border-box; }
#bo_w { background: #f5f5f7; min-height: 100vh; padding: 0; }
.sound_only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* 상단 안내 */
.qa_write_header {
    background: linear-gradient(135deg, #8259f5, #6b3fe4);
    padding: 20px 16px;
    color: #fff;
}
.qa_write_header h3 {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 4px;
}
.qa_write_header p {
    font-size: 12px;
    color: rgba(255,255,255,0.75);
    margin: 0;
}

/* 폼 영역 */
#fwrite .form_01 {
    background: #fff;
    margin: 12px;
    border-radius: 14px;
    padding: 20px 16px;
    border: 1px solid #eee;
}
#fwrite .form_01 ul {
    list-style: none;
    margin: 0;
    padding: 0;
}
#fwrite .form_01 li {
    margin-bottom: 16px;
}
#fwrite .form_01 li:last-child {
    margin-bottom: 0;
}

/* 라벨 */
.qa_label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #333;
    margin-bottom: 6px;
}
.qa_label .req {
    color: #8259f5;
    margin-left: 2px;
}

/* 공통 입력 */
#fwrite select,
#fwrite .frm_input,
#fwrite input[type="text"],
#fwrite input[type="email"] {
    width: 100% !important;
    padding: 12px 14px !important;
    border: 1.5px solid #e0e0e0 !important;
    border-radius: 10px !important;
    font-size: 14px !important;
    color: #333 !important;
    background: #fafafa !important;
    outline: none !important;
    transition: border-color 0.2s !important;
    -webkit-appearance: none !important;
}
#fwrite select:focus,
#fwrite .frm_input:focus,
#fwrite input[type="text"]:focus,
#fwrite input[type="email"]:focus {
    border-color: #8259f5 !important;
    background: #fff !important;
}
#fwrite select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 14px center !important;
    padding-right: 36px !important;
}

/* 체크박스 옵션 */
#fwrite .chk_op {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 13px;
    color: #666;
}

/* 에디터/텍스트영역 */
#fwrite .wr_content textarea,
#fwrite .wr_content .note-editor {
    width: 100% !important;
    min-height: 180px;
    border: 1.5px solid #e0e0e0 !important;
    border-radius: 10px !important;
    padding: 12px 14px !important;
    font-size: 14px !important;
    background: #fafafa !important;
    outline: none !important;
    resize: vertical;
}
#fwrite .wr_content textarea:focus {
    border-color: #8259f5 !important;
    background: #fff !important;
}

/* 파일첨부 */
#fwrite .bo_w_flie .file_wr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
#fwrite .bo_w_flie .file_wr br { display: none; }
#fwrite .bo_w_flie .fileName {
    flex: 1;
    padding: 10px 12px !important;
    border: 1.5px solid #e0e0e0 !important;
    border-radius: 10px !important;
    font-size: 13px !important;
    background: #fafafa !important;
    color: #999 !important;
}
#fwrite .bo_w_flie label {
    flex-shrink: 0;
    cursor: pointer;
}
#fwrite .bo_w_flie .btn_file {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    background: #f3efff;
    color: #8259f5;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    white-space: nowrap;
    line-height: 1;
}
#fwrite .bo_w_flie .lb_icon { display: none; }
#fwrite .bo_w_flie .frm_file { display: none; }

/* 하단 버튼 */
#fwrite .btn_confirm {
    display: flex;
    gap: 10px;
    margin: 0 12px 20px;
    padding: 0;
}
#fwrite .btn_cancel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 15px 0;
    background: #fff;
    color: #666;
    font-size: 15px;
    font-weight: 600;
    border: 1.5px solid #ddd;
    border-radius: 10px;
    text-decoration: none;
    line-height: 1;
}
#fwrite .btn_cancel:active { background: #f5f5f5; }
#fwrite .btn_submit {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 15px 0;
    background: #8259f5;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    line-height: 1;
}
#fwrite .btn_submit:active { background: #6b3fe4; }
#fwrite .btn_submit:disabled { background: #ccc; }
</style>

<section id="bo_w">

    <div class="qa_write_header">
        <h3><?php echo ($w == 'u') ? '문의 수정' : '문의하기'; ?></h3>
        <p>궁금한 내용을 작성해 주시면 빠르게 답변 드리겠습니다.</p>
    </div>

    <form name="fwrite" id="fwrite" action="<?php echo $action_url ?>" onsubmit="return fwrite_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off">
    <input type="hidden" name="w" value="<?php echo $w ?>">
    <input type="hidden" name="qa_id" value="<?php echo $qa_id ?>">
    <input type="hidden" name="sca" value="<?php echo $sca ?>">
    <input type="hidden" name="stx" value="<?php echo $stx ?>">
    <input type="hidden" name="page" value="<?php echo $page ?>">
    <input type="hidden" name="token" value="<?php echo $token ?>">
    <?php
    $option = '';
    $option_hidden = '';
    $option = '';
    if ($is_dhtml_editor) {
        $option_hidden .= '<input type="hidden" name="qa_html" value="1">';
    } else {
        $option .= "\n".'<input type="checkbox" id="qa_html" name="qa_html" onclick="html_auto_br(this);" value="'.$html_value.'" '.$html_checked.' class="selec_chk">'."\n".'<label for="qa_html"><span></span>html</label>';
    }
    echo $option_hidden;
    ?>
    <div class="form_01">
        <ul>
            <?php if ($category_option) { ?>
            <li class="bo_w_select">
                <span class="qa_label">분류 <span class="req">*</span></span>
                <select name="qa_category" id="qa_category" required class="required">
                    <option value="">선택하세요</option>
                    <?php echo $category_option ?>
                </select>
            </li>
            <?php } ?>

            <?php if ($option) { ?>
            <li>
                <span class="sound_only">옵션</span>
                <div class="chk_op chk_box">
                <?php echo $option; ?>
                </div>
            </li>
            <?php } ?>

            <?php if ($is_email) { ?>
            <li>
                <span class="qa_label">이메일</span>
                <input type="email" name="qa_email" value="<?php echo get_text($write['qa_email']); ?>" id="qa_email" <?php echo $req_email; ?> class="<?php echo $req_email.' '; ?>frm_input full_input email" maxlength="100" placeholder="이메일 주소를 입력하세요">
                <div class="chk_op chk_box">
                    <input type="checkbox" name="qa_email_recv" value="1" id="qa_email_recv" <?php if($write['qa_email_recv']) echo 'checked="checked"'; ?> class="selec_chk">
                    <label for="qa_email_recv"><span></span>이메일로 답변받기</label>
                </div>
            </li>
            <?php } ?>

            <?php if ($is_hp) { ?>
            <li>
                <span class="qa_label">휴대폰</span>
                <input type="text" name="qa_hp" value="<?php echo get_text($write['qa_hp']); ?>" id="qa_hp" <?php echo $req_hp; ?> class="<?php echo $req_hp.' '; ?>frm_input full_input" size="30" placeholder="휴대폰 번호를 입력하세요">
                <?php if($qaconfig['qa_use_sms']) { ?>
                <div class="chk_op chk_box">
                    <input type="checkbox" name="qa_sms_recv" value="1" id="qa_sms_recv" <?php if($write['qa_sms_recv']) echo 'checked="checked"'; ?> class="selec_chk">
                    <label for="qa_sms_recv"><span></span>답변등록 SMS알림 수신</label>
                </div>
                <?php } ?>
            </li>
            <?php } ?>

            <li class="bo_w_tit">
                <span class="qa_label">제목 <span class="req">*</span></span>
                <input type="text" name="qa_subject" value="<?php echo get_text($write['qa_subject']); ?>" id="qa_subject" required class="frm_input full_input required" maxlength="255" placeholder="제목을 입력하세요">
            </li>

            <li>
                <span class="qa_label">내용 <span class="req">*</span></span>
                <div class="wr_content">
                    <?php echo $editor_html; ?>
                </div>
            </li>

            <li class="bo_w_flie">
                <span class="qa_label">파일첨부</span>
                <div class="file_wr filebox">
                    <input type="text" class="fileName" readonly="readonly" placeholder="파일을 첨부하세요">
                    <label for="bf_file[1]"><i class="fa fa-download lb_icon" aria-hidden="true"></i><span class="sound_only">파일 #1</span><span class="btn_file">파일첨부</span></label>
                    <input type="file" name="bf_file[1]" id="bf_file[1]" title="파일첨부 1 :  용량 <?php echo $upload_max_filesize; ?> 이하만 업로드 가능" class="frm_file uploadBtn">
                    <?php if($w == 'u' && $write['qa_file1']) { ?>
                    <input type="checkbox" id="bf_file_del1" name="bf_file_del[1]" value="1">
                    <label for="bf_file_del1"><?php echo $write['qa_source1']; ?> 삭제</label>
                    <?php } ?>
                </div>
                <div class="file_wr filebox">
                    <input type="text" class="fileName" readonly="readonly" placeholder="파일을 첨부하세요">
                    <label for="bf_file[2]"><i class="fa fa-download lb_icon" aria-hidden="true"></i><span class="sound_only">파일 #2</span><span class="btn_file">파일첨부</span></label>
                    <input type="file" name="bf_file[2]" id="bf_file[2]" title="파일첨부 2 :  용량 <?php echo $upload_max_filesize; ?> 이하만 업로드 가능" class="frm_file uploadBtn">
                    <?php if($w == 'u' && $write['qa_file2']) { ?>
                    <input type="checkbox" id="bf_file_del2" name="bf_file_del[2]" value="1">
                    <label for="bf_file_del2"><?php echo $write['qa_source2']; ?> 삭제</label>
                    <?php } ?>
                </div>
            </li>
        </ul>
    </div>

    <div class="btn_confirm">
        <a href="<?php echo $list_href; ?>" class="btn_cancel">취소</a>
        <button type="submit" id="btn_submit" accesskey="s" class="btn_submit">작성완료</button>
    </div>
    </form>

    <script>
    function html_auto_br(obj)
    {
        if (obj.checked) {
            result = confirm("자동 줄바꿈을 하시겠습니까?\n\n자동 줄바꿈은 게시물 내용중 줄바뀐 곳을<br>태그로 변환하는 기능입니다.");
            if (result)
                obj.value = "2";
            else
                obj.value = "1";
        }
        else
            obj.value = "";
    }

    function fwrite_submit(f)
    {
        <?php echo $editor_js; ?>

        var subject = "";
        var content = "";
        $.ajax({
            url: g5_bbs_url+"/ajax.filter.php",
            type: "POST",
            data: {
                "subject": f.qa_subject.value,
                "content": f.qa_content.value
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
            f.qa_subject.focus();
            return false;
        }

        if (content) {
            alert("내용에 금지단어('"+content+"')가 포함되어있습니다");
            if (typeof(ed_qa_content) != "undefined")
                ed_qa_content.returnFalse();
            else
                f.qa_content.focus();
            return false;
        }

        <?php if ($is_hp) { ?>
        var hp = f.qa_hp.value.replace(/[0-9\-]/g, "");
        if(hp.length > 0) {
            alert("휴대폰번호는 숫자, - 으로만 입력해 주십시오.");
            return false;
        }
        <?php } ?>

        $.ajax({
            type: "POST",
            url: g5_bbs_url+"/ajax.write.token.php",
            data: { 'token_case' : 'qa_write' },
            cache: false,
            async: false,
            dataType: "json",
            success: function(data) {
                if (typeof data.token !== "undefined") {
                    token = data.token;
                    if(typeof f.token === "undefined")
                        $(f).prepend('<input type="hidden" name="token" value="">');
                    $(f).find("input[name=token]").val(token);
                }
            }
        });

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
</section>
<!-- } 게시물 작성/수정 끝 -->