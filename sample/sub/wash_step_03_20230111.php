<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "정기세차 예약";  
include_once(G5_THEME_MOBILE_PATH.'/head_w.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<style>
/* BODY 배경컬러 변경
body { background-color:#fff;} */

/* 하단메뉴 숨김 */
.tail { display:none;}

.sub_section { }
.sub_section ul.con_input_02 { line-height:1.5; /*padding-bottom:15px;*/}
.sub_section ul.con_input_02:last-child { padding-bottom:0;}
.sub_section ul.con_input_02 li.left {float:left; width:80px; margin-right:10px; font-weight: 500;}
.sub_section ul.con_input_02 li.right {float:right; width:calc(100% - 90px); color:#666;}
.sub_section ul.con_input_02 input[type=text] {
	border:1px solid #ddd;
	height:40px;
	border-radius:6px;
	float:left;
	padding:0px 6px;
}
.sub_section ul.con_input_02 span { display:inline-block; float:left; padding:px 0;}

.sub_section ul.con_input_02 p.small_text {width: 100%; float: left; font-size:14px; color:#999; margin-top:4px;}
.sub_section ul.con_input_02 p.small_text i { padding-right:4px;vertical-align:-2px;}
</style>


<!-- 상태탭 CSS 설명 : START 

[작성 전]
wash_state_01
wash_state_02
wash_state_03

[작성 중]
wash_state_01_ing
wash_state_02_ing
wash_state_03_ing

[작성 후]
wash_state_01_end
wash_state_02_end
wash_state_03_end

상태탭 CSS 설명 : END -->

<div class="wash_state_tap">
	<ul class="wash_state_01_end">
        <p><i class="xi-check"></i></p>
        <span>패키지 선택</span>
    </ul>
    
    <ul class="wash_state_02_end">
   		<p><i class="xi-check"></i></p>
        <span>이용정보 입력</span>
    </ul>
    
    <ul class="wash_state_03_ing">
   		<p><i class="xi-check"></i></p>
        <span>예약정보 확인</span>
    </ul>
</div>


<div class="sub_div sub_section" >
    <ul class="con con_input_02">
        <li class="left">구미화</li>
        <li class="right" style="color:#000;">010-1234-5678</li>      
	</ul>
</div>

<div class="sub_div sub_section">
    <ul class="con con_input_02">
    	<li class="left">세차주기</li>
        <li class="right">베이직 패키지 (주 1회)</li>
	</ul>
    
    <ul class="con con_input_02">
    	<li class="left">추가관리</li>
        <li class="right">        	
            하부세차<br />
            내부 플라스틱 보호제<br />
            가죽 보호제<br />
            외부 플라스틱 보호제<br />
            타르 제거            
        </li>
	</ul>
</div>

<div class="sub_div sub_section" style="border-bottom:none;">
    <ul class="con con_input_02">
    	<li class="left">차량정보</li>
        <li class="right">            
            티구안<br />
            12가3456 / 실버            
        </li>
	</ul>
    
    <ul class="con con_input_02">
    	<li class="left">세차장소</li>
        <li class="right">         	
            대구 동구 반야월북로 123 각산데시앙<br />
            지하2층 주차장            
        </li>
	</ul>
    
    <ul class="con con_input_02">
    	<li class="left">키 전달방법</li>
        <li class="right">문 열어놓겠습니다.</li>
	</ul>
    <ul class="con con_input_02">
    	<li class="left">추가요청</li>
        <li class="right">꼼꼼하게 부탁드립니다.</li>
	</ul>
</div>



<!-- 하단 고정 버튼 -->
<div class="wash_btn" style="">
	
    <a href="<?php echo G5_URL; ?>/sub/wash_step_02.php">
    <ul class="back_btn"><i class="xi-angle-left"></i></ul>
	</a>
    
    <a onclick="wash_step_03()" style="cursor:pointer">
    <ul class="next_btn">예약신청</ul>
	</a>
    
</div>


<script>

function wash_step_03() {

  alert("정기세차 예약신청 완료!\n딱 맞는 매니저를 선정 중입니다.");

  window.location.href = "../";

}

</script>



<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
