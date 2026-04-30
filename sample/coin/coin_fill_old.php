<?php 
include_once('../common.php'); 
include_once("./_common.php"); // 메뉴별 공통파일
// 페이지 제목 
//$g5['title'] = "포인트 충전";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
################################################################### 

if(!$member["mb_id"]){
	alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}

$cpid = $CPID;  //'본서비스 제공자가 부여한 CP사의 ID(필수)
$item = "상담"; //'상품명

$formurl = "https://sajumoon.co.kr/coin/coin_pay_ok.php"; //'카드 및 가상계좌 리턴 url
$returnurl = "https://sajumoon.co.kr/coin/coin_pay_bank_ok.php"; //'계좌번호 입금 정보 받을 리턴 url

$membid = $member["mb_1"]; //'본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수)

$telno = str_replace("-","",$member["mb_hp"]); //'회원전화번호(옵션)
$membnm =  $member["mb_name"];//'회원명(옵션)


if(!$membid){
	alert('passcall에 회원등록되어 있지 않습니다. 관리자에 문의 바랍니다.', '/');
}
//echo $membid;

?> 

<script language="javascript"> 
	function Mobile(){
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}
	


	function on_pay(str) {
		if ($("#amount").val() < 30000) { alert("최소 결제 금액은  30,000원입니다."); return; }
		
		//$("#amount").val(1000);

		var form = $("form[name='mobileweb']");
		var obj = form.find("[not_null]");

		for (var i = 0;  i < obj.length; i++) {
			if (obj.eq(i).val() == "")	{ alert("필수 입력값이 입력 되지 않았습니다."); return; }
		}

		var url = "";
		if (str == "CARD") {

			url = "https://passcall.co.kr:28737/CPTL/Pay2/Card/pay.jsp";
			 if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayM/Card/pay.jsp";
			} 

//https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp
//https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp
			
		} else if (str == "VBANK") {
			url = "https://passcall.co.kr:28737/CPTL/PayK/VrBank/pay.jsp";
			 if(Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/VrBank/pay.jsp";
			}
		}else if(str == "PAYCO"){
			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
			  if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
			 } 

			

		}else if(str == "KAKAO"){
			url = "https://passcall.co.kr:28737/CPTL/Pay2/Kao/pay.jsp";
			  if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayM/Kao/pay.jsp";
			 } 

			
		}else if(str == "NAVER"){
			url = "https://passcall.co.kr:28737/CPTL/Pay2/Naver/pay.jsp";
			  if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayM/Naver/pay.jsp";
			 } 
			

		} else { alert("결제 방식이 잘 못 되었습니다."); return; }

		var myform = document.mobileweb;

		myform.action = url;
		myform.submit(); 
	}

	function bankchange(val){
		if (val != "") { 
			$("#bank").val(val);
		}
	}

	function pay_method(str){
		if (str == "") { alert("결제 수단을 선택해 주세요."); return; }
		else { $("#paymethod").val(str);
			if (str == "CARD" || str == "PAYCO" || str=="KAKAO" || str=="NAVER") {
				$("ul.tab_type2 li").eq(0).addClass("on");
				$("ul.tab_type2 li").eq(1).removeClass("on");
				$("#bank_wrap").hide();
			} else {
				$("ul.tab_type2 li").eq(0).removeClass("on");
				$("ul.tab_type2 li").eq(1).addClass("on");
				$("#bank_wrap").show();
			}
		}
	}

	function pay_go(){

			var price = $("input[name='price']:checked").val();

			var coin = 0;

			  // 금액에 따라 포인트 갯수 다름.
			  if(price=="30000"){
				  coin = price;
			  }else if(price=="50000"){
				coin = (50000*0.02)+50000;

			  }else if(price=="100000"){
				  coin = (100000*0.04)+100000;
			  }else if(price=="200000"){
				  coin = (200000*0.06)+200000;
			  }else if(price=="300000"){
				  coin = (300000*0.08)+300000;
			  }


			if (price == "" || price == undefined) {	 alert("결제요금을 선택해 주세요."); return; }
			else {
				var paymethod = $("#paymethod").val();
				var orderNo = "";

				if (paymethod == "VBANK") {
					if ($("#bankcode").val() == "") { alert("결제 은행을 선택해 주세요."); $("#bankcode").focus(); return; }
					orderNo = $("#bankcode").val() + "_" + new Date().getTime();		//주문번호;
				} else {
					orderNo = "the_" + new Date().getTime();		//주문번호
				}
				
				$("input[name='amount']").val(price); /// 결제 금액
				
				$("input[name='coinamt']").val(coin); /// 포인트충전금액

				$("input[name='oid']").val(orderNo);
			}
		on_pay(paymethod);


	}
	$(document).ready(function(){
		$('input[name=price]').eq(2).prop('checked', true);
	});

	function disp_btn_amount(amount){
		$("#account_btn").html(amount);
	}

</script>
<style>
.top_nav_01 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}
</style>

<?php include_once("../include/point_navi.php"); ?>

<div class="con_section con_section_b_bot_02 my_coin" style="border-bottom-width: 1px;">
	<ul>
    	<li><img src="../img/common/icon_coin.png" />보유포인트</li>
        <li>
            <span class="my_point"><?echo number_format($member["mb_point"])?></span>ⓟ
        </li>
    </ul>
</div>

<!------ 공통내용 : 롤링배너  ------>
<?php //include_once("../etc/fix_banner.php"); ?>


<form name="mobileweb" id="mobileweb" method="post"> 
<input type="hidden" name="paymethod" id="paymethod" value="CARD" />
<input type="hidden" name="oid" id="oid" />  <!-- 요청사부여주문번호(필수) -->
<input type="hidden" name="cpid" id="cpid" value="<?=$cpid?>" />  <!-- 본서비스 제공자가 부여한 CP사의 ID(필수) -->
<input type="hidden" name="membid" id="membid" value="<?=$membid?>" />	<!-- 본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수) -->
<input type="hidden" name="amount" id="amount" value="0" /><!-- 결제대상금액(필수) -->
<input type="hidden" name="coinamt" id="coinamt" value="0" /><!-- 포인트충전금액 -->
<input type="hidden" name="membnm" id="membnm" value="<?=$membnm?>" /> <!-- 회원명(옵션) -->
<input type="hidden" name="item" id="item" value="<?=$item?>" />	<!-- 	=결제상품명(옵션) -->
<input type="hidden" name="telno" id="telno" value="<?=$telno?>" />	<!-- 회원전화번호(옵션) -->
<input type="hidden" name="formurl" id="formurl" value="<?=$formurl?>" />
<input type="hidden" name="bank" id="bank" value="" />
<input type="hidden" name="returnurl" id="returnurl" value="<?=$returnurl?>" />
</form>

 

<!--0405 : START-->
<div class="con_section con_section_b_bot_02 coin_fill"> 

	<h3 class="cion_title">
    	결제요금 선택 <span class="s_text">(VAT 별도)</span>
        
        <p class="guide_pop_btn point"><i class="xi-alarm-clock"></i> 상담시간 계산 <i class="xi-angle-right-min"></i></p>
        <!-- 상담시간 계산 안내 모달레이어 -->
		<?php include_once(G5_PATH.'/include/guide_coin_fill.php'); ?>
    </h3>
    
<form name="frm" id="frm" method="post">    
<div class="divTable minimalistBlack">
	<div class="divTableBody">
    	
		<div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name">
            	<input type="radio" name="price" id="coinChk1" checked="checked" value="30000" onclick="disp_btn_amount('30,000')"/>
    			<label for="coin_30000">
                	30,000 <span class="f_500"> ⓟ</span>
                    
                    <p class="coin_fill_price_pay">30,000원</p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name">
            	<input type="radio" name="price" id="coinChk2" value="50000" onclick="disp_btn_amount('50,000')"/>
    			<label for="coin_50000">
                	50,000 <span class="f_500"> ⓟ</span>            
	                <p class="coin_fill_bonus">+ 2<span>%</span></p>
                    
                    <p class="coin_fill_price_pay">50,000원</p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name">
            	<input type="radio" name="price" id="coinChk3" value="100000" onclick="disp_btn_amount('100,000')"/>
    			<label for="coin_100000">
                	100,000 <span class="f_500"> ⓟ</span>
	                <p class="coin_fill_bonus">+ 4<span>%</span></p>
                    
                    <p class="coin_fill_price_pay">100,000원</p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name">
            	<input type="radio" name="price" id="coinChk4" value="200000" onclick="disp_btn_amount('200,000')"/>
    			<label for="coin_200000">
                	200,000 <span class="f_500"> ⓟ</span>
                    <p class="coin_fill_bonus">+ 6<span>%</span></p>
                    
                    <p class="coin_fill_price_pay">200,000원</p>
                </label>	
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name">
            	<input type="radio" name="price" id="coinChk5" value="300000" onclick="disp_btn_amount('300,000')"/>
    			<label for="coin_300000">
                	300,000 <span class="f_500"> ⓟ</span>            
	                <p class="coin_fill_bonus">+ 8<span>%</span></p>
                    
                    <p class="coin_fill_price_pay">300,000원</p>
                </label>
            </div>
  		</div>

	</div>
</div>
</form>
    
</div>

<div class="con_section">

	<h3 class="cion_title">결제수단 선택</h3>

	<div class="bank_wrap" id="bank_wrap" style="display:none;">
		<div class="select_style2">
        	<select name="bankcode" id="bankcode" onchange="bankchange(this.value);">
            	<option value="">입금 은행을 선택해주세요</option>
				<? foreach($bankName as $bkey=>$bvalue){ ?>
				<option value="<?=$bvalue?>"><?=$bkey?></option>
				<? } ?>
            </select>
		</div>
    </div>
            
    <div class="pay_type_wrap">
		<a tabindex="0" type="button" id="pay_method_card" class="pay_type_btn" href="javascript:;" onclick="pay_method('CARD');" >
            <span>신용카드</span>
        </a>
		<a tabindex="0" type="button" id="pay_method_bank" class="pay_type_btn" href="javascript:;" onclick="pay_method('VBANK');" >
        	<span>가상계좌</span>
        </a>
		<a tabindex="0" type="button" id="pay_method_simple" class="pay_type_btn" href="javascript:;" onclick="pay_method('PAYCO');" >
        	<span>페이코</span>
        </a>
		<a tabindex="0" type="button" id="pay_method_simple" class="pay_type_btn" href="javascript:;" onclick="pay_method('KAKAO');" >
        	<span>카카오페이</span>
        </a>
		<a tabindex="0" type="button" id="pay_method_simple" class="pay_type_btn" href="javascript:;" onclick="pay_method('NAVER');" >
        	<span>네이버페이</span>
        </a>
    </div>


</div>



<!--<a href="#none" id="aClick" onclick="aClick();">text</a> -->



<!--0405 : END-->

<div class="con_section con_section_b_bot page_noti gray_bg" style=" padding-top:20px; padding-bottom: 80px;">
	<ul class="page_noti_item">
    충전 불편사항이나 직접 충전 신청은 "어플 내 고객문의게시판" 혹은 카카오톡 플러스친구 "사주문고객센터"로 연락주세요.
    </ul>
    
    <ul class="page_noti_item">
    상담 이용 후, 잔여 충전 시간은 <strong>부분환불이 불가</strong>합니다.
    </ul>
    
    <ul class="page_noti_item">
    충전 및 사용내역은 마이페이지에서 확인 가능합니다.
    </ul>
    
    <ul class="page_noti_item">
    위 표기된 금액은 부가세(10%) 별도 금액입니다.
	</ul>
</div>


<div class="bottom_btn up">
	<a href="javascript:;" class="btn_type2" onclick="pay_go();">
    <span id="account_btn">100,000원</span> 결제하기
    </a>
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
 
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>