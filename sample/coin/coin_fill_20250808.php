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


// 등록된 카드정보 불러오기 //
$billkey = "";
if($member["mb_id"]){
    $auto_card_data = member_auto_pay_card($member["mb_id"]);
    $billkey = $auto_card_data["billkey"];  /// 카드 등록 여부
}

$billkey = $auto_card_data["billkey"];  /// 카드 등록 여부
///
//20250808 eun 코인 충전 금액 관리자 페이지와 연동 시작
$tiers = [];
$q = "SELECT product_id, price, bonus_percent, total_point, message FROM account_config ORDER BY product_id";
$res = sql_query($q);
while ($r = sql_fetch_array($res)) {
    $r['pay_amount'] = (int) round($r['price'] * 1.1, 0); // VAT 포함 사용자 결제액
    $tiers[] = $r;
}
//20250808 eun 코인 충전 금액 관리자 페이지와 연동 마감
?>

    <script language="javascript">
        function Mobile(){
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }



        function on_pay(str) {

            var billkey = "<?=$billkey?>";

            if ($("#amount").val() < 30000) { alert("최소 결제 금액은  30,000원입니다."); return; }

            var form = $("form[name='mobileweb']");
            var obj = form.find("[not_null]");

            for (var i = 0;  i < obj.length; i++) {
                if (obj.eq(i).val() == "")	{ alert("필수 입력값이 입력 되지 않았습니다."); return; }
            }



            var url = "";
            var spaytype = "";

            url = "https://passcall.co.kr:32837/cptl/gnrc-pc/pay";

            if (Mobile()){// 모바일일 경우
                url = "https://passcall.co.kr:32837/cptl/gnrc-mob/pay";
            }

            if(str=="CARD"){
            }else if (str == "VBANK") {
                url = "https://passcall.co.kr:32837/cptl/gnrc-vrbank/pay";
            }else if(str=="APPLE"){
                spaytype = "applepay_direct";
                url = url+"?spaytype="+spaytype
            }else if(str == "PAYCO"){
                spaytype = "payco_direct";
                url = url+"?spaytype="+spaytype
            }else if(str == "KAKAO"){
                spaytype = "kakaopay_direct";
                url = url+"?spaytype="+spaytype
            }else if(str == "NAVER"){
                spaytype = "naverpay_direct";
                url = url+"?spaytype="+spaytype
            }else if(str=="AUTO_PAY_CARD"){  ///////// 등록된 카드결제
                url = "/coin/coin_pay_ok_auto.php";
                if(billkey==""){
                    alert('등록된 카드가 없습니다.');
                    return;
                }
            } else {
                alert("결제 방식이 잘 못 되었습니다."); return;
            }
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
            else {
                $("#paymethod").val(str);
            }
        }
// eun 아래 exc_coin이랑 dexc_coin 부분  연결된 값들 보기
        function exc_coin(price){
            if(!price)return;
            var coin = 0;
            // 금액에 따라 포인트 갯수 다름.
            if(price=="33000"){
                coin = (30000*0.12)+30000;
            }else if(price=="55000"){
                coin = (50000*0.12)+50000;
            }else if(price=="110000"){
                coin = (100000*0.12)+100000;
            }else if(price=="220000"){
                coin = (200000*0.12)+200000;
            }else if(price=="330000"){
                coin = (300000*0.12)+300000;
            }
            return coin;
        }

        function dexc_coin(price){
            if(!price)return;
            var coin = 0;
            // 금액에 따라 포인트 갯수 다름.
            if(price=="33000"){
                coin = price - 3000;
            }else if(price=="55000"){
                coin = price - 5000;
            }else if(price=="110000"){
                coin = price - 10000;;
            }else if(price=="220000"){
                coin = price - 20000;
            }else if(price=="330000"){
                coin = price-30000;
            }
            return coin;
        }
        //20250808 eun 포인트 충전 부분 수정
        const TIERS = <?=json_encode($tiers, JSON_UNESCAPED_UNICODE)?>;

        function pay_go(){

            var price = $("input[name='price']:checked").val();
            var coin = 0;
            coin = exc_coin(price);
            // 20250723 eun 결제 수단 비어있으면 alert 창 뜨도록 작업 시작
            if (price == "" || price == undefined) {
                alert("결제요금을 선택해 주세요.");
                return;
            }
            else {
                var paymethod = $("#paymethod").val();

                if (!paymethod){
                    alert("결제 수단을 선택해 주세요.");
                    return;
                }
                // 20250723 eun 결제 수단 비어있으면 alert 창 뜨도록 작업 마감

                var orderNo = "";
                if (paymethod == "VBANK") {
                    orderNo = $("#bankcode").val() + "_" + new Date().getTime();		//주문번호;
                } else {
                    orderNo = "the_" + new Date().getTime();		//주문번호
                }

                $("input[name='amount']").val(price); /// 결제 금액

                $("input[name='coinamt']").val(coin); /// 포인트충전금액

                $("input[name='oid']").val(orderNo);
            }
            on_pay(paymethod);
            g4_begin_checkout(price, orderNo,dexc_coin(price)+'포인트');


        }


        function add_auto_card(){
            var price = $("input[name='price']:checked").val();
            var coin = 0;
            coin = exc_coin(price);
            var amount = price;

            var telno = $("#telno").val();
            var orderNo = "the_" + new Date().getTime();		//주문번호

            location.href='/coin/coin_fill_auto_card.php?amount='+amount+'&coinamt='+coin+'&telno='+telno+'&oid='+orderNo;
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
        /*20250721 eun 사주문페이 설명 모달창 css 작업 시작*/
        /* 컨테이너를 기준으로 툴팁을 배치 */
        .review_guide {
            position: relative;
            display: inline-block;
            white-space: nowrap; /* 텍스트와 아이콘을 무조건 한 줄에 붙이기 */
        }
        .review_guide .xi-help-o {
            position: relative;
            z-index: 1001;
        }

        .tooltip {
            display: none;              /* 기본 숨김 */
            position: absolute;
            top: 50%;                   /* 아이콘 세로 중앙 */
            left: 100%;                 /* 아이콘 오른쪽 끝 */
            transform: translate(0, 0%);
            margin-left: 8px;           /* 아이콘과 간격 */
            z-index: 1000;
            pointer-events: auto;       /* 클릭 먹게 */
        }

        /* 툴팁 박스 */
        .tooltip-content {
            position: relative;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            display: inline-block;
            max-width: calc(100vw - 22px);
            box-sizing: border-box;
            right:15px;
            top:10px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            z-index: 1003;

            white-space: normal;         /* 공백/줄바꿈 허용 */
            overflow-wrap: break-word;   /* 필요하면 단어 중간에서도 줄바꿈 */
            word-wrap: break-word;
        }

        /* 닫기 버튼 (×) */
        .tooltip-close {
            position: absolute;
            top: 4px;
            right: 4px;
            margin-right: 5px;
            font-size: 16px;
            cursor: pointer;
            color: #666;
        }
        .tooltip-close:hover {
            color: #000;
        }
        .review_guide .tooltip-content {
            /* 기존 width/max-width 제거 */
            /* width: auto; */
            /* max-width: none; */

            /* 버튼 한 개와 똑같은 너비를 퍼센티지로 지정 */
            width: 180%;

            /* box-sizing: border-box; 는 기존 그대로 유지 */
            box-sizing: border-box;
        }
        /*20250721 eun 사주문페이 설명 모달창 css 작업 마감*/
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
        <!--    20250723 eun 결제수단 미선택 시 기본값 제거 작업 시작-->
        <input type="hidden" name="paymethod" id="paymethod" value="" />
        <!--    20250723 eun 결제수단 미선택 시 기본값 제거 작업 마감-->
        <input type="hidden" name="oid" id="oid" />  <!-- 요청사부여주문번호(필수) -->
        <input type="hidden" name="cpid" id="cpid" value="<?=$cpid?>" />  <!-- 본서비스 제공자가 부여한 CP사의 ID(필수) -->
        <input type="hidden" name="membid" id="membid" value="<?=$membid?>" />	<!-- 본서비스 제공자가 부여한 결제후 충전대상 회원 ID(필수) -->
        <input type="hidden" name="amount" id="amount" value="0" /><!-- 결제대상금액(필수) -->
        <input type="hidden" name="coinamt" id="coinamt" value="0" /><!-- 포인트충전금액 -->
        <input type="hidden" name="membnm" id="membnm" value="<?=urlencode($membnm)?>" /> <!-- 회원명(옵션) -->
        <input type="hidden" name="item" id="item" value="<?=urlencode($item)?>" />	<!-- 	=결제상품명(옵션) -->
        <input type="hidden" name="telno" id="telno" value="<?=$telno?>" />	<!-- 회원전화번호(옵션) -->
        <input type="hidden" name="formurl" id="formurl" value="<?=$formurl?>" />
        <input type="hidden" name="bank" id="bank" value="" />
        <input type="hidden" name="returnurl" id="returnurl" value="<?=$returnurl?>" />
        <!--    20250723 eun 10만 원 이상 팝업 작업 시작-->
        <input type="hidden" name="autopayflag" id="autopayflag" value="<?=$auto_card_data?>" />
        <!--    20250723 eun 10만 원 이상 팝업 작업 마감-->

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

    <!--20250721 eun 사주문페이 설명 모달창 작업 시작-->
    <div class="wrap">
        <div class="search_box">
            <p>결제방법</p>
            <div class="check">
                <ul>
                    <li>
                        <div>
                            <!--                           20250723 eun 사주문페이 기본 선택 변경 작업 시작-->
                            <input type="radio" id="chk1" name="echk" value="1" checked
                                   style="margin-right: 5px; margin-bottom: 3px;" onclick="pay_method('AUTO_PAY_CARD');"/>
                            <!--                           20250723 eun 사주문페이 기본 선택 변경 작업 마감-->

                            <label for="chk1">
                                <img src="../img/common/pay.png" style="display:inline-block; height:24px; vertical-align:-5px; margin-right:6px;"/>
                                사주문페이
                            </label>

                            <!-- review_guide: 인라인 블록, position:relative -->
                            <span class="review_guide">
                              <i id="payHelpBtn" class="xi-help-o" style="cursor:pointer;"></i>
                                <!-- 절대 위치로 띄울 툴팁 -->
                              <div id="payHelpModal" class="tooltip">
                                <div class="tooltip-content">
                                  <span id="payHelpClose" class="tooltip-close">&times;</span>
                                  <h2>사주문페이(Pay)란?</h2>
                                  <p>
                                    카드 한 번만 등록하면 결제는 더 쉽고 빠르게!<br/>
                                    개인정보는 안전하게 암호화되어 보호됩니다.
                                  </p>
                                </div>
                              </div>
                            </span>
                        </div>
                    </li>

                    <div class="sear check01" style="display: none;">
                        <div class="the_pay_wrap">

                            <?if(!$auto_card_data["billkey"]){?>
                                <button class="the_pay" onclick="add_auto_card();">
                                    <div type="button" class="the_pay_btn">
    	                           <span class="the_pay_icon">
        	                           <img src="../img/common/pay.png" />
            	                       <i class="xi-plus"></i>
                	               </span>
                                        <span class="the_pay_text">사주문페이를 추가하고 빠르게 결제하세요!</span>
                                    </div>
                                    <!--20250721 eun 사주문페이 설명 모달창 작업 마감-->

                                </button>
                            <?php }?>

                            <?php

                            if($auto_card_data["billkey"]){?>
                                <!-- 등록 후 -->
                                <div class="the_pay complete">
                                    <div class="the_pay_btn">
                                        <span class="the_pay_name">사주문페이</span>
                                        <span class="the_pay_del" onclick="call_confirm()"><i class="xi-close-thin"></i></span>
                                        <span class="the_pay_card"><?=$auto_card_data["card_nm"]?></span>
                                        <span class="the_pay_num"><?=$auto_card_data["card_no"]?></span>
                                    </div>

                                </div>

                                <script type="text/javascript">

                                    function call_confirm(){

                                        if(confirm("등록된 결제수단을 삭제하시겠습니까?\n\n결제수단을 삭제하면\n1. 사주문페이에 등록된 카드 삭제 처리\n2. 자동결제 서비스 이용 불가\n\n삭제 후 새로운 결제 수단을 등록해주셔야 사주문PAY 및 자동결제 서비스를 이용하실 수 있습니다.")){

                                            var membid = "<?=$membid?>";
                                            location.href='/coin/coin_fill_auto_card_del.php?membid='+membid;

                                        }else{
                                            return;
                                        }

                                    }
                                </script>

                            <?}?>




                        </div>
                    </div>
                    </li>
                    <li>
                        <!--                           20250723 eun 사주문페이 기본 선택 변경 작업 시작-->
                        <div>
                            <input type="radio" id="chk2" name="echk" value="2" style="margin-right: 5px; margin-bottom: 3px;"/>
                            <!--                           20250723 eun 사주문페이 기본 선택 변경 작업 마감-->
                            <label for="chk2">일반결제</label>
                        </div>
                        <div class="sear check02">
                            <div class="con_section" style=" padding:0;">

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

                                    <!--<a tabindex="0" type="button" id="pay_method_bank" class="pay_type_btn" href="javascript:;" onclick="alert('가상계좌 점검중입니다!');return false;" >
                                        <span>가상계좌</span>
                                    </a>-->

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

                <span id="account_btn">110,000원</span> 결제하기
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
                    // 20250723 eun 사주문페이 기본 선택  결제 수단 초기화 작업 시작
                    $("#paymethod").val("");
                    // 20250723 eun 사주문페이 기본 선택 시 결제 수단 초기화 작업 마감

                }
            });

            //20250723 eun 사주문페이 기본 선택 카드 추가 창 뜨도록 작업 시작
            $('input[name=echk]:checked').trigger('click');
            //20250723 eun 사주문페이 기본 선택 카드 추가 창 뜨도록 작업 마감
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

    <!-- NAVER 결제시작(begin_checkout) SCRIPT -->
    <script type="text/javascript" src="//wcs.naver.net/wcslog.js"></script>
    <script type='text/javascript'>
        if (window.wcs) {
            if(!wcs_add) var wcs_add = {};
            wcs_add["wa"] = "s_2e874f1d2162";
            var _conv = {};
            _conv.type = 'begin_checkout'; //(필수)
            wcs.trans(_conv);
        }
    </script>
    <!--20250721 eun 사주문페이 설명 모달창 작업 시작-->
    <script>
        const helpBtn  = document.getElementById('payHelpBtn');
        const modal    = document.getElementById('payHelpModal');
        const closeBtn = document.getElementById('payHelpClose');

        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.style.display = 'none';
        });

        // 페이지 어딘가 클릭되면 닫기
        document.addEventListener('click', e => {
            if (!e.target.closest('.review_guide')) {
                modal.style.display = 'none';
            }
        });

    </script>

    <!--20250721 eun 사주문페이 설명 모달창 작업 마감-->

<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>