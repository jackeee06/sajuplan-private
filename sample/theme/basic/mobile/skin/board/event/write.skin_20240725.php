<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
?>

<script>
$(window).on('load', function() {
    $('#bo_w .btn_submit').css("background-color", "<?php echo $board['bo_1']; ?>");
});
</script>

<link type="text/css" href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css" rel="stylesheet" />
<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js"></script>

<style>
/* 캘린더 { */
.ui-widget-header {
border: 0px solid #dddddd;
background: #fff;
}

.ui-datepicker-calendar>thead>tr>th {
font-size: 14px !important;
}

.ui-datepicker .ui-datepicker-header {
position: relative;
padding: 10px 0;
}

.ui-state-default, .ui-widget-content .ui-state-default, .ui-widget-header .ui-state-default, .ui-button, html .ui-button.ui-state-disabled:hover, html .ui-button.ui-state-disabled:active {
border: 0px solid #c5c5c5;
background-color: transparent;
font-weight: normal;
color: #454545;
text-align: center;
}

.ui-datepicker .ui-datepicker-title {
margin: 0 0em;
line-height: 16px;
text-align: center;
font-size: 14px;
padding: 0px;
font-weight: bold;
}

.ui-datepicker {
display: none;
background-color: #fff;
border-radius: 4px;
margin-top: 10px;
margin-left: 0px;
margin-right: 0px;
padding: 20px;
padding-bottom: 10px;
width: 350px;
box-shadow: 10px 10px 40px rgba(0,0,0,0.1);
}
    
.ui-widget.ui-widget-content {
    border: 1px solid #eee;
}

#datepicker:focus>.ui-datepicker {
display: block;
}

.ui-datepicker-prev,
.ui-datepicker-next {
cursor: pointer;
}

.ui-datepicker-next {
float: right;
}

.ui-state-disabled {
cursor: auto;
color: hsla(0, 0%, 80%, 1);
}

.ui-datepicker-title {
text-align: center;
padding: 10px;
font-weight: 100;
font-size: 20px;
}

.ui-datepicker-calendar {
width: 100%;
}

.ui-datepicker-calendar>thead>tr>th {
padding: 5px;
font-size: 20px;
font-weight: 400;
}


.ui-datepicker-calendar>tbody>tr>td>a {
color: #000;
font-size: 12px !important;
font-weight: bold !important;
text-decoration: none;
    
}


.ui-datepicker-calendar>tbody>tr>.ui-state-disabled:hover {
cursor: auto;
background-color: #fff;
}
    
.ui-datepicker-calendar>tbody>tr>td {
    border-radius: 100%;
    width: 44px;
    height: 30px;
    cursor: pointer;
    padding: 5px;
    font-weight: 100;
    text-align: center;
    font-size: 12px;
}
    
.ui-datepicker-calendar>tbody>tr>td:hover {
    background-color: transparent;
    opacity: 0.6;
}

.ui-state-hover,
.ui-widget-content .ui-state-hover,
.ui-widget-header .ui-state-hover,
.ui-state-focus,
.ui-widget-content .ui-state-focus,
.ui-widget-header .ui-state-focus,
.ui-button:hover,
.ui-button:focus {
border: 0px solid #cccccc;
background-color: transparent;
font-weight: normal;
color: #2b2b2b;
}

.ui-widget-header .ui-icon {
background-image: url('../theme/basic/skin/board/event_basic/img/btns.png');
}
.ui-icon-circle-triangle-e {
background-position: -20px 0px;
background-size: 36px;
}

.ui-icon-circle-triangle-w {
background-position: -0px -0px;
background-size: 36px;
}
    
.ui-datepicker-calendar>tbody>tr>td:first-child a{
color: red !important;
}
    
.ui-datepicker-calendar>tbody>tr>td:last-child a{
color: #0099ff !important;
}
    
.ui-datepicker-calendar>thead>tr>th:first-child {
    color: red !important;
}
    
.ui-datepicker-calendar>thead>tr>th:last-child {
    color: #0099ff !important;
}

.ui-state-highlight, .ui-widget-content .ui-state-highlight, .ui-widget-header .ui-state-highlight {
    border: 0px;
    background: #f1f1f1;
    border-radius: 50%;
    padding-top: 10px;
    padding-bottom: 10px;
}

/* } */
</style>

<section id="bo_w">
    <h2 class="sound_only"><?php echo $g5['title'] ?></h2>

    <!-- 게시물 작성/수정 시작 { -->
    <form name="fwrite" id="fwrite" action="<?php echo $action_url ?>" onsubmit="return fwrite_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off" style="width:<?php echo $width; ?>">
    <input type="hidden" name="uid" value="<?php echo get_uniqid(); ?>">
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
        

        
    <table class="w_tables" border="0" cellspacing="0" cellpadding="0">
        <?php if ($is_category) { ?>
        <tr>
            <td class="thead">분류</td>
            <td colspan="3">
                <div class="bo_w_select">
                    <label for="ca_name" class="sound_only">분류<strong>필수</strong></label>
                    <select name="ca_name" id="ca_name" required>
                        <option value="">분류선택</option>
                        <?php echo $category_option ?>
                    </select>
                </div>
            </td>
        </tr>  
        <?php } ?>
        <?php if ($is_name) { ?>
        <tr>
            <td class="thead">성함</td>
            <td>
                <input type="text" name="wr_name" value="<?php echo $name ?>" id="wr_name2" required class="frm_input full_input w_inputs required" placeholder="성함">
            </td>
        </tr>
        <?php } ?>
        
        <?php if ($is_password) { ?>
        <tr>
            <td class="thead">비밀번호</td>
            <td>
                <input type="password" name="wr_password" id="wr_password2" <?php echo $password_required ?> class="frm_input full_input w_inputs <?php echo $password_required ?>" placeholder="비밀번호">
            </td>
        </tr>
        <?php } ?>
        <?php if ($is_email) { ?>
        <tr>
            <td class="thead">이메일</td>
            <td>
                <input type="text" name="wr_email" value="<?php echo $email ?>" id="wr_email2" class="frm_input half_input w_inputs email " placeholder="이메일">
            </td>
        </tr>
        <?php } ?>
        <tr>
            <td class="thead">제목</td>
            <td>
                <input type="text" name="wr_subject" value="<?php echo $subject ?>" id="wr_subject" required class="frm_input full_input w_inputs required" maxlength="255" placeholder="제목">
            </td>
        </tr>
        
        <tr>
            <td class="thead">기간</td>
            <td>
                <input type="text" name="wr_1" value="<?php echo $write['wr_1'] ?>" id="wr_1" required class="frm_input w_inputs datepicker required" placeholder="시작일" style="width:30%;"> 
                <input type="text" name="wr_2" value="<?php echo $write['wr_2'] ?>" id="wr_2" required class="frm_input w_inputs datepicker required" placeholder="종료일" style="width:30%;">
            </td>
        </tr>
        
        <tr>
            <td colspan="2" class="cont_td">
                <?php if ($option) { ?>
                <div class="write_div opt_div">
                    <span class="sound_only">옵션</span>
                    <ul class="bo_v_option">
                    <?php echo $option ?>
                    </ul>
                </div>
                <?php } ?>
                
                <div style="height:10px">　</div>
                
                <div class="write_div">
                    <label for="wr_content" class="sound_only">내용<strong>필수</strong></label>
                    <div class="wr_content <?php echo $is_dhtml_editor ? $config['cf_editor'] : ''; ?>">
                        <?php if($write_min || $write_max) { ?>
                        <!-- 최소/최대 글자 수 사용 시 -->
                        <p id="char_count_desc">이 게시판은 최소 <strong><?php echo $write_min; ?></strong>글자 이상, 최대 <strong><?php echo $write_max; ?></strong>글자 이하까지 글을 쓰실 수 있습니다.</p>
                        <?php } ?>
                        <?php echo $editor_html; // 에디터 사용시는 에디터로, 아니면 textarea 로 노출 ?>
                        <?php if($write_min || $write_max) { ?>
                        <!-- 최소/최대 글자 수 사용 시 -->
                        <div id="char_count_wrap"><span id="char_count"></span>글자</div>
                        <?php } ?>
                    </div>

                </div>
            
            </td>
        </tr>
    </table>




	
    
        



    
    <!--
    <?php for ($i=1; $is_link && $i<=G5_LINK_COUNT; $i++) { ?>
    <div class="bo_w_link write_div">
        <label for="wr_link<?php echo $i ?>"><i class="fa fa-link" aria-hidden="true"></i><span class="sound_only"> 링크  #<?php echo $i ?></span></label>
        <input type="text" name="wr_link<?php echo $i ?>" value="<?php if($w=="u"){ echo $write['wr_link'.$i]; } ?>" id="wr_link<?php echo $i ?>" class="frm_input full_input w_inputs" size="50">
    </div>
    <?php } ?>
    -->

    <?php for ($i=0; $is_file && $i<$file_count; $i++) { ?>
    <div class="bo_w_flie write_div">
        <div class="file_wr write_div">
            <label for="bf_file_<?php echo $i+1 ?>" class="lb_icon"><i class="fa fa-folder-open" aria-hidden="true"></i><span class="sound_only"> 파일 #<?php echo $i+1 ?></span></label>
            <input type="file" name="bf_file[]" id="bf_file_<?php echo $i+1 ?>" title="파일첨부 <?php echo $i+1 ?> : 용량 <?php echo $upload_max_filesize ?> 이하만 업로드 가능" class="frm_file w_inputs">
        </div>
        <?php if ($is_file_content) { ?>
        <input type="text" name="bf_content[]" value="<?php echo ($w == 'u') ? $file[$i]['bf_content'] : ''; ?>" title="파일 설명을 입력해주세요." class="full_input frm_input w_inputs" size="50" placeholder="파일 설명을 입력해주세요.">
        <?php } ?>

        <?php if($w == 'u' && $file[$i]['file']) { ?>
        <span class="file_del">
            <input type="checkbox" id="bf_file_del<?php echo $i ?>" name="bf_file_del[<?php echo $i;  ?>]" value="1"> <label for="bf_file_del<?php echo $i ?>"><?php echo $file[$i]['source'].'('.$file[$i]['size'].')';  ?> 파일 삭제</label>
        </span>
        <?php } ?>
        
    </div>
    <?php } ?>


    <?php if ($is_use_captcha) { //자동등록방지  ?>
    <div class="write_div">
        <?php echo $captcha_html ?>
    </div>
    <?php } ?>
    
    <div class="btn_confirm">
        <a href="<?php echo get_pretty_url($bo_table); ?>" class="btn_cancel">취소</a>
        <button type="submit" id="btn_submit" class="btn_submit" accesskey="s">작성완료</button>
    </div>
    </form>
    
    <!-- 캘린더 { -->
	<script>
    $.datepicker.setDefaults({
      closeText: "닫기",
      prevText: "이전달",
      nextText: "다음달",
      currentText: "오늘",
      monthNames: ["1월", "2월", "3월", "4월", "5월", "6월",
        "7월", "8월", "9월", "10월", "11월", "12월"
      ],
      monthNamesShort: ["1월", "2월", "3월", "4월", "5월", "6월",
        "7월", "8월", "9월", "10월", "11월", "12월"
      ],
      dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
      dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
      dayNamesMin: ["일", "월", "화", "수", "목", "금", "토"],
      weekHeader: "주",
      dateFormat: "yy-mm-dd", // 날짜형태 예)yy년 m월 d일
      firstDay: 0,
      isRTL: false,
      showMonthAfterYear: true,
      yearSuffix: "년"
    })

    $(".datepicker").datepicker({
      minDate: 0
    })
	</script>
	<!-- } -->

    <script>
    <?php if($write_min || $write_max) { ?>
    // 글자수 제한
    var char_min = parseInt(<?php echo $write_min; ?>); // 최소
    var char_max = parseInt(<?php echo $write_max; ?>); // 최대
    check_byte("wr_content", "char_count");

    $(function() {
        $("#wr_content").on("keyup", function() {
            check_byte("wr_content", "char_count");
        });
    });

    <?php } ?>
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
        <?php echo $editor_js; // 에디터 사용시 자바스크립트에서 내용을 폼필드로 넣어주며 내용이 입력되었는지 검사함   ?>

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

        <?php echo $captcha_js; // 캡챠 사용시 자바스크립트에서 입력된 캡챠를 검사함  ?>

        document.getElementById("btn_submit").disabled = "disabled";

        return true;
    }
    </script>
</section>
<!-- } 게시물 작성/수정 끝 -->