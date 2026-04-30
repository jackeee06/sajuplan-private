<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

// 여분필드 체크박스 배열로 처리하는 방법
// https://gnustudy.com/bbs/board.php?bo_table=skin_board&wr_id=177
$check1 = explode(", ", $write['wr_5']);

?>



<!--<div><img src="../../../../../../img/sample/apply_img.png" style="width:100%;" /></div>-->

<!--<div class="" style=" width:100%; float:left; text-align:center; padding:20px 0; background-image: url(../../../img/tail/tail_point_bg.png); background-size: cover; color:#fff; margin-bottom:20px;">-->



<div class="" style=" width:100%; float:left; text-align:center; margin-bottom:20px;">
	<img src="../../../../../../img/common/apply_form_bg.png" style="width:100%;"/>
</div>

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
            <select id="ca_name" name="ca_name" required>
                <option value="">선택하세요</option>
                <?php echo $category_option ?>
            </select>
        </div>
        <?php } ?>
        
        <?php if ($option) { ?>
        <div class="write_div">
            <span class="sound_only">옵션</span>
            <ul class="bo_v_option">
            <?php echo $option ?>
            </ul>
        </div>
        <?php } ?>
        
        
        
        <div class="write_div counselor_01">
        	<ul class="subject">신청상태</ul>
            <ul class="item">
            	<div class="input_wrap required">
	        	    <label for="wr_6" class="sound_only">상태<strong>필수</strong></label>
    		        <select name="wr_6" id="wr_6" required class="">
					    <option value="문의"<?php echo ($write['wr_6'] == "문의") ? " selected" : "";?>  selected>문의</option>
					    <?php if ($is_admin) { ?>
                        <option value="상담"<?php echo ($write['wr_6'] == "상담") ? " selected" : "";?>>상담</option>
					    <option value="완료"<?php echo ($write['wr_6'] == "완료") ? " selected" : "";?>>완료</option>
					    <option value="보류"<?php echo ($write['wr_6'] == "보류") ? " selected" : "";?>>보류</option>
                        <?php } ?>
					</select>
            	</div>
            </ul>
        </div> 
        
        
        <div class="bo_w_tit write_div counselor_01">
        	<ul class="subject">제목</ul>
            <ul class="item">
            	<div class="input_wrap required">
		            <label for="wr_subject" class="sound_only">제목<strong>필수</strong></label>
        		    <input type="text" name="wr_subject" value="<?php echo $subject ?>" id="wr_subject" required class="frm_input full_input " placeholder="제목을 입력하세요">
            	</div>
            </ul>
        </div>

        
        <?php if ($is_name) { ?>
        <div class="write_div counselor_01">
        	<ul class="subject">이름</ul>
            <ul class="item">
            	<div class="input_wrap required">
	        	    <label for="wr_name" class="sound_only">이름<strong>필수</strong></label>
    		        <input type="text" name="wr_name" value="<?php echo $name ?>" id="wr_name" required class="frm_input full_input " maxlength="20" placeholder="이름을 입력하세요">
            	</div>
            </ul>
        </div>
        <?php } ?>
        
        <div class="write_div counselor_01">
        	<ul class="subject">예명</ul>
            <ul class="item">
            	<div class="input_wrap required">
	        	    <label for="wr_1" class="sound_only">예명<strong>필수</strong></label>
    		        <input type="text" name="wr_1" value="<?php echo $wr_1 ?>" id="wr_1" required class="frm_input full_input " maxlength="20" placeholder="예명을 입력하세요">
            	</div>
            </ul>
        </div>
        
        <div class="write_div counselor_01">
        	<ul class="subject">지역</ul>
            <ul class="item">
            	<div class="input_wrap required">
	        	    <label for="wr_2" class="sound_only">지역<strong>필수</strong></label>
    		        <select name="wr_2" id="wr_2" required class="">
					    <option value="서울"<?php echo ($write['wr_2'] == "서울") ? " selected" : "";?>>서울</option>
					    <option value="부산"<?php echo ($write['wr_2'] == "부산") ? " selected" : "";?>>부산</option>
					    <option value="대구"<?php echo ($write['wr_2'] == "대구") ? " selected" : "";?>>대구</option>
					    <option value="인천"<?php echo ($write['wr_2'] == "인천") ? " selected" : "";?>>인천</option>
					    <option value="광주"<?php echo ($write['wr_2'] == "광주") ? " selected" : "";?>>광주</option>
					    <option value="대전"<?php echo ($write['wr_2'] == "대전") ? " selected" : "";?>>대전</option>
					    <option value="울산"<?php echo ($write['wr_2'] == "울산") ? " selected" : "";?>>울산</option>
					    <option value="세종특별자치시"<?php echo ($write['wr_2'] == "세종특별자치시") ? " selected" : "";?>>세종특별자치시</option>
					    <option value="경기도"<?php echo ($write['wr_2'] == "경기도") ? " selected" : "";?>>경기도</option>
					    <option value="강원도"<?php echo ($write['wr_2'] == "강원도") ? " selected" : "";?>>강원도</option>
					    <option value="충청북도"<?php echo ($write['wr_2'] == "충청북도") ? " selected" : "";?>>충청북도</option>
					    <option value="충청남도"<?php echo ($write['wr_2'] == "충청남도") ? " selected" : "";?>>충청남도</option>
					    <option value="전라북도"<?php echo ($write['wr_2'] == "전라북도") ? " selected" : "";?>>전라북도</option>
					    <option value="전라남도"<?php echo ($write['wr_2'] == "전라남도") ? " selected" : "";?>>전라남도</option>
					    <option value="경상북도"<?php echo ($write['wr_2'] == "경상북도") ? " selected" : "";?>>경상북도</option>
					    <option value="경상남도"<?php echo ($write['wr_2'] == "경상남도") ? " selected" : "";?>>경상남도</option>
					    <option value="제주특별자치도"<?php echo ($write['wr_2'] == "제주특별자치도") ? " selected" : "";?>>제주특별자치도</option>
					</select>
            	</div>
            </ul>
        </div>
        
        <div class="write_div counselor_01">
        	<ul class="subject">핸드폰 번호</ul>
            <ul class="item">
            	<div class="input_wrap required">
	        	    <label for="wr_3" class="sound_only">핸드폰 번호<strong>필수</strong></label>
    		        <input type="text" name="wr_3" value="<?php echo $wr_3 ?>" id="wr_3" required class="frm_input full_input " maxlength="20" placeholder="숫자만 입력하세요">
            	</div>
            </ul>
        </div>


        <?php //if ($is_email) { ?>
        <div class="write_div counselor_01">
        	<ul class="subject">이메일</ul>
            <ul class="item">
            	<div class="input_wrap">
		            <label for="wr_email" class="sound_only">이메일</label>
        		    <input type="email" name="wr_email" value="<?php echo $email ?>" id="wr_email" class="frm_input full_input" maxlength="100" placeholder="이메일">
            	</div>
            </ul>
        </div>
        <?php //} ?>
        
        <div class="write_div counselor_01">
        	<ul class="subject">상담분야</ul>
            <ul class="item">
            	<div class="input_wrap">
	        	    <label for="wr_4" class="sound_only">상담분야<strong>필수</strong></label>
    		        <select name="wr_4" id="wr_4">
					    <option value="타로"<?php echo ($write['wr_4'] == "타로") ? " selected" : "";?>>타로</option>
					    <option value="신점"<?php echo ($write['wr_4'] == "신점") ? " selected" : "";?>>신점</option>
					    <option value="사주"<?php echo ($write['wr_4'] == "사주") ? " selected" : "";?>>사주</option>
					    <option value="심리"<?php echo ($write['wr_4'] == "심리") ? " selected" : "";?>>심리</option>
					</select>
            	</div>
            </ul>
        </div>
        
        <div class="write_div counselor_01">
        	<ul class="subject">전문상담분야<br /><span style="font-weight:400; font-size:12px;">(최대 3개 선택)</span></ul>
            <ul class="item">
            	<div class="input_block">
	        	    <label for="wr_5" class="sound_only">전문상담분야<strong>필수</strong></label>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="운세"<?php echo in_array("운세", $check1) ? ' checked="checked"' : '' ?>> 운세</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="속마음"<?php echo in_array("속마음", $check1) ? ' checked="checked"' : '' ?>> 속마음</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="연애"<?php echo in_array("연애", $check1) ? ' checked="checked"' : '' ?>> 연애</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="짝사랑"<?php echo in_array("짝사랑", $check1) ? ' checked="checked"' : '' ?>> 짝사랑</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="재회"<?php echo in_array("재회", $check1) ? ' checked="checked"' : '' ?>> 재회</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="궁합"<?php echo in_array("궁합", $check1) ? ' checked="checked"' : '' ?>> 궁합</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="금전"<?php echo in_array("금전", $check1) ? ' checked="checked"' : '' ?>> 금전</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="건강"<?php echo in_array("건강", $check1) ? ' checked="checked"' : '' ?>> 건강</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="취업"<?php echo in_array("취업", $check1) ? ' checked="checked"' : '' ?>> 취업</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="합격"<?php echo in_array("합격", $check1) ? ' checked="checked"' : '' ?>> 합격</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="사업"<?php echo in_array("사업", $check1) ? ' checked="checked"' : '' ?>> 사업</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="택일"<?php echo in_array("택일", $check1) ? ' checked="checked"' : '' ?>> 택일</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="이사"<?php echo in_array("이사", $check1) ? ' checked="checked"' : '' ?>> 이사</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="작명/개명"<?php echo in_array("작명/개명", $check1) ? ' checked="checked"' : '' ?>> 작명/개명</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="불륜/이혼"<?php echo in_array("불륜/이혼", $check1) ? ' checked="checked"' : '' ?>> 불륜/이혼</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="삼재"<?php echo in_array("삼재", $check1) ? ' checked="checked"' : '' ?>> 삼재</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="고민"<?php echo in_array("고민", $check1) ? ' checked="checked"' : '' ?>> 고민</span>
    		        <span class="inblock"><input type="checkbox" name="check1[]" value="꿈해몽"<?php echo in_array("꿈해몽", $check1) ? ' checked="checked"' : '' ?>> 꿈해몽</span>
            	</div>
            </ul>
        </div>


        <?php if ($is_homepage) { ?>
        <!--
        <div class="write_div">
            <label for="wr_homepage" class="sound_only">홈페이지</label>
            <input type="text" name="wr_homepage" value="<?php echo $homepage ?>" id="wr_homepage" class="frm_input full_input" placeholder="홈페이지">
        </div>
        -->
        <?php } ?>


        <?php for ($i=0; $is_file && $i<$file_count; $i++) { ?>
        <div class="write_div counselor_01">
        	<ul class="subject">본인 사진</ul>
            <ul class="item">
            	<div class="input_wrap" style="display:block;">
                <div class="file_wr write_div filebox" style=" margin-bottom:0;">
            	<input type="text" class="fileName" readonly="readonly" placeholder="파일을 첨부하세요">
                <label for="bf_file_<?php echo $i+1 ?>" style="display: inline !important;"><i class="fa fa-download lb_icon" aria-hidden="true"></i><span class="sound_only">파일 #<?php echo $i+1 ?></span><span class="btn_file">파일첨부</span></label>
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
            </ul>
        </div>
        <?php } ?>
        
                
        <div class="bo_w_tit write_div counselor_01">
        	<ul class="subject">본인 소개</ul>
            <ul class="item">
	            <label for="wr_content" class="sound_only">소개<strong>필수</strong></label>
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
        
        <?php if ($is_password) { ?>
        <div class="write_div counselor_01">
        	<ul class="subject">비밀번호</ul>
            <ul class="item">
            	<div class="input_wrap">
 		            <label for="wr_password" class="sound_only">비밀번호<strong>필수</strong></label>
        		    <input type="password" name="wr_password" id="wr_password" <?php echo $password_required ?> class="frm_input full_input <?php echo $password_required ?>" maxlength="20" placeholder="비밀번호">
            	</div>
            </ul>
        </div>
        <?php } ?>
        
        <?php if ($is_use_captcha) { //자동등록방지 ?>
        
        <div class="write_div counselor_01">
        	<ul class="subject">자동등록방지</ul>
            <ul class="item">
            	<div class="write_div">
            		<span class="sound_only">자동등록방지</span>
            		<?php echo $captcha_html ?>
        		</div>
            </ul>
        </div>
        
        <?php } ?>
    </div>

    <div class="btn_confirm">
        <a href="<?php echo get_pretty_url($bo_table); ?>" class="btn_cancel">취소</a>
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
