<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);



$tmb_id = $_REQUEST["tmb_id"];

$tmb = get_member($tmb_id);
?>

<style>
#wrapper > div:last-child { padding-bottom:60px;}
</style>

<section id="bo_w">
    <form name="fwrite" id="fwrite" action="<?php echo $action_url ?>" onsubmit="return fwrite_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off">
    <input type="hidden" name="w" value="<?php echo $w ?>">
    <input type="hidden" name="tmb_id" value="<?php echo $tmb_id ?>">
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

<style>
.write_div.counselor_01 ,
.write_div.counselor_02 { width:100%; float:left; margin-bottom:20px !important;}

.write_div.counselor_01 .subject,
.write_div.counselor_02 .subject { font-weight:600;}

.write_div.counselor_01 .subject { width:100px; float:left; padding-top:10px;}
.write_div.counselor_01 .item { width:calc(100% - 100px); float:left; display:flex; justify-content: space-between; line-height:40px;}

.write_div.counselor_02 .subject { width:100%; float:left; padding-top:10px; margin-bottom:10px;}
.write_div.counselor_02 .item { width:calc(100% - 0px); float:left;}

.write_div .item .input_wrap { border:1px solid #ddd; border-radius:6px; width:100%; display:flex; padding:0 10px; margin-bottom:0;}
.write_div .item .input_wrap.w50 { width:calc(50% - 4px);}

.write_div .item .input_wrap select,
.write_div .item .input_wrap input[type=text], 
.write_div .item .input_wrap input[type=number], 
.write_div .item .input_wrap input[type=password], 
.write_div .item .input_wrap input[type=email], 
.write_div .item .input_wrap input[type=file], 
.write_div .item .input_wrap textarea {border:none !important; border-radius:6px !important; width:100%; padding:5px 0; }

.type_check { display:inline-block; width:110px; margin-bottom:10px;}

</style>
	
    <div class="form_01 write_div">
        <h2 class="sound_only"><?php echo $g5['title'] ?></h2> 
        
        <div class="bo_w_tit write_div counselor_01">
        	<ul class="subject">상담사 이름</ul>
            <ul class="item" style="display:block;">
            	<div class="input_wrap" style="width:auto; display:inline-block;">
		            <label for="wr_subject" class="sound_only">상담사 이름<strong>필수</strong></label>
 
                    <input type="text" name="wr_subject" value="<?php echo $tmb["mb_nick"]?$tmb["mb_nick"]:$member['mb_nick']; ?>" id="wr_subject" required class="frm_input full_input" placeholder="상담사 이름" readonly="readonly" <?if($member["mb_level"]=="5"){?> onclick="alert('관리자에게 문의해주세요');return false;" <?}?>>
            	</div>
                 / <?php echo $write['mb_id']; ?>
            </ul>
        </div>

        <?php if ($is_category) { ?>
        <div class="bo_w_select write_div counselor_01">
        	<ul class="subject">카테고리</ul>
            <ul class="item">
            	<div class="input_wrap required">
		            <label for="ca_name" class="sound_only">분류<strong>필수</strong></label>
        		    <select id="ca_name" name="ca_name" required <?if($member["mb_level"]=="5"){?> readonly onclick="alert('관리자에게 문의해주세요');return false;" <?}?>>
		                <option value="">선택하세요</option>
        		        <?php echo $category_option ?>
		            </select>
            	</div>
            </ul>
        </div>
        <?php } ?>
        
        <div class="write_div counselor_01">
        	<ul class="subject">한줄소개</ul>
            <ul class="item">
            	<div class="input_wrap required">
		            <label for="wr_8" class="sound_only">한줄소개</label>
        		    <input type="text" name="wr_8" value="<?php echo $wr_8 ?>" id="wr_8" class="frm_input full_input " maxlength="25" placeholder="25글자 이내">
            	</div>
            </ul>
        </div>

        <div class="write_div counselor_01">
        	<ul class="subject guide_pop_btn">해시태그 <i class="xi-help-o gray"></i></ul>            
		    <!-- 해시태그 안내 모달레이어 -->

            
            <ul class="item">
            	<div class="input_wrap w50 required">
		            <label for="wr_9" class="sound_only">해시태그<strong>필수</strong></label>
        		    #<input type="text" name="wr_9" value="<?php echo $wr_9 ?>" id="wr_9" class="frm_input " maxlength="5" placeholder="최대5글자">
            	</div>
                
                <div class="input_wrap w50 required">            
		            #<input type="text" name="wr_10" value="<?php echo $wr_10 ?>" id="wr_10" class="frm_input " maxlength="5" placeholder="최대5글자">
            	</div>
            </ul>
        </div>
        
        <div class="write_div counselor_01">
        	<ul class="subject guide_pop_btn">성별</ul>            
		    <!-- 해시태그 안내 모달레이어 -->
            <ul class="item" style="  justify-content: normal;">
            	<span style="margin-right:30px;"><input type="radio" name="wr_1" value="남성" <?php echo ($write['wr_1'] == "남성") ? " checked" : "";?> required> 남성</span>
				<span style="margin-right:30px;"><input name="wr_1" type="radio" required value="여성" checked="checked" <?php echo ($write['wr_1'] == "여성") ? " checked" : "";?>> 여성</span>
            </ul>
        </div>

        <div class="write_div counselor_02">
        	<ul class="subject">상담사 공지</ul>
            <ul class="item">
            <label for="wr_content" class="sound_only">상담사 소개<strong>필수</strong></label>
            <?php if($write_min || $write_max) { ?>
            <!-- 최소/최대 글자 수 사용 시 -->
            <p id="char_count_desc">이 게시판은 최소 <strong><?php echo $write_min; ?></strong>글자 이상, 최대 <strong><?php echo $write_max; ?></strong>글자 이하까지 글을 쓰실 수 있습니다.</p>
            <?php } ?>
            <?php echo $editor_html; // 에디터 사용시는 에디터로, 아니면 textarea 로 노출 ?>
            <?php if($write_min || $write_max) { ?>
            <!-- 최소/최대 글자 수 사용 시 -->
            <div id="char_count_wrap"><span id="char_count"></span>글자</div>
            <?php } ?>
            </ul>
        </div>
        
        <!-- 전문분야 -->
		<div class="write_div counselor_02">
        	<ul class="subject">전문분야</ul>
            <ul class="item">
			    <label for="wr_5" class="sound_only">전문분야</label>
			    <?php
				    $wr5 = explode("|", $write['wr_5']);
				    $options = array('운세', '속마음', '연애', '짝사랑', '재회', '궁합', '금전', '건강', '취업', '합격', '사업', '택일', '이사', '작명/개명', '불륜/이혼', '삼재', '고민', '꿈해몽');
				    foreach ($options as $option) {
				        $checked = (in_array($option, $wr5)) ? 'checked' : '';
		        ?>
        		
                <span class="type_check"><input type="checkbox" name="wr5[]" value="<?php echo $option; ?>" <?php echo $checked; ?>> <?php echo $option; ?></span>
                
		        <?php
			    	}
				?>
    		</ul>
		</div>
        
        <!-- 스타일 -->
		<div class="write_div counselor_02">
        	<ul class="subject">스타일</ul>
            <ul class="item">
            	<label for="wr_6" class="sound_only">전문분야</label>
			    <?php
				    $wr6 = explode("|", $write['wr_6']);
				    $options = array('경청하는', '소통하는', '깊이있는', '공감하는', '긍정적인', '현실조언', '카리스마', '솔직담백', '부드러운', '친근한(반말체)', '차분한', '편안한', '조곤조곤', '또박또박');
				    foreach ($options as $option) {
				        $checked = (in_array($option, $wr6)) ? 'checked' : '';
		        ?>
        		
                <span class="type_check"><input type="checkbox" name="wr6[]" value="<?php echo $option; ?>" <?php echo $checked; ?>> <?php echo $option; ?></span>
                
		        <?php
			    	}
				?>
    		</ul>
		</div>        

        
        <div class="write_div counselor_02">
        	<ul class="subject">상담사 약력 <span style=" font-weight:400;">(최대 255글자)</span></ul>
            <ul class="item">
            <label for="wr_7" class="sound_only">상담사 약력</label>
            <textarea name="wr_7" id="wr_7"  rows="5"><?php echo $write['wr_7'] ?></textarea>
            </ul>
        </div>

         
        <div class="write_div counselor_02">
        	<ul class="subject">상담사소개 <span style=" font-weight:400;">(최대 255글자)</span></ul>
            <ul class="item">
            <label for="wr_4" class="sound_only">상담사소개<strong>필수</strong></label>
            <textarea name="wr_4" id="wr_4" rows="5"><?php echo $write['wr_4'] ?></textarea>
            </ul>
        </div>
               

        <div class="write_div counselor_02">
        	<ul class="subject">상담사사진</ul>
            <ul class="item">
        <?php for ($i=0; $is_file && $i<$file_count; $i++) { ?>

        <div class="bo_w_flie write_div">
            <div class="file_wr write_div filebox">
            	<input type="text" class="fileName" readonly="readonly" placeholder="파일을 첨부하세요">
                <label for="bf_file_<?php echo $i+1 ?>"><i class="fa fa-download lb_icon" aria-hidden="true"></i><span class="sound_only">파일 #<?php echo $i+1 ?></span><span class="btn_file">파일첨부</span></label>
                <input type="file" name="bf_file[]" id="bf_file_<?php echo $i+1 ?>" title="파일첨부 <?php echo $i+1 ?> : 용량 <?php echo $upload_max_filesize ?> 이하만 업로드 가능" class="frm_file uploadBtn">
            </div>
            <?php if ($is_file_content) { ?>
            <input type="text" name="bf_content[]" value="<?php echo ($w == 'u') ? $file[$i]['bf_content'] : ''; ?>" title="파일 설명을 입력해주세요." class="full_input frm_input" size="50" placeholder="파일 설명을 입력해주세요.">
            <?php } ?>

            <?php if($w == 'u' && $file[$i]['file']) { ?>
            <span class="file_del">
                <input type="checkbox" id="bf_file_del<?php echo $i ?>" name="bf_file_del[<?php echo $i;  ?>]" value="1"> <label for="bf_file_del<?php echo $i ?>"><?php echo $file[$i]['source'].'('.$file[$i]['size'].')';  ?> 파일 삭제</label>
            </span>
            <?php } ?>
        </div>
        <?php } ?>
	        </ul>
        </div>
		
        <!--
        <?php for ($i=1; $is_link && $i<=G5_LINK_COUNT; $i++) { ?>
        <div class="bo_w_link write_div">
            <label for="wr_link<?php echo $i ?>"><i class="fa fa-link" aria-hidden="true"></i> <span class="sound_only">링크 #<?php echo $i ?></span></label>
            <input type="text" name="wr_link<?php echo $i ?>" value="<?php if($w=="u"){echo $write['wr_link'.$i];} ?>" id="wr_link<?php echo $i ?>" class="frm_input wr_link" placeholder="링크를 입력하세요">
        </div>
        <?php } ?>
        -->
        
        <?php if ($is_use_captcha) { //자동등록방지 ?>
        <div class="write_div">
            <span class="sound_only">자동등록방지</span>
            <?php echo $captcha_html ?>
        </div>
        <?php } ?>
    </div>

    <div class="btn_confirm">
        <a href="<?php echo get_pretty_url($bo_table); ?>" class="btn_cancel">취소</a>
        <button type="submit" id="btn_submit" class="btn_submit" accesskey="s">저장</button>
    </div>
    </form>
</section>

			<?php include_once(G5_PATH.'/include/guide_counselor_tag.php'); ?>

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
