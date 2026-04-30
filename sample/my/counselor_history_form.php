<?php
include_once("./_common.php"); // 메뉴별 공통파일
$g5['title'] = '상담내역 관리';
include_once(G5_THEME_MOBILE_PATH.'/head.php');



?>

<style>
.write_div_title { font-weight:600; margin-bottom:10px;}

.write_div_radio_wrap { width:100%; float:left;}
.write_div_radio_wrap .write_div_radio { width:25%; float:left; margin-bottom:10px;}
.write_div_radio_wrap .write_div_radio label { font-size:14px; color:#000;}

#bo_w .btn_confirm { float:left; position: relative !important;}

#bo_w .btn_submit {
    width: 100%;
    height: 50px;
    font-weight: bold;
    font-size: 1.083em;
    border-radius: 3px;
}

.counselor_history_info {border-radius:4px; background-color:#f5f5f5; padding:10px 12px;}
.counselor_history_info h3 { font-weight:600; margin-bottom:8px;}
.counselor_history_info dl { width:100%; display:flex; padding:2px 0px; font-size:13px;}
.counselor_history_info dl dt { width:80px;}
.counselor_history_info dl dd { width:calc(100% - 80px);}

</style>

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<div id="bo_w" class="con_section">

	<div class="form_01 write_div">
        <h2 class="sound_only">상담내역 </h2>
		
        <div class="counselor_history_info" style="">
        	<h3>상담정보</h3>
        	<dl>
            	<dt><strong>·</strong> 상담사</dt>
                <dd>신안몽타로</dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 고객명</dt>
                <dd>김OO</dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 상담시작</dt>
                <dd>2024-00-00 00:00:00</dd>
            </dl>
            
        	<dl>
            	<dt><strong>·</strong> 상담종료</dt>
                <dd>2024-00-00 00:00:00</dd>
            </dl>
        </div>
        
		<div class="bo_w_select write_div">
            <label for="ca_name" class="sound_only">분류<strong>필수</strong></label>
            <select class="frm_input full_input" id="ca_name" name="ca_name" required="">
                <option value="">상담분류 (필수)</option>
				<option value="전화상담">전화상담</option>
                <option value="채팅상담">채팅상담</option>
            </select>
        </div>
        
		<div class="write_div">
            <select class="frm_input full_input" name="wr_1" id="wr_1" required="">
			    <option value="">상담주제 (필수)</option>
			    <option value="운세">운세</option>
			    <option value="속마음">속마음</option>
			    <option value="연애">연애</option>
			    <option value="재회">재회</option>
			    <option value="궁합">궁합</option>
			    <option value="금전">금전</option>
			    <option value="건강">건강</option>
			    <option value="취업">취업</option>
			    <option value="합격">합격</option>
			    <option value="사업">사업</option>
			    <option value="택일">택일</option>
			    <option value="이사">이사</option>
			    <option value="작명/개명">작명/개명</option>
			    <option value="불륜/이혼">불륜/이혼</option>
			    <option value="삼재">삼재</option>
			    <option value="고민">고민</option>
			    <option value="꿈해몽">꿈해몽</option>
			    <option value="없음">없음</option>
			</select>
        </div>

        <div class="write_div">
            <label for="wr_content" class="sound_only">내용<strong>필수</strong></label>
            <textarea id="wr_content" name="wr_content" class="" maxlength="65536" style="width:100%; height:150px;" placeholder="고객 특이사항을 입력해 주세요.
(해당 내용은 단골 고객 관리에 용이하니 최대한 자세하게 작성해 적극적으로 이용해 보세요!)"></textarea>
<span class="sound_only">웹 에디터 끝</span>                    
		</div>        

        </div>
        
	<div class="btn_confirm" style="margin-top:20px;">
        <button type="submit" id="btn_submit" class="btn_submit" accesskey="s">저장</button>
    </div>        

</div>
<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>