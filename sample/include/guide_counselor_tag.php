         
<!-- 코인충전>상담시간 계산 Modal -->
<div class="modal_guide">
 
	<!-- 첫 번째 Modal의 내용 -->
    <div class="modal_guide_content">
      	<span class="close_guide"><i class="xi-close-thin"></i></span>                         
	    <div class="modal_guide_content_title"></div>
        <div class="modal_guide_content_con">
        	<ul class="modal_guide_text_01 mbottom10">
            	<span class="point f_600">해시태그 이렇게 작성해 보세요!</span>
            </ul>
            
            <ul style="font-size:13px;">
            	<li style="margin-bottom:4px;">1. 해시태그를 사용해 고객들의 상담을 유도할 수 있습니다.</li>
            	<li style="margin-bottom:4px;">2. <span class="point f_600">가장 자신있는 상담의 주제, 해시태그</span>를 사용해 보세요.</li>
            	<li style="margin-bottom:10px;">3. 상담사의 <span class="point f_600">상담스타일</span>을 작성해도 좋아요.</li>
                
                <li>예시)</li>
                <li>상담주제: 애정운전문 <span style="opacity:.3;">/</span> #궁합전문가 <span style="opacity:.3;">/</span> #재회전문가</li>
                <li>상담스타일: 적중률높은 <span style="opacity:.3;">/</span> #냉철한 <span style="opacity:.3;">/</span> #친근한상담</li>
	        </ul>
        </div>
    </div>
</div>

<script>
// 안내 Modal을 가져옵니다.
var modal_guides = document.getElementsByClassName("modal_guide");
// 안내 Modal을 띄우는 클래스 이름을 가져옵니다.
var btns = document.getElementsByClassName("guide_pop_btn");
// 안내 Modal을 닫는 close 클래스를 가져옵니다.
var spanes = document.getElementsByClassName("close_guide");
var funcs = [];
 
// 안내 Modal을 띄우고 닫는 클릭 이벤트를 정의한 함수
function Modal_guides(num) {
  return function() {
    // 해당 클래스의 내용을 클릭하면 Modal을 띄웁니다.
    btns[num].onclick =  function() {
        modal_guides[num].style.display = "block";
        console.log(num);
    };
 
    // <span> 태그(X 버튼)를 클릭하면 Modal이 닫습니다.
    spanes[num].onclick = function() {
        modal_guides[num].style.display = "none";
    };
  };
}
 
// 원하는 안내 Modal 수만큼 Modal 함수를 호출해서 funcs 함수에 정의합니다.
for(var i = 0; i < btns.length; i++) {
  funcs[i] = Modal_guides(i);
}
 
// 원하는 안내 Modal 수만큼 funcs 함수를 호출합니다.
for(var j = 0; j < btns.length; j++) {
  funcs[j]();
}
 
// 안내 Modal 영역 밖을 클릭하면 Modal을 닫습니다.
window.onclick = function(event) {
  if (event.target.className == "modal_guide") {
      event.target.style.display = "none";
  }
};
	
</script>
 