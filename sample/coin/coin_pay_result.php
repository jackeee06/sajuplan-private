<?php
include_once('../common.php');
// 페이지 제목 
$g5['title'] = "코인충전 가상계좌 안내";
include_once(G5_THEME_MOBILE_PATH.'/head.php');
##################################################

/////////////////////////// 구글 결제 함수때문에 삽입 ////////////
$mode = $_REQUEST["mode"];
$order_id = $_REQUEST["order_id"];
$price = $_REQUEST["price"];
$item_id = $_REQUEST["item_id"];
$item_name = $_REQUEST["item_name"];
////////////////////////// 구글 결제 함수 때문에 삽입 끝 /////////





$mb_id	 = $_REQUEST["mb_id"];
$oid	= $_REQUEST["oid"];
$mb = get_member($mb_id);
if(!$mb["mb_id"]){
    ?>
    <script>
        alert("회원 정보가 없습니다.");
        location.href = "/";
    </script>
    <?
}


$strSQL = "SELECT *  FROM saju_payment WHERE Oid = '".$oid."'";
$rs = sql_fetch($strSQL);

if($rs["Oid"]){
    If($rs["PayMethod"] == "DIR_CARD") { //		'//카드결제 일때..
        //		Response.write "카드결제"
    }else{ //가상결제 일때...


        $key = array_search($rs["BankCd"], $bankName);
        $bank_name = $key;


        ?>
        <!-- 구글 통계함수 호출 -->
        <script>
            var mode = "<?=$mode?>";
            var item_name = "<?=$item_name?>";
            var item_id = "<?=$item_id?>";
            var price = "<?=$price?>";
            var order_id = "<?=$order_id?>";
            if(mode=="purchase"){
                g4_purchase(order_id, price, item_id, item_name);
            }
        </script>
        <!-- 구글 통계함수 호출 끝 -->
        <style>
            .account_notice { padding:20px; border-radius:8px; background-color:#f5f5f5; text-align:center;}

            .account_notice .account_price { font-size:18px; margin-bottom:4px; font-weight:600;}
            .account_notice .account_info { font-size:16px; font-weight:600;}
            .account_notice .account_info_02 { font-size:14px; margin-top:10px;}

            .account_notice .txt_wrap { text-align:left; padding-top:20px; margin-top:20px; border-top:1px solid #eee;}
        </style>

        <div id="wrap" class="con_section ">
            <div class="pop_coin_bank">
                <h3 style="text-align:center; margin:20px 0 20px; font-size:18px; line-height:24px;">가상계좌 발급이 완료되었습니다.<br /><span class="point">결제 마감시간까지 입금</span>해주세요</h3>
                <div class="pop_con">
                    <div class="section_inner">
                        <!--<strong class="txt">입금하실 가상계좌 확인</strong>-->

                        <div class="account_notice" id="account_notice">
                            <ul id="amt" class="account_price"><?=number_format($rs["Amount"])?>원</ul>
                            <ul id="bankcode" class="account_info"><?=$rs["banknm"]?> <?=$rs["VrNo"]?></ul>
                            <ul id="amt" class="account_info_02">신청일시: <?=$rs["od_time"]?></ul>

                            <div class="txt_wrap page_noti" style="">
                                <ul class="page_noti_item">입금 즉시 결제 금액 확인 및 코인이 충전 됩니다.</ul>
                                <ul class="page_noti_item mbottom0 red">위 가상계좌는 신청 하신 후 24시간 동안만 유효 합니다.</ul>
                            </div>




                            <div class="txt_wrap">
                                <span><a href="/coin/coin_history.php">결제내역으로</a></span>
                            </div>

                            <!--
					<ul>
						<li>
							<span class="txt1">계좌정보</span>
							<span class="txt2" id="bankcode"><?=$bank_name?> <?=$rs["VrNo"]?></span>
						</li>
						<li>
							<span class="txt1">입금금액</span>
							<span class="txt2" id="amt"><?=number_format($rs["Amount"])?></span>
						</li>
						<li>
							<span class="txt1">결제시간</span>
							<span class="txt2" id="amt"><?=$rs["od_time"]?></span>
						</li>
					</ul>
					-->

                        </div>

                    </div>
                </div>

            </div>

        </div>
        <!--        20250723 eun 10만원 이상 충전 팝업 띄우기-->

        <?
    }

}Else{		//'//주문정보가 없다면... 

    ?>
    <script>
        alert("주문정보가 없습니다.");
        location.href = "/";
    </script>

    <?
}
?>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?>