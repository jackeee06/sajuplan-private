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
.write_div_title { font-weight:600; margin-bottom:10px;}

.write_div_radio_wrap { width:100%; float:left;}
.write_div_radio_wrap .write_div_radio { width:25%; float:left; margin-bottom:10px;}
.write_div_radio_wrap .write_div_radio label { font-size:14px; color:#000;}

.counselor_history_info {border-radius:4px; background-color:#f5f5f5; padding:10px 12px;}
.counselor_history_info h3 { font-weight:600; margin-bottom:8px;}
.counselor_history_info dl { width:100%; display:flex; padding:2px 0px; font-size:13px;}
.counselor_history_info dl dt { width:80px;}
.counselor_history_info dl dd { width:calc(100% - 80px);}


</style>

<section id="bo_w">
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
	
    <div class="form_01 write_div">
        <h2 class="sound_only"><?php echo $g5['title'] ?></h2>

        <?php if ($is_category) { ?>
        <div class="bo_w_select write_div">
            <label for="ca_name" class="sound_only">분류<strong>필수</strong></label>
            <select class="frm_input full_input" id="ca_name" name="ca_name" required>
                <option value="">선택하세요</option>
                <?php echo $category_option ?>
            </select>
        </div>
        <?php } ?> 
        
        <?php if ($is_name) { ?>
        <div class="write_div">
            <label for="wr_name" class="sound_only">이름<strong>필수</strong></label>
            <input type="text" name="wr_name" value="<?php echo $name ?>" id="wr_name" required class="frm_input full_input required" maxlength="20" placeholder="이름">
        </div>
        <?php } ?>

        <?php if ($is_password) { ?>
        <div class="write_div">
            <label for="wr_password" class="sound_only">비밀번호<strong>필수</strong></label>
            <input type="password" name="wr_password" id="wr_password" <?php echo $password_required ?> class="frm_input full_input <?php echo $password_required ?>" maxlength="20" placeholder="비밀번호">
        </div>
        <?php } ?>

        <?php if ($is_email) { ?>
        <div class="write_div">
            <label for="wr_email" class="sound_only">이메일</label>
            <input type="email" name="wr_email" value="<?php echo $email ?>" id="wr_email" class="frm_input full_input" maxlength="100" placeholder="이메일">
        </div>
        <?php } ?>

        <?php if ($is_homepage) { ?>
        <div class="write_div">
            <label for="wr_homepage" class="sound_only">홈페이지</label>
            <input type="text" name="wr_homepage" value="<?php echo $homepage ?>" id="wr_homepage" class="frm_input full_input" placeholder="홈페이지">
        </div>
        <?php } ?>

        <?php if ($option) { ?>
        <!--
        <div class="write_div">
            <span class="sound_only">옵션</span>
            <ul class="bo_v_option">
            <?php echo $option ?>
            </ul>
        </div>
        -->
        <?php } ?>


		<div class="counselor_history_info" style="">
        	<h3>상담정보</h3>
        	<dl>
            	<dt><strong>·</strong> 상담사</dt>
                <dd><?=$cinfo["mb_nick"]?></dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 고객명</dt>
                <dd><?=$minfo["mb_name"]?></dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 상담시작</dt>
                <dd><?=$vrow["start"]?></dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 상담종료</dt>
                <dd><?=$vrow["end"]?></dd>
            </dl>
        </div>

		<div class="write_div">
            <select class="frm_input full_input" name="wr_1" id="wr_1" required>
			    <option value="">상담분류(필수)</option>
			    <option value="전화상담"<?php echo ($write['wr_1'] == "전화상담") ? " selected" : "";?>>전화상담</option>
			    <option value="채팅상담"<?php echo ($write['wr_1'] == "채팅상담") ? " selected" : "";?>>채팅상담</option>
			</select>
        </div>

		<div class="write_div">
            <select class="frm_input full_input" name="wr_2" id="wr_2" required>
			    <option value="">상담주제(필수)</option>
			    <option value="운세"<?php echo ($write['wr_2'] == "운세") ? " selected" : "";?>>운세</option>
			    <option value="속마음"<?php echo ($write['wr_2'] == "속마음") ? " selected" : "";?>>속마음</option>
			    <option value="연애"<?php echo ($write['wr_2'] == "연애") ? " selected" : "";?>>연애</option>
			    <option value="짝사랑"<?php echo ($write['wr_2'] == "짝사랑") ? " selected" : "";?>>짝사랑</option>
			    <option value="재회"<?php echo ($write['wr_2'] == "재회") ? " selected" : "";?>>재회</option>
			    <option value="궁합"<?php echo ($write['wr_2'] == "궁합") ? " selected" : "";?>>궁합</option>
			    <option value="금전"<?php echo ($write['wr_2'] == "금전") ? " selected" : "";?>>금전</option>
			    <option value="건강"<?php echo ($write['wr_2'] == "건강") ? " selected" : "";?>>건강</option>
			    <option value="취업"<?php echo ($write['wr_2'] == "취업") ? " selected" : "";?>>취업</option>
			    <option value="합격"<?php echo ($write['wr_2'] == "합격") ? " selected" : "";?>>합격</option>
			    <option value="사업"<?php echo ($write['wr_2'] == "사업") ? " selected" : "";?>>사업</option>
			    <option value="택일"<?php echo ($write['wr_2'] == "택일") ? " selected" : "";?>>택일</option>
			    <option value="이사"<?php echo ($write['wr_2'] == "이사") ? " selected" : "";?>>이사</option>
			    <option value="작명/개명"<?php echo ($write['wr_2'] == "작명/개명") ? " selected" : "";?>>작명/개명</option>
			    <option value="불륜/이혼"<?php echo ($write['wr_2'] == "불륜/이혼") ? " selected" : "";?>>불륜/이혼</option>
			    <option value="삼재"<?php echo ($write['wr_2'] == "삼재") ? " selected" : "";?>>삼재</option>
			    <option value="고민"<?php echo ($write['wr_2'] == "고민") ? " selected" : "";?>>고민</option>
			    <option value="꿈해몽"<?php echo ($write['wr_2'] == "꿈해몽") ? " selected" : "";?>>꿈해몽</option>
			    <option value="기타"<?php echo ($write['wr_2'] == "기타") ? " selected" : "";?>>기타</option>
			</select>
        </div>

        <div class="write_div">
            <label for="wr_content" class="sound_only">내용<strong>필수</strong></label>
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

        <?php if ($is_use_captcha) { //자동등록방지 ?>
        <div class="write_div">
            <span class="sound_only">자동등록방지</span>
            <?php echo $captcha_html ?>
        </div>
        <?php } ?>
    </div>

    <div class="btn_confirm">
        <!--<a href="<?php echo get_pretty_url($bo_table); ?>" class="btn_cancel">취소</a>-->
        <button type="submit" id="btn_submit" class="btn_submit" accesskey="s">작성완료</button>
    </div>
    </form>
</section>

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

