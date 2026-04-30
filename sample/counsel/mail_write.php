<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>


<div class="title">이메일상담 신청</div>

<div class="form_warp">
    <ul>
        <p class="input_title">이름</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="text" placeholder="입력해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">남자</span>
                <span>여자</span>
            </p>
    	</li>
        
        <p class="input_title">생년월일</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="date" placeholder="선택해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">음력</span>
                <span>양력</span>
            </p>
    	</li>
        
        <p class="input_title">태어난 시간</p>
    	<li class="input_div input_div_flex  input_div_toggle_02">
        	<input type="time" placeholder="선택해주세요" />
            
            <p class="toggle_btn_02">
            	<span class="on">모름</span>
            </p>
    	</li>
        
        <p class="input_title">직업</p>
    	<li class="input_div input_div_flex  input_div_toggle">
        	<input type="text" placeholder="입력해주세요" />
            
            <p class="toggle_btn">
            	<span class="on">기혼</span>
                <span>미혼</span>
            </p>
    	</li>
        
        <button class="input_more"><i class="xi-plus-min"></i> 정보 추가하기</button>
    </ul>
</div>
 
<div class="con_section page_noti_03">
	혼인신고/결혼/출산 택일은 부부의 정보가 필요하며<br />이사 택일은 함께 이동하는 사람들의 정보가 필요합니다.
</div> 

<div class="form_warp">
	<ul>
        <p class="input_title">연락처</p>
    	<li class="input_div">
        	<input type="text" placeholder="하이픈'-' 제외" />
    	</li>
        
        <p class="input_title">세부문의 내용</p>
    	<li class="input_div">
       	  <textarea placeholder="내용을 적어주세요."></textarea>
    	</li>        
        
      	<p class="input_title">이메일주소</p>
	    <li class="input_div input_div_flex">
        	
    		<input class="input_email" type="text" placeholder="이메일 ID" />
            
            <span class="input_id_blank">@</span>
            
            <select class="input_email">
            	<option>이메일 선택</option>
                <option>naver.com</option>
                <option>hanmail.net</option>
                <option>daum.net</option>
                <option>gmail.com</option>
                <option>kakao.com</option>
                <option>직접입력</option>
            </select>
	    </li>
        <p class="input_guide">작성해주신 이메일주소로 풀이를 보내드리기 때문에 정확하게 입력하셔야 합니다.</p>
        
        <li class="register_menu">
          	
            <details>
            	
            	<summary>
                	<input type="checkbox" id="cb1">
    				<label for="cb1"></label>
                	<span>개인정보 이용</span>에 동의합니다.
                </summary>
 				<ul>
                    <textarea readonly>'사주문'는 개인정보 보호법 제30조에 따라 정보주체(고객)의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리지침을 수립 · 공개합니다.
1. 개인정보의 처리목적
'사주문'는 다음의 목적을 위하여 개인정보를 처리하고 있으며, 다음의 목적 이외의 용도로는 이용하지 않습니다.
- 회원가입
- 게시판: 질문과 답변
- 회원가입시 : 로그인ID , 비밀번호 , 이름 , 전화번호 , 이메일 , 닉네임, 주소
- 서비스 신청시 : 보유 상품정보, 구매처, 연식, 방문 예약 일정, 내용, 사진
- 결제에 필요한 정보(유료 서비스 이용시)

2. 개인정보의 처리 및 보유기간
1 '사주문'는 정보주체로부터 개인정보를 수집할 때 동의받은 개인정보 보유 · 이용기간 또는 법령에 따른 개인정보 보유 · 이용기간 내에서 개인정보를 처리 · 보유합니다.
2 구체적인 개인정보 처리 및 보유 기간은 다음과 같습니다.
- 소비자의 불만 및 분쟁처리에 관한 기록 : 3년
- 로그기록 : 3개월

3. 개인정보의 제3자 제공
'사주문'는 정보주체의 별도 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 해당하는 경우 외에는 개인정보를 제3자에게 제공하지 않습니다.

4. 개인정보처리의 위탁
1 '사주문'는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 외부에 위탁하고 있습니다.
[디에프] 웹사이트 및 시스템 관리</textarea>
				</ul>
			</details>
    	    
        </li>
        
        
        <li>
        	<a href="pre_view.php">
          	<button class="log_btn">상담 신청하기</button>
            </a>
        </li>
    </ul>
</div>





<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
