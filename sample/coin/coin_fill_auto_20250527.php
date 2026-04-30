<?php 
include_once('../common.php'); 
//include_once("./_common.php"); // 메뉴별 공통파일
// 페이지 제목 
$g5['title'] = "포인트 충전";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
################################################################### 

//if(!$member["mb_id"]){
	//alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
//}

$cpid = $CPID;  //'본서비스 제공자가 부여한 CP사의 ID(필수)
$item = "상담"; //'상품명

$formurl = "https://sajumoon.co.kr/coin/coin_pay_ok.php"; //'카드 및 가상계좌 리턴 url
$returnurl = "https://sajumoon.co.kr/coin/coin_pay_bank_ok.php"; //'계좌번호 입금 정보 받을 리턴 url

$membid = $member["mb_1"]; //'본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수)

$telno = str_replace("-","",$member["mb_hp"]); //'회원전화번호(옵션)
$membnm =  $member["mb_name"];//'회원명(옵션)

//if($member["mb_level"]!="2"){
	//alert('회원만 결제할수 있습니다. 상담사는 관리자에게 문의 바랍니다!');
//}


//if(!$membid){
	//alert('passcall에 회원등록되어 있지 않습니다. 관리자에 문의 바랍니다.', '/');
//}

//if(!get_passcall_member($member["mb_1"])){


	//alert('passcall에 회원등록 되어있지않습니다. 관리자에게 문의 바랍니다!', '/');
//}

?> 

<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_coin.css" type="text/css">
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/coin.css" type="text/css">

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
//			url = "https://passcall.co.kr:28737/CPTL/Pay2/Card/pay.jsp";
//			 if (Mobile()){// 모바일일 경우
//				url = "https://passcall.co.kr:28737/CPTL/PayM/Card/pay.jsp";
//			} 

			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
			 if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
			} 
		} else if (str == "VBANK") {
			url = "https://passcall.co.kr:28737/CPTL/PayK/VrBank/pay.jsp";
			 if(Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/VrBank/pay.jsp";
			}
		}else if(str == "PAYCO"){
//			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
//			  if (Mobile()){// 모바일일 경우
//				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
//			 } 

			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
			 if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
			} 

		}else if(str == "KAKAO"){
//			url = "https://passcall.co.kr:28737/CPTL/Pay2/Kao/pay.jsp";
//			  if (Mobile()){// 모바일일 경우
//				url = "https://passcall.co.kr:28737/CPTL/PayM/Kao/pay.jsp";
//			 } 

			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
			 if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
			} 
		}else if(str == "NAVER"){
//			url = "https://passcall.co.kr:28737/CPTL/Pay2/Naver/pay.jsp";
//			  if (Mobile()){// 모바일일 경우
//				url = "https://passcall.co.kr:28737/CPTL/PayM/Naver/pay.jsp";
//			 } 
			url = "https://passcall.co.kr:28737/CPTL/PayK/GnrPc/pay.jsp";
			 if (Mobile()){// 모바일일 경우
				url = "https://passcall.co.kr:28737/CPTL/PayK/GnrMob/pay.jsp";
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
//			if (str == "CARD" || str == "PAYCO" || str=="KAKAO" || str=="NAVER") {
//				$("ul.tab_type2 li").eq(0).addClass("on");
//				$("ul.tab_type2 li").eq(1).removeClass("on");
//				$("#bank_wrap").hide();
//			} else {
//				$("ul.tab_type2 li").eq(0).removeClass("on");
//				$("ul.tab_type2 li").eq(1).addClass("on");
//				$("#bank_wrap").show();
//			}
		}
	}

	function pay_go(){

			var price = $("input[name='price']:checked").val();

			var coin = 0;

			  // 금액에 따라 포인트 갯수 다름.
			  if(price=="30000"){
				  //coin = price;
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
					//if ($("#bankcode").val() == "") { alert("결제 은행을 선택해 주세요."); $("#bankcode").focus(); return; }
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

<script type="text/javascript">

function auto_cancel_confirm(){
	
	if(!confirm('자동충전을 해지하시겠어요?')){
        return false;
    }
	
}
</script>



<style>
.top_nav_04 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}
</style>

<?php include_once("../include/point_navi.php"); ?>

<div class="con_section con_section_b_bot_02 my_coin" >

	<!-- 자동충전 미사용-->
	<ul class="white_bg">자동충전 미사용</ul>
    
    <!-- 자동충전 사용 중 -->
    <ul class="white_bg active">
    	<span class="point f_600">30,000 ⓟ</span> <span class="black f_600">자동충전</span> 사용중
        <button class="auto_cancel" onclick="auto_cancel_confirm()">해지하기</button>
    </ul>
    <!---->

    <ul class=" noti">
    	<p class="f_600">자동충전이란?</p>
        보유코인이 기준 잔액보다 낮아지면 상담중에도 바로 자동 충전되어 끊기지 않고 상담 가능합니다.
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

<div class="con_section coin_fill"> 

	<h3 class="cion_title">
    	기준잔액
    </h3>
    
<form name="frm" id="frm" method="post">    

<div class="divTable minimalistBlack">
	<div class="divTableBody amount">
    	
		<div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<!--<input type="radio" name="price" id="coinChk1" checked="checked" value="결제금액" onclick="disp_btn_amount('결제 버튼에 표시되는 금액')"/>-->
            	<input type="radio" name="amount" id="coinAmount1" checked="checked" value="10000" onclick="disp_btn_amount('10000')"/>
    			<label for="coinAmount1">10,000 ⓟ</label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="amount" id="coinAmount2" value="20000" onclick="disp_btn_amount('20000')"/>
    			<label for="coinAmount2">20,000 ⓟ</label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="amount" id="coinAmount3" value="30000" onclick="disp_btn_amount('30000')"/>
    			<label for="coinAmount3">30,000 ⓟ</label>
            </div>
  		</div>
	</div>
</div>
</form>
    
</div>

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
      		<div class="divTableCell coin_fill_name event">
            	<!--<input type="radio" name="price" id="coinChk1" checked="checked" value="결제금액" onclick="disp_btn_amount('결제 버튼에 표시되는 금액')"/>-->
            	<input type="radio" name="price" id="coinChk1" checked="checked" value="33000" onclick="disp_btn_amount('33,000')"/>
    			<label for="coinChk1">
                	30,000 <span class="f_500"> ⓟ</span>
                    <p class="coin_fill_bonus">
                    	+ 12<span>%</span>
                        <span class="coin_fill_text"><?php include(G5_PATH.'/include/coin_fill_text.php'); ?></span>
                    </p>
                    
                    <p class="coin_fill_price_pay">33,600<span class="f_500"> ⓟ</span></p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="price" id="coinChk2" value="55000" onclick="disp_btn_amount('55,000')"/>
    			<label for="coinChk2">
                	50,000 <span class="f_500"> ⓟ</span>            
	                <p class="coin_fill_bonus">
                    	+ 12<span>%</span>
                        <span class="coin_fill_text"><?php include(G5_PATH.'/include/coin_fill_text.php'); ?></span>
                    </p>
                    
                    <p class="coin_fill_price_pay">56,000<span class="f_500"> ⓟ</span></p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="price" id="coinChk3" value="110000" onclick="disp_btn_amount('110,000')"/>
    			<label for="coinChk3">
                	100,000 <span class="f_500"> ⓟ</span>
	                <p class="coin_fill_bonus">
                    	+ 12<span>%</span>
                        <span class="coin_fill_text"><?php include(G5_PATH.'/include/coin_fill_text.php'); ?></span>
                    </p>
                    
                    <p class="coin_fill_price_pay">112,000<span class="f_500"> ⓟ</span></p>
                </label>
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="price" id="coinChk4" value="220000" onclick="disp_btn_amount('220,000')"/>
    			<label for="coinChk4">
                	200,000 <span class="f_500"> ⓟ</span>
                    <p class="coin_fill_bonus">
                    	+ 12<span>%</span>
                        <span class="coin_fill_text"><?php include(G5_PATH.'/include/coin_fill_text.php'); ?></span>
                    </p>
                    
                    <p class="coin_fill_price_pay">224,000<span class="f_500"> ⓟ</span></p>
                </label>	
            </div>
  		</div>
        
        <div class="divTableRow coin_fill_item">
      		<div class="divTableCell coin_fill_name event">
            	<input type="radio" name="price" id="coinChk5" value="330000" onclick="disp_btn_amount('330,000')"/>
    			<label for="coinChk5">
                	300,000 <span class="f_500"> ⓟ</span>            
	                <p class="coin_fill_bonus">
                    	+ 12<span>%</span>
                        <span class="coin_fill_text"><?php include(G5_PATH.'/include/coin_fill_text.php'); ?></span>
                    </p>
                    
                    <p class="coin_fill_price_pay">336,000<span class="f_500"> ⓟ</span></p>
                </label>
            </div>
  		</div>

	</div>
</div>
</form>
    
</div>

<div class="wrap">
    <div class="search_box">
        <p>결제방법</p>
        <div class="check">
            <ul>
                <li style="padding-bottom:20px;">
                    <div>
                        <input type="radio" id="chk1" name="echk" value="1" style="margin-right: 5px; margin-bottom: 3px;" checked />
                        <label for="chk1"><span><img src="../img/common/pay.png" style=" display:inline-block; height: 24px; vertical-align: -5px; margin-right: 6px;" /></span>사주문페이</label>
                    </div>
                    <div class="sear check01">
                    	<div class="the_pay_wrap">
                        	<button class="the_pay" onclick="alert('준비중입니다.')">
	                            <div type="button" class="the_pay_btn">
    	                           <span class="the_pay_icon">
        	                           <img src="../img/common/pay.png" />
            	                       <i class="xi-plus"></i>
                	               </span>
                    	           <span class="the_pay_text">사주문페이를 추가하고 빠르게 결제하세요!</span>
                            	</div>
                            
                        	</button>
                        </div>
                    </div>
                </li>
                
            </ul>
        </div>
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

	<?php if(!$member["mb_id"]){ ?>
	<a onclick="alert('로그인 후 이용가능합니다.'); location.href='/bbs/login.php?url=<?=$urlencode?>';" onfocus="this.blur()" class="btn_type2">
	<? } else { ?>
	<a href="javascript:;" class="btn_type2" onclick="pay_go();">
	<? }?>
    
    <? if(!$is_member && !$is_admin) {?>
    <? }?>
	
    자동충전 설정하기<!--<span id="account_btn"></span>-->
    </a>
</div>

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