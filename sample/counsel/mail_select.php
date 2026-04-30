<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>

<div class="title">이메일상담 신청</div>

 
<div class="con_section item_info">
	<dl>
    	<dt>개인사주 (대운/신년)</dt>
    	<dd>대운 : 10년 단위로 큰 운의 흐름을 확인할 수 있습니다.</dd>
    	<dd>신년 : 대운을 초,중,말년으로 구분하여 달별 운을 확인할 수 있습니다.</dd>
    </dl>
    <dl>
    	<dt>궁합</dt>
    	<dd>결혼, 이혼, 짝사랑, 재회, 동업자, 가족물화 등등 여러가지 상황에서 보실 수 있습니다.</dd>
    	<dd>궁합은 개인사주와 달리 나와 상대방 사주를 함게 풀어보고 '합'을 맞추어보며, '합'을 중점으로 풀이가 됩니다.</dd>
    </dl>
    <dl>
    	<dt>작명/개명</dt>
        <dd>작명/개명은 당사자의 사주를 참고하여 사주에서 부족하거나 보완받아야 할 것을 이름에 넣어드립니다.</dd>
    	<dd>본 이름을 그대로 사용하신다거나 정해둔 이름이 있다면 그 이름 또한 감명하여 한자를 바꾸거나 혹은 3~5가지 이름을 새로 뽑아드립니다.
        </dd>
    </dl>
    <dl>
    	<dt>택일</dt>
        <dd>택일은 혼인신고, 결혼, 훌산, 이사, 고사 등등 중요한 날에 길한 날을 잡아보는 항목입니다.</dd>
    	<dd>잡아두신 날짜나 달이 있더라도 그 날이 좋은지 아닌지 감명 드리고 추가로 좋은 날을 뽑아드리며 기혼자의 경우 가족들의 사주를 함께 보고 그에 좋은 날을 뽑아드립니다.
        </dd>
    </dl>
</div> 



<div class="form_warp  order_wrap">
    
    <h3>상품선택</h3>
    	
	<ul class="order_item">
    	<li class="order_name">
            <input type="radio" name="pro01" id="대운" checked="checked"><label for="대운"></label>대운<span class="gray">개인사주</span></li>
        <li class="order_price">+ 500개</li>
    </ul>
    
    <ul class="order_item">
    	<li class="order_name">
        	<input type="radio" name="pro01" id="신년"><label for="신년"></label>신년<span class="gray">개인사주</span>
        </li>
        <li class="order_price">+ 1000개</li>
    </ul>
    
    <ul class="order_item">
    	<li class="order_name">
        	<input type="radio" name="pro01" id="궁합"><label for="궁합"></label>궁합<span class="gray">상대방과의 관계</span>
        </li>
        <li class="order_price">+ 1000개</li>
    </ul>
    
    <ul class="order_item">
    	<li class="order_name">
        	<input type="radio" name="pro01" id="작명/개명"><label for="작명/개명"></label>작명/개명
        </li>
        <li class="order_price">+ 2000개</li>
    </ul>
    
    <ul class="order_item con_section_b_bot">
    	<li class="order_name">
        	<input type="radio" name="pro01" id="택일"><label for="택일"></label>택일
        </li>
        <li class="order_price">+ 1000개</li>
    </ul>

	<ul>
        	<a href="mail_write.php">
          	<button class="log_btn">상담하러 가기</button>
            </a>
    </ul>
</div>



<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
