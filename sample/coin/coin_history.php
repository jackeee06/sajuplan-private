<?php
include_once('../common.php');
$g5['title'] = "포인트내역";
include_once(G5_THEME_MOBILE_PATH.'/head.php');
###########################################################

/////////////////////////// 구글 결제 함수때문에 삽입 ////////////
$mode = $_REQUEST["mode"];
$order_id = $_REQUEST["order_id"];
$price = $_REQUEST["price"];
$item_id = $_REQUEST["item_id"];
$item_name = $_REQUEST["item_name"];
////////////////////////// 구글 결제 함수 때문에 삽입 끝 /////////

/// 20250723 eun 10만원 이상 충전 고객 자동 충전 팝업 작업 시작
// 결제 완료 직후 리다이렉트 시 GET으로 넘어오는 값
$auto_card_data = member_auto_pay_card($member['mb_id']);
$amount = $_GET["amount"]; //충전 금액
$order_id = $_GET["order_id"];
$autopayflag = $auto_card_data["autopayflag"]; //자동 충전 사용하는지 여부
//$billkey = $_REQUEST["billkey"];  //사주문페이 결제 정보

/// 20250723 eun 10만원 이상 충전 고객 자동 충전 팝업 작업 마감

$sql_common = " from saju_payment";

$sql_search = " where (1) and mb_id='".$member["mb_id"]."'";
if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'mb_tel' :
        case 'mb_hp' :
            $sql_search .= " ({$sfl} like '%{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}


if (!$sst) {
    $sst = "od_time";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = 10;
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함



$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";

//echo $sql;


$result = sql_query($sql);

?>

    <!-- 구글 통계함수 호출 -->
    <script>
        var mode = "<?=$mode?>";
        var item_name = "<?=$item_name?>";
        var item_id = "<?=$item_id?>";
        var price = "<?=$price?>";
        var order_id = "<?=$order_id?>";
        if(mode=="purchase"){
            try{
                g4_purchase_new(order_id, price, item_id, item_name);
            }catch (e) {
                console.log(e);
            }
            g4_purchase(order_id, price, item_id, item_name);
        }
    </script>
    <!-- 구글 통계함수 호출 끝 -->
    <style>
        .top_nav_03 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}
        /*20250723 eun 10만원 이상 결제 팝업 작업 시작*/
        /* 오버레이 기본 숨김 & 페이드인/아웃 */
        .coin_fill_modal {
            display: none;
            transition: opacity 0.3s ease;

        }
        .coin_fill_modal.show {
            display: flex;
            opacity: 1;
        }

        /* 실제 모달 박스 */
        .coin_modal {
            position: absolute;
            max-width: 320px;
            width: 100%;
            top: 38%;
            left: 50%;
            transform: translate(-50%);
            border-radius: 10px;
            background: #fff;
            padding: 40px 20px 20px;
            opacity: 0;
            transition: all 0.4s ease;
            box-shadow: 0 8px 32px 0 rgba(60,70,110,0.18), 0 1.5px 6px 0 rgba(20,25,40,0.07);
        }
        .coin_fill_modal.show .coin_modal {
            top: 40%;
            opacity: 1;
        }

        /* 헤더 */
        .coin_modal .modal-head {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            text-align: center;
        }
        .coin_modal .coin_fill_modal-head p {
            font-size: 18px;
            font-weight: 600;
            width: 100%;
        }

        /* 본문 */
        .coin_modal .coin_fill_modal-body {
            margin-bottom: 30px;
            text-align: center;
        }
        .coin_modal .coin_fill_modal-body p {
            font-size: 15px;
            font-weight: 400;
            color: #333333;
        }

        /* 푸터(버튼 그룹) */
        .coin_modal .coin_fill_modal-footer {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .coin_modal .coin_fill_modal-footer button {
            width: 100%;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            padding: 15px;
        }
        .coin_modal .coin_fill_modal-footer button.cancle-btn {
            background-color: #F5F5F5;
            color: #545454;
        }
        .coin_modal .coin_fill_modal-footer button.color-btn {
            background-color: #E84263;
            color: #fff;
        }
        /*20250723 eun 10만원 이상 결제 팝업 작업 마감*/
    </style>

<?php include_once("../include/point_history_navi.php"); ?>

    <div class="con_section con_section_b_bot_02 my_coin" style="display:none;">
        <ul>
            <li><img src="../img/common/icon_coin.png">보유포인트</li>
            <li>
                <span class="my_point">100</span>포인트
            </li>
        </ul>
    </div>


    <div class="con_section" style="margin-top:10px;" >

        <div class="list_wrap">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">

                <tr>
                    <th scope="col">일자</th>
                    <th scope="col">결제방법</th>
                    <th scope="col">결제금액</th>
                    <th scope="col">상태</th>
                </tr>

                <?php
                for ($i=0; $row=sql_fetch_array($result); $i++) {

                    ?>

                    <tr>
                        <td scope="row"><?=substr($row["od_time"],0,10)?></td>
                        <td>
                            <?


                            $order_paytype = "";

                            if($row["PayMethod"]=="DIR_CARD" || strpos($row["PayMethod"], 'PACA')!==false){
                                echo $order_paytype ="카드결제";
                            }elseif($row["PayMethod"]=="PAYCO_PAY" ||  strpos($row["PayMethod"], 'PACP')!==false){
                                echo $order_paytype ="페이코간편결제";
                            }elseif($row["PayMethod"]=="KAKAO_PAY" || strpos($row["PayMethod"], 'PAKM')!==false){
                                echo $order_paytype ="카카오결제";
                            }elseif($row["PayMethod"]=="NAVER_PAY" ||  strpos($row["PayMethod"], 'PANP')!==false){
                                echo $order_paytype ="네이버결제";
                            }elseif(strpos($row["PayMethod"], 'PABK')!==false){
                                echo $order_paytype ="계좌이체";
                            }elseif(strpos($row["PayMethod"], 'PATK')!==false){
                                echo $order_paytype ="상품권";
                            }elseif(strpos($row["PayMethod"], 'PAVC')!==false || strpos($row["PayMethod"], 'VRBANK')!==false){
                                echo $order_paytype ="가상결제";
                            }elseif(strpos($row["PayMethod"], 'PAMC')!==false){
                                echo $order_paytype ="휴대폰";
                            }elseif(strpos($row["PayMethod"], 'PAPT')!==false){
                                echo $order_paytype ="포인트";
                            }else{

                                echo $order_paytype ="카드결제";
                            }


                            ?>

                            <?if($card_flag==false){?>
                            <span class="info_more point_bo point glyphicon-plus plusIcon">보기</span>
                            <span class="info_more point_bo point glyphicon-minus plusIcon" style="display:none">보기</span></td>
                        <?}?>
                        </td>
                        <td class="price"><?=number_format($row["Amount"])?>원</td>
                        <td class="">
                            <?
                            $color = "black";
                            if($row["ResultMsg"]=="입금완료"){
                                $color = "red";
                            }
                            ?>
                            <span style="color:<?=$color?>;">
						<?
                        if($row["ResultMsg"]=="processing completed" || $row["ResultMsg"]=="ok"){
                            echo "입금완료";
                        }else{
                            if($order_paytype!="가상결제"){
                                echo $row["ResultMsg"];
                            }else{
                                if($row["ResultMsg"]=="정상처리"){
                                    echo "입금전";
                                }else{
                                    echo $row["ResultMsg"];
                                }
                            }
                        }?>
					</span>

                        </td>
                    </tr>

                    <?if($card_flag==false){

                        $bankname = "";
                        $bankname = $row["banknm"];


                        ?>
                        <tr <?if($i>0){?>style="display:none"<?}else{?>style="display:"<?}?>>
                            <td colspan="4" class="info_more_con_wrap">

                                <div class="info_more_con" style="">

                                    <ul>

                                        <h4><?if(strpos($row["PayMethod"], 'PAVC')!==false || strpos($row["PayMethod"], 'VRBANK')!==false){?>가상계좌안내<?}?></h4>
                                        <?if(strpos($row["PayMethod"], 'PAVC')!==false || strpos($row["PayMethod"], 'VRBANK')!==false){?>
                                            <dl>
                                                <dt>계좌정보</dt>
                                                <dd><?=$bankname?> &nbsp; <?=$row["VrNo"]?></dd>
                                            </dl>
                                        <?}?>


                                        <dl>
                                            <dt>입금금액</dt>
                                            <dd><?=number_format($row["Amount"])?>원</dd>
                                        </dl>
                                        <?if(strpos($row["PayMethod"], 'PAVC')!==false || strpos($row["PayMethod"], 'VRBANK')!==false){?>
                                            <dl>
                                                <dt>예금주</dt>
                                                <dd>(주)엠투넷</dd>
                                            </dl>
                                            <dl>
                                                <dt>입금 마감일</dt>
                                                <dd>
                                                    <?
                                                    $ddy  = date("Y-m-d H:i:s",strtotime($row["od_time"], "+1 days"));
                                                    echo $ddy;
                                                    ?>
                                                </dd>
                                            </dl>
                                        <?}else{?>
                                            <dl>
                                                <dt>입금일</dt>
                                                <dd>
                                                    <?
                                                    echo  $row["od_time"];

                                                    ?>
                                                </dd>
                                            </dl>
                                        <?}?>
                                    </ul>
                                    <!-- 202507023 eun 자동충전 팝업 띄우기 작업 시작-->
                                    <ul class="info_more_text">
                                        <li>입금 즉시 결제 금액 확인 및 포인트가 충전 됩니다.</li>
                                        <!-- 202507023 eun 자동충전 팝업 띄우기 작업 마감-->
                                        <?if(strpos($row["PayMethod"], 'PAVC')!==false || strpos($row["PayMethod"], 'VRBANK')!==false){?>
                                            <li>※ 위 가상계좌는 신청 하신 후 24시간 동안만 유효 합니다.</li>
                                        <?}?>
                                    </ul>


                                </div>
                            </td>
                        </tr>
                    <?}?>




                    <?php
                }
                if ($i == 0)
                    echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
                ?>


            </table>
        </div>
        <!--20250723 eun 10만 원 이상 충전 고객 팝업 작업 시작-->
        <div class="coin_fill_modal" style=" box-shadow: 0 8px 32px 0 rgba(60,70,110,0.18), 0 1.5px 6px 0 rgba(20,25,40,0.07);">
            <div class="coin_modal" id="autoChargeModal">
                <div class="coin_fill_modal-head">
                    <p style="text-align:center;">자동 충전 등록<br/><br/></p>
                </div>
                <div class="coin_fill_modal-body"> <p><?php echo $member['mb_nick'] ?>님,
                    <p>자동 충전을 등록하시겠습니까?</p>
                </div>
                <div class="coin_fill_modal-footer">
                    <button class="color-btn" id="modalYes"
                            onclick="location.href='/coin/coin_fill_auto.php?mode=coin_fill_auto&order_id=<?= urlencode($order_id) ?>&amount=<?= $amount ?>'">등록하기</button>
                    <button class="cancle-btn" id="modalNo"  onclick="document.querySelector('.coin_fill_modal').classList.remove('show')">취소</button>
                </div>
            </div>
        </div>
        <!--20250723 eun 10만 원 이상 충전 고객 팝업 작업 마감-->

        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>



        <script>
            $(".plusIcon").on("click",function(){
                var obj = $(this);
                if( obj.hasClass("glyphicon-plus") ){
                    obj.hide();
                    obj.next().show();
                    obj.parent().parent().next().show();
                }else{
                    obj.hide();
                    obj.prev().show();
                    obj.parent().parent().next().hide();
                }
            });
        </script>
        <!--20250723 eun 10만 원 이상 충전 고객 팝업 작업 시작-->
        <script>
            document.addEventListener('DOMContentLoaded', function(){
                var amount      = <?= $amount ?>;
                var autopayflag = '<?= $autopayflag ?>';
                const cancelBtn    = document.querySelector('.cancle-btn');
                const overlay      = document.querySelector('.coin_fill_modal');

                cancelBtn.addEventListener('click', function () {
                    overlay.classList.remove('show');
                });

                // 금액 체크 후 모달 띄우기
                if (amount >= 100000 && autopayflag !== 'Y') {
                    //  document.querySelector('.coin_fill_modal').classList.add('show');
                    overlay.classList.add('show'); //이거 안 되면 위쪽 주석 풀기
                }
            });
        </script>
        <!--20250723 eun 10만 원 이상 충전 고객 팝업 작업 마감-->
        <div class="bottom_btn">충전하기</div>
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>