<?php 
include_once('../common.php'); 
//include_once("./_common.php"); // 메뉴별 공통파일
// 페이지 제목 
$g5['title'] = "카드등록";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
################################################################### 

if(!$member["mb_id"]){
	alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}


$membid = $member["mb_1"]; //'본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수)
$membnm =  $member["mb_name"];//'회원명(옵션)
$amount=$_REQUEST["amount"];
$coinamt=$_REQUEST["coinamt"];
$telno=$_REQUEST["telno"];
$oid=$_REQUEST["oid"];
$mode=$_REQUEST["mode"];


if($mode =="auto_up" ){ ///////////////////////////////// 자동결제 회원 업데이트 일때
	?>
	<script>
		var amount = "<?=$amount?>";
		var coin = "<?=$coinamt?>";
		var membid = "<?=$membid?>";
		var telno = "<?=$telno?>";
		var url = '/coin/coin_fill_auto_card_member_update.php?amount='+amount+'&coinamt='+coin+'&membid='+membid+'&telno='+telno;		
		location.href=url;
	</script>
	<?
}
?> 

<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_coin.css" type="text/css">
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/coin.css" type="text/css">
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/mobile/skin/member/basic/style.css" type="text/css">


<?php //include_once("../include/point_navi.php"); ?>
<form name="caddform" id="caddform" method="post" action="./coin_fill_auto_card_update.php"> 
<input type="hidden" name="oid" id="oid" value="<?=$oid?>" />
<input type="hidden" name="membid" id="membid" value="<?=$membid?>" />
<input type="hidden" name="membnm" id="membnm" value="<?=$membnm?>" />
<input type="hidden" name="amount" id="amount" value="<?=$amount?>" />
<input type="hidden" name="coinamt" id="coinamt" value="<?=$coinamt?>" />
<input type="hidden" name="telno" id="telno" value="<?=$telno?>" />

<div class="con_section card_form" >
	<div class="card_form_item">
    	<ul class="card_form_title">생년월일 6자리 (예)981010</ul>
        <ul class="card_form_input">
        	<input class="w100" name="socno" id="socno" type="text" maxlength="6" />            
        </ul>
    </div>
    
    <div class="card_form_item">
    	<ul class="card_form_title">비밀번호 앞 2자리</ul>
        <ul class="card_form_input">
        	<input class="w100" type="text" name="pass" id="pass" maxlength="2" />            
        </ul>
    </div>
    
    <div class="card_form_item">
    	<ul class="card_form_title">유효기간</ul>
        <ul class="card_form_input">
        	<input class="w100" type="text" name="exp" id="exp" maxlength="4" />            
        </ul>
        <ul class="card_form_noti">월/년도(MMYY) 순서로 4자리 숫자</ul>
    </div>
    
    <div class="card_form_item">
    	<ul class="card_form_title">카드번호</ul>
        <ul class="card_form_input">
        	<input class="w25 cardno" type="text" name="cardno1" id="cardno1"  maxlength="4" />
            <input class="w25 cardno" type="text" name="cardno2" id="cardno2"  maxlength="4" />
            <input class="w25 cardno" type="text" name="cardno3" id="cardno3"  maxlength="4" />
            <input class="w25 cardno" type="text" name="cardno4" id="cardno4" maxlength="4" />
        </ul>
        
		<select name="card_name" id="card_name">
			<option value="">카드선택</option>
			<option value="KB국민카드">KB국민카드</option>
			<option value="신한카드">신한카드</option>
			<option value="하나카드">하나카드</option>
			<option value="롯데카드">롯데카드</option>
			<option value="삼성카드">삼성카드</option>
			<option value="현대카드">현대카드</option>
			<option value="BC카드">BC카드</option>
			<option value="NH농협카드">NH농협카드</option>
			<option value="카카오뱅크">카카오뱅크</option>
			<option value="토스뱅크">토스뱅크</option>
			<option value="IBK기업은행">IBK기업은행</option>
			<option value="우리카드">우리카드</option>
			<option value="SC제일은행">SC제일은행</option>
			<option value="한국씨티은행">한국씨티은행</option>
			<option value="케이뱅크">케이뱅크</option>
		</select>
    </div>

</div>




<style>
.haed_menu,
.search,
.tail_wrap { display:none;}
.bottom_btn.up { bottom:0; }
.btn_gotop_btn, .btn_gokakao_btn { display:none !important; }
</style>

<div class="bottom_btn up">
         
                
	<div class="terms">
    	<input type="checkbox" name="agree_auto" value="Y" checked/>
        <span class="text left">
    	자동 결제 정보수집 및 제공 내용을 확인하였으며 이에 동의합니다.
        </span>
        <i class="xi-angle-right guide_pop_btn"></i>
    </div>
    
	<a href="javascript:;" class="btn_type2 point_bg" onclick="reg_card();">확인</a>
</div>

</form>



<script>
		
$(function(){
	
	$(".card_form_input input").on("input", function() {
            let inputField = $(this);
            let filteredValue = inputField.val().replace(/[^0-9\*]/g, ""); // 숫자와 '*'만 허용
            inputField.val(filteredValue); // 필터링된 값 적용
        });
    
	
	$("#exp").on("input", function() {
            $(this).val($(this).val().replace(/\D/g, "")); // 숫자가 아닌 문자 제거
     });

	$(".cardno").on("keydown", function(e) {
			var maxLength = $(this).attr("maxlength"); // 입력 필드의 최대 길이 확인
			if ($(this).val().length >= maxLength) { // 4자리 숫자 입력 확인
                $(this).next(".cardno").focus(); // 다음 입력 필드로 포커스 이동
            }
            if (e.key === "Backspace" && $(this).val().length === 0) {
                $(this).prev(".cardno").focus(); // 이전 입력 필드로 포커스 이동
            }
     });


      $("input[name='agree_auto']").change(function() {
            if (!$(this).is(":checked")) {
                alert("결제수집정보에 동의하지 않으면 카드등록을 할수없습니다.");
                $(this).prop("checked", true); // 체크박스를 다시 체크 상태로 변경
            }
        });



});		  
</script>


<style>
    .masked {
        color: black !important;  /* 별표를 검은색으로 표시 */
        font-weight: bold;
        font-size: 20px; /* 글자 크기 증가 */
        letter-spacing: 2px; /* 글자 간격 조정 */
    }
</style>


<script>
    $(document).ready(function() {
        // 입력값을 숫자로 제한하고 1초 후 별표 변환
        $(".card_form_input input").on("input", function() {
            let inputField = $(this);
            let originalValue = inputField.val().replace(/\D/g, ""); // 숫자만 허용

            inputField.attr("data-real-value", originalValue); // 실제 값 저장

            // 1초 후 별표 표시
            setTimeout(function() {
                if (!inputField.is(":focus")) { // 포커스 중이면 변환하지 않음
                    inputField.val("*".repeat(originalValue.length));
                }
            }, 1000);
        });

        // 포커스 시 원래 값 표시
        $(".card_form_input input").on("focus", function() {
            let originalValue = $(this).attr("data-real-value");
            if (originalValue) {
                $(this).val(originalValue);
            }
        });

        // 포커스 잃으면 다시 별표 표시
        $(".card_form_input input").on("blur", function() {
            let originalValue = $(this).attr("data-real-value");
            if (originalValue) {
                $(this).val("*".repeat(originalValue.length));
            }
        });

    });
</script>


<script>
function reg_card(){

		if(!$("#socno").val()){
			alert('생년월일 6자리를 입력해주세요!');
			$("#socno").focus();
			return false;
		}
		if(!$("#pass").val()){
			alert('비밀번호앞자리2자리 입력해주세요!');
			$("#pass").focus();
			return false;
		}
		if(!$("#exp").val()){
			alert('유효기간을 입력해주세요!');
			$("#exp").focus();
			return false;
		}

		if(!$("#cardno1").val()){
			alert('카드번호 4자리를 입력해주세요!');
			$("#cardno1").focus();
			return false;
		}
		if(!$("#cardno2").val()){
			alert('카드번호 4자리를 입력해주세요!');
			$("#cardno2").focus();
			return false;
		}
		if(!$("#cardno3").val()){
			alert('카드번호 4자리를 입력해주세요!');
			$("#cardno3").focus();
			return false;
		}
		if(!$("#cardno4").val()){
			alert('카드번호 4자리를 입력해주세요!');
			$("#cardno4").focus();
			return false;
		}

		if(!$("#card_name").val()){
			alert('해당 카드를 선택해주세요!');
			$("#card_name").focus();
			return false;
		}

		  $(".card_form_input input").each(function() {
                let originalValue = $(this).attr("data-real-value");
                if (originalValue) {
                    $(this).val(originalValue); // 원래 숫자로 복구
                }
            });


		var myform = document.caddform;
		myform.submit(); 

}
</script>

<?php include_once(G5_PATH.'/include/coin_fill_auto_card_terms.php'); ?>

<script>
  /*휴대폰, 이메일 input:radio 선택*/
  $(document).ready(function(){
      // 라디오버튼 클릭시 이벤트 발생
      $("input:radio[name=echk]").click(function(){
          if($("input[name=echk]:checked").val() == "1"){
              // radio 버튼의 value 값이 1이라면 
              $(".check01").css("display","block");
              $(".check02").css("display","none");
              
          }else if($("input[name=echk]:checked").val() == "2"){
              // radio 버튼의 value 값이 2이라면 
              $(".check01").css("display","none");
              $(".check02").css("display","block");
          }
      }); 
  });
</script> 


    
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
 
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>