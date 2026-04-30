<?php
include_once('../common.php');
//include_once("./_common.php"); // 메뉴별 공통파일
// 페이지 제목
$g5['title'] = "포인트 충전";

include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php');
###################################################################

if(!$member["mb_id"]){
    alert('로그인하셔야합니다.','/bbs/login.php?url='.urlencode($_SERVER["REQUEST_URI"]));
}

$item = "상담"; //'상품명

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
$autopayflag = $auto_card_data["autopayflag"];  /// 자동결제 여부

//20250723 eun 10만 원 이상 결제 팝업 작업 시작
$mode = $_GET["mode"];
$order_id = $_GET["order_id"];
$amount = $_GET["amount"];
//20250723 eun 10만 원 이상 결제 팝업 작업 마감

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

    <!-- 하단 메뉴 HOVER -->
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_coin.css" type="text/css">
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/coin.css" type="text/css">

    <script type="text/javascript">

        function auto_cancel_confirm(){
            if(confirm('자동충전을 해지하시겠어요?')){
                var membid = "<?=$membid?>";
                var telno = $("#telno").val();
                var url = '/coin/coin_fill_auto_card_member_update.php?mode=auto_del&membid='+membid+'&telno='+telno;
                location.href=url;
            }
        }

        function add_auto_card(mode){

            var billkey = "<?=$billkey?>";
            var price = $("input[name='price']:checked").val();
            var amount = dexc_coin(price);
            var coin = 0;
            coin = exc_coin(price);
            var telno = $("#telno").val();
            var orderNo = "the_" + new Date().getTime();		//주문번호

            var mode=mode;

            if(mode && !billkey){
                alert('카드가 등록되어 있지않습니다. 카드등록을 해주세요!');
                return;
            }

            var url = '/coin/coin_fill_auto_card.php?amount='+amount+'&coinamt='+coin+'&telno='+telno+'&oid='+orderNo+'&mode='+mode;

            location.href=url;

        }

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
    </script>

    <style>
        .top_nav_04 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}
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

    <div class="con_section con_section_b_bot_02 my_coin" >

        <?if($autopayflag!="Y"){?>
            <!-- 자동충전 미사용-->
            <ul class="white_bg">자동충전 미사용</ul>
        <?}else{?>
            <!-- 자동충전 사용 중 -->
            <ul class="white_bg active">
                <span class="point f_600"><?=number_format($auto_card_data["amount"])?> ⓟ</span> <span class="black f_600">자동충전</span> 사용중

                <button class="auto_cancel" onclick="auto_cancel_confirm()">해지하기</button>
            </ul>
            <!---->
        <?}?>

        <ul class=" noti">
            <p class="f_600">자동충전이란?</p>
            보유코인이 기준 잔액보다 낮아지면 상담중에도 바로 자동 충전되어 끊기지 않고 상담 가능합니다.
        </ul>
    </div>



    <form name="mobileweb" id="mobileweb" method="post">
        <input type="hidden" name="paymethod" id="paymethod" value="CARD" />
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
    </form>


    <!--0405 : START-->

    <style>
        /* ===== 기준잔액 ===== */
        .base_amount_wrap {
            background: #fff;
            border-radius: 14px;
            padding: 16px;
            margin: 0 0 10px;
        }
        .base_amount_wrap .ba_title {
            font-size: 14px;
            font-weight: 700;
            color: #555;
            margin-bottom: 10px;
        }
        .base_amount_wrap input[type=radio] { display: none; }
        .base_amount_wrap label {
            display: inline-block;
            padding: 8px 20px;
            border: 2px solid #e84263;
            border-radius: 20px;
            font-size: 15px;
            font-weight: 700;
            color: #e84263;
            cursor: pointer;
        }

        /* ===== 결제요금 카드 그리드 ===== */
        .tier_wrap {
            background: #fff;
            border-radius: 14px;
            padding: 16px 16px 20px;
            margin: 0 0 10px;
        }
        .tier_wrap_title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
        }
        .tier_wrap_title .tw_main {
            font-size: 15px;
            font-weight: 800;
            color: #111;
        }
        .tier_wrap_title .tw_vat {
            font-size: 12px;
            color: #aaa;
        }
        .tier_guide_btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 600;
            color: #e84263;
            background: #fff0f4;
            border: none;
            border-radius: 20px;
            padding: 5px 12px;
            cursor: pointer;
            margin-top: 2px;
        }

        /* 그리드 */
        .tier_grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        .tier_grid input[type=radio] { display: none; }

        .tier_card {
            position: relative;
            border: 2px solid #eee;
            border-radius: 14px;
            padding: 16px 12px 14px;
            background: #fafafa;
            cursor: pointer;
            text-align: center;
            transition: border-color .2s, background .2s, box-shadow .2s;
            overflow: hidden;
        }
        /* 선택 */
        .tier_grid input[type=radio]:checked + .tier_card {
            border-color: #e84263;
            background: #fff8fa;
            box-shadow: 0 4px 16px rgba(232,66,99,.13);
        }
        /* 선택 체크 */
        .tier_grid input[type=radio]:checked + .tier_card::after {
            content: '✓';
            position: absolute;
            top: 7px;
            left: 10px;
            font-size: 12px;
            font-weight: 900;
            color: #e84263;
        }
        /* 리본 뱃지 */
        .tier_card .tc_badge {
            position: absolute;
            top: 0; right: 0;
            background: #e84263;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: 0 12px 0 8px;
            line-height: 1.5;
        }
        /* 가격 */
        .tc_price {
            font-size: 19px;
            font-weight: 900;
            color: #111;
            line-height: 1.2;
            margin-bottom: 6px;
        }
        .tc_price .unit { font-size: 13px; font-weight: 500; color: #666; }
        /* 보너스 */
        .tc_bonus {
            display: inline-block;
            font-size: 12px;
            font-weight: 800;
            color: #e84263;
            background: #fff0f4;
            border-radius: 20px;
            padding: 2px 10px;
            margin-bottom: 6px;
        }
        /* 합계 */
        .tc_total {
            font-size: 11px;
            color: #999;
            line-height: 1.4;
        }
        .tc_total strong {
            font-size: 12px;
            font-weight: 700;
            color: #555;
        }
    </style>

    <!-- 기준잔액 -->
    <div class="base_amount_wrap">
        <p class="ba_title">기준잔액</p>
        <form name="frm_amount" id="frm_amount" method="post">
            <input type="radio" name="amount" id="coinAmount1" checked="checked" value="10000" />
            <label for="coinAmount1">10,000 ⓟ</label>
        </form>
    </div>

    <!-- 결제요금 선택 -->
    <div class="tier_wrap">
        <div class="tier_wrap_title">
            <span class="tw_main">결제요금 선택</span>
            <span style="display:flex;align-items:center;gap:6px;">
                <span class="tw_vat">VAT 별도</span>
                <p class="tier_guide_btn guide_pop_btn point"><i class="xi-alarm-clock"></i> 상담시간 계산</p>
            </span>
        </div>
        <!-- 상담시간 계산 안내 모달레이어 -->
        <?php include_once(G5_PATH.'/include/guide_coin_fill.php'); ?>

        <form name="frm" id="frm" method="post">
            <div class="tier_grid">
                <?php foreach ($tiers as $i => $t): ?>
                    <input type="radio"
                           name="price"
                           id="coinChk<?=$t['product_id']?>"
                           value="<?=$t['pay_amount']?>"
                           <?=$i===2 ? 'checked' : ''?>
                           onclick="disp_btn_amount('<?=number_format($t['price'])?>');" />
                    <label class="tier_card" for="coinChk<?=$t['product_id']?>">
                        <?php if(!empty($t['message'])): ?>
                            <!-- <span class="tc_badge"><?=$t['message']?></span> -->
                        <?php endif; ?>
                        <div class="tc_price">
                            <?=number_format($t['price'])?><span class="unit"> ⓟ</span>
                        </div>
                        <div class="tc_bonus">+<?=$t['bonus_percent']?>%</div>
                        <div class="tc_total">
                            합계 <strong><?=number_format($t['total_point'])?> ⓟ</strong>
                        </div>
                    </label>
                <?php endforeach; ?>
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
                            <!--20250722 eun 자동 충전 부분 사주문페이 모달 작업 시작-->
                            <!-- review_guide: 인라인 블록, position:relative -->
                            <span class="review_guide">
                              <i id="payHelpBtn" class="xi-help-o" style="cursor:pointer;"></i>
                                <!-- 절대 위치로 띄울 툴팁 -->
                              <div id="payHelpModal" class="tooltip">
                                <div class="tooltip-content">
                                  <span id="payHelpClose" class="tooltip-close">&times;</span>
<!--                                  <h2>사주문페이(Pay)란?</h2>-->
                                  <p>
<!--                                    카드 한 번만 등록하면 결제는 더 쉽고 빠르게!<br/>-->
<!--                                    개인정보는 안전하게 암호화되어 보호됩니다.-->
                                      ▶ 첫 결제 시 포인트 50% 추가 적립! <br/>(최초 1회 결제에 한해 제공되는 혜택입니다)
                                      
                                  </p>
                                </div>
                              </div>
                            </span>
                            <!--20250722 eun 사주문페이 설명 모달창 작업 마감-->
                        </div>
                        <div class="sear check01">
                            <div class="the_pay_wrap">

                                <?if(!$billkey){?>
                                    <!-- 등록 전 -->
                                    <button class="the_pay" onclick="add_auto_card('');">
                                        <div type="button" class="the_pay_btn">
    	                           <span class="the_pay_icon">
        	                           <img src="../img/common/pay.png" />
            	                       <i class="xi-plus"></i>
                	               </span>
                                            <span class="the_pay_text">사주문페이를 추가하고 빠르게 결제하세요!</span>
                                        </div>
                                    </button>
                                <?}else{?>

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

            <a href="javascript:;" class="btn_type2" onclick="add_auto_card('auto_up');">
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
    <!--20250722 eun 사주문페이 설명 모달창 작업 마감-->
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

    <!--20250722 eun 사주문페이 설명 모달창 작업 마감-->
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>