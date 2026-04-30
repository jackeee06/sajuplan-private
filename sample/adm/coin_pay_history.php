<?php
$sub_menu = "350420";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$g5['title'] = '결제 내역';
include_once('./admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
#############################################################


$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


$sql_common = " from saju_payment a left join g5_member b on(a.mb_id=b.mb_id)";

/** ① 기간/검색만 담는 베이스 WHERE (배지/총계 공통) */
$where_base = " where (1) ";
// 검색
if ($stx) {
    $where_base .= " and ( ";
    switch ($sfl) {
        case 'mb_point' :
            $where_base .= " ({$sfl} >= '{$stx}') ";
            break;
        case 'mb_level' :
            $where_base .= " ({$sfl} = '{$stx}') ";
            break;
        case 'mb_tel' :
        case 'mb_hp' :
            $where_base .= " ({$sfl} like '%{$stx}') ";
            break;
        default :
            $where_base .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $where_base .= " ) ";
}

// 기간
if ($fr_date && $to_date) {
    $where_base .= " and od_time between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}

/** ② 목록용 WHERE = 베이스 + smode(결제수단 탭) */
$sql_search = $where_base;

if ($smode){
    if ($smode=="card"){
        $sql_search .= " and (a.PayMethod!='GNR_VRBANK' and a.PayMethod!='GNR_PC_PAVC' and a.PayMethod!='GNR_MOB_PAVC' and a.PayMethod!='VRBANK_PAY')";
    } elseif ($smode=="card_cancle"){
        $sql_search .= " and (a.PayMethod!='GNR_VRBANK' and a.PayMethod!='GNR_PC_PAVC' and a.PayMethod!='GNR_MOB_PAVC' and a.PayMethod!='VRBANK_PAY') AND a.ResultMsg='취소완료'";
    } elseif ($smode=="vbank"){
        $sql_search .= " and (a.PayMethod='GNR_VRBANK' or a.PayMethod='GNR_PC_PAVC' or a.PayMethod='GNR_MOB_PAVC' or a.PayMethod='VRBANK_PAY')";
    }
}





if (!$sst) {
    $sst = "od_time";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

if($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
   // echo $sql;
   // echo "<br><br>";
}

$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산

if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select a.*, b.* {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";

//echo $sql;
//echo "<br><br><br>";

$result = sql_query($sql);

$colspan = 16;


//VRBANK_PAY
/// 카드결제(=가상계좌/가상결제 제외)
$sql = " select count(*) as cnt {$sql_common} {$where_base}
         and (a.PayMethod!='GNR_VRBANK' and a.PayMethod!='GNR_PC_PAVC' and a.PayMethod!='GNR_MOB_PAVC' and a.PayMethod!='VRBANK_PAY')";
$row = sql_fetch($sql);
$card_count = $row['cnt'];

// 가상결제
$sql = " select count(*) as cnt {$sql_common} {$where_base}
         and (a.PayMethod='GNR_VRBANK' or a.PayMethod='GNR_PC_PAVC' or a.PayMethod='GNR_MOB_PAVC' or a.PayMethod='VRBANK_PAY')";
$row = sql_fetch($sql);
$acc_count = $row['cnt'];

// 카드취소
$sql = " select count(*) as cnt {$sql_common} {$where_base}
         and (a.PayMethod!='GNR_VRBANK' and a.PayMethod!='GNR_PC_PAVC' and a.PayMethod!='GNR_MOB_PAVC' and a.PayMethod!='VRBANK_PAY')
         and a.ResultMsg='취소완료'";
$row = sql_fetch($sql);
$cancle_count = $row['cnt'];



// 총결제금액
/*$sql_a = " select a.*, b.* {$sql_common} {$sql_search}";
//echo $sql_a;
//echo "<br><br><br>";
$result_a = sql_query($sql_a);

if($result_a){
    $total_price = 0;
    while($ares=sql_fetch_array($result_a)){
        $total_price += (int)$ares["Amount"];
    }
}*/
// 총결제금액 (취소완료, 정상처리 제외)
$sql_total = "
    SELECT COALESCE(SUM(a.Amount), 0) AS total_price
    {$sql_common}
    {$sql_search}
    AND a.ResultMsg NOT IN ('취소완료','정상처리','입금전')
";
$row_total   = sql_fetch($sql_total);
$total_price = (int)$row_total['total_price'];

?>

<?

$qstr1 = "sfl=$sfl&stx=$stx&fr_date=$fr_date&amp;to_date=$to_date&smode=".$smode;
$qstr = "$qstr1&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page";

?>

    <style>
        td a.btn { height:26px; line-height:26px; font-size:12px;}
    </style>

    <div class="local_ov01 local_ov">
        <?php echo $listall ?>
        <span class="btn_ov01"><span class="ov_txt">총건수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>
        <?php
        $q_keep = http_build_query([
            'sfl'=>$sfl,'stx'=>$stx,'fr_date'=>$fr_date,'to_date'=>$to_date
        ], '', '&', PHP_QUERY_RFC3986);
        ?>
        <a href="?<?=$q_keep?>&smode=card"  class="btn_ov01"><span class="ov_txt">카드</span><span class="ov_num"><?=number_format($card_count)?>건</span></a>
        <a href="?<?=$q_keep?>&smode=vbank" class="btn_ov01"><span class="ov_txt">가상결제</span><span class="ov_num"><?=number_format($acc_count)?>건</span></a>

        <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>

        <span class="btn_ov01"><span class="ov_txt03">총 결제금액</span><span class="ov_num"><?=number_format($total_price)?>원 </span></span>
    </div>



    <div class="sch_text_date_wrap">

        <form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

            <div class="sch_text_date">

                <label for="sfl" class="sound_only">검색대상</label>
                <select name="sfl" id="sfl">
                    <option value="b.mb_id"<?php echo get_selected($sfl, "b.mb_id"); ?>>회원아이디</option>
                    <option value="TelNo"<?php echo get_selected($sfl, "TelNo"); ?>>휴대폰번호</option>
                    <option value="b.mb_nick"<?php echo get_selected($sfl, "b.mb_nick"); ?>>닉네임</option>
                </select>
                <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
                <input type="text" name="stx" value="<?php echo $stx ?>" id="stx" class="frm_input">
                <input type="submit" class="btn_submit" value="검색">

                <div style=" display:inline-block; padding: 0 20px; font-weight:200; font-size:18px; "> |</div>

                <div class="sch_last" style=" margin:0; ">
                    <strong>기간별검색</strong>
                    <input type="text" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date" class="frm_input" size="11" maxlength="10">
                    <label for="fr_date" class="sound_only">시작일</label>
                    ~
                    <input type="text" name="to_date" value="<?php echo $to_date ?>" id="to_date" class="frm_input" size="11" maxlength="10">
                    <label for="to_date" class="sound_only">종료일</label>
                    <input type="submit" value="검색" class="btn_submit">
                </div>



            </div>
        </form>

        <!--  <script>
              $(function(){
                  $("#fr_date, #to_date").datepicker({ changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd", showButtonPanel: true, yearRange: "c-99:c+99", maxDate: "+0d" });
              });


              function cancle_order(no){
                  var cfm = confirm('결제 취소하시겠습니까?');
                  var myWindow = window.open("order_cancle.php?no="+no, "cancle", "width=500,height=200");
              }

          </script>-->
        <script>
            $(function(){
                $("#fr_date, #to_date").datepicker({
                    changeMonth: true,
                    changeYear: true,
                    dateFormat: "yy-mm-dd",
                    showButtonPanel: true,
                    yearRange: "c-99:c+99",
                    maxDate: "+0d"
                });
            });

            function cancle_order(no) {
                if (!confirm('결제 취소하시겠습니까?')) {
                    return false;  // 취소 누르면 함수 종료
                }

                //  확인 눌렀을 때만 실행
                window.open("order_cancle.php?no=" + encodeURIComponent(no), "cancle", "width=500,height=200");
                return true;
            }

            function vbank_cancel(no) {
                if (!confirm('가상결제 건을 “취소완료”로 표기할까요?\n(※ 직접 환불을 진행하신 후에만 누르시기 바랍니다.)')) {
                    return false;
                }
                window.open(
                    "order_vbank_cancel.php?no=" + encodeURIComponent(no),
                    "vbank_cancel",
                    "width=520,height=240"
                );
                return true;
            }
        </script>

        <a href="coin_pay_history_excel.php?<?=$qstr?>"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>

    </div>


    <form name="fmemberlist" id="fmemberlist" action="./coin_pay_history_delete.php" onsubmit="return fmemberlist_submit(this);" method="post">
        <input type="hidden" name="sst" value="<?php echo $sst ?>">
        <input type="hidden" name="sod" value="<?php echo $sod ?>">
        <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
        <input type="hidden" name="stx" value="<?php echo $stx ?>">
        <input type="hidden" name="page" value="<?php echo $page ?>">
        <input type="hidden" name="token" value="">

        <div class="tbl_head01 tbl_wrap">
            <div class="tbl_head01 tbl_wrap">
                <table>
                    <caption><?php echo $g5['title']; ?> 목록</caption>
                    <thead>
                    <tr>
                        <th scope="col" id="mb_list_chk" ></th>
                        <th scope="col" id="mb_list_chk" >번호</th>
                        <th scope="col" id="mb_list_id">날짜</th>
                        <th scope="col" id="mb_list_auth">결제방법</th>
                        <th scope="col" id="mb_list_auth">사용자코드</th>
                        <th scope="col" id="mb_list_mng">아이디</th>
                        <th scope="col" id="mb_list_mng">닉네임</th>
                        <th scope="col" id="mb_list_mng">핸드폰번호</th>
                        <th scope="col" id="mb_list_mng">결제금액</th>
                        <th scope="col" id="mb_list_mng">충전금액</th>
                        <!--<th scope="col" id="mb_list_mng">사용자 등급</th>-->
                        <th scope="col" id="mb_list_mng">결과</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php
                    $k = 0;
                    for ($i=0; $row=sql_fetch_array($result); $i++) {


                        $list_num = $total_count - ($page - 1) *$config['cf_page_rows'];
                        $num = $list_num - $k;


                        $bg = 'bg'.($i%2);





                        //결제 취소 버튼 출력여부
                        $cancle_flag = false;
                        // 카드 결제만 주문 취소 가능하게
                        if($row["PayMethod"]=="DIR_CARD" ||  $row["PayMethod"]=="GNRC_AUTO_PAY_CARD" || strpos($row["PayMethod"], 'PACA')!==false){
                            $cancle_flag = true;
                        }else{
                            $cancle_flag = false;
                        }
                        // 5일 이전주문까지만 취소 가능하게
                        $nday = date("Y-m-d",time());
                        $eday = substr($row["od_time"],0,10);
                        $datetime1 = new DateTime($nday);
                        $datetime2 = new DateTime($eday);
                        $interval = $datetime1->diff($datetime2);
                        $diffday =  $interval->format('%a');

                        if($diffday <= 5){
                            $cancle_flag = true;
                        }else{
                            $cancle_flag = false;
                        }


                        if($row["ResultMsg"]=="ok"){
                            $row["ResultMsg"] = "입금완료";
                        }



                        ?>


                        <tr class="<?php echo $bg; ?>">
                            <td>
                                <input type="hidden" name="no[<?php echo $i ?>]" value="<?php echo $row['no'] ?>" id="no_<?php echo $i ?>">
                                <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_nick']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>
                                <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">

                            </td>
                            <td><?=$num?></td>
                            <td><?=$row["od_time"]?></td>
                            <td>
                                <?php

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

                                }elseif(strpos($row["PayMethod"], 'GNRC_AUTO_PAY_CARD')!==false){
                                    echo $order_paytype ="등록카드자동결제";
                                }else{

                                    echo $order_paytype ="카드결제";
                                }
                                ?>
                                <?php
                                // 가상결제 여부 (PayMethod로 판별)
                                $is_vbank = (
                                    strpos($row["PayMethod"], 'VRBANK')!==false ||
                                    strpos($row["PayMethod"], 'PAVC')!==false ||
                                    $row["PayMethod"]=='VRBANK_PAY' ||
                                    $row["PayMethod"]=='GNR_VRBANK' ||
                                    $row["PayMethod"]=='GNR_PC_PAVC' ||
                                    $row["PayMethod"]=='GNR_MOB_PAVC'
                                );

                                // '입금완료' 동의어 포함해서 완료상태 판별
                                $deposit_done_vals = array('입금완료','ok','processing completed');
                                $is_deposit_done   = in_array(trim($row['ResultMsg']), $deposit_done_vals);

                                // 버튼 노출 조건: 가상결제 && 입금완료 상태 && 은행/입금자 정보 존재
                                $can_vbank_cancel = $is_vbank && $is_deposit_done
                                    && (trim($row['BankCd']) !== '' && trim($row['DepositNm']) !== '');
                                ?>

                            </td>
                            <td><?=$row["Membid"]?></td>
                            <td><?=$row["mb_id"]?><!--(<?=$row["mb_email"]?>)--></td>
                            <td><?=$row["mb_nick"]?></td>
                            <td><?=format_phone($row["TelNo"])?></td>
                            <td><?=number_format($row["Amount"])?></td>
                            <td><?=number_format($row["Coin_Amount"])?></td>
                            <!--<td><?=$row["mb_level"]?></td>-->
                            <td><?
                                if($row["ResultMsg"]=="processing completed"){
                                    echo "입금완료";
                                    echo "<br>";

                                    if($cancle_flag==true){
                                        ?>
                                        <!--  <a class="btn btn_02" href="#none;" onclick="cancle_order('<?php /*=$row["no"]*/?>');">결제 취소</a>-->
                                        <a class="btn btn_02" href="javascript:void(0);" onclick="return cancle_order('<?= $row['no'] ?>');">결제 취소</a>

                                        <?
                                    }
                                }else{

                                    if($order_paytype!="가상결제"){

                                        echo $row["ResultMsg"];
                                        echo "<br>";
                                        if($row["ResultMsg"]=="입금완료" || $row["ResultMsg"]=="ok"){
                                            if($cancle_flag==true){
                                                ?>
                                                <!--<a class="btn btn_02" href="#none;" onclick="cancle_order('<?php /*=$row["no"]*/?>');">결제 취소</a>-->
                                                <a class="btn btn_02" href="javascript:void(0);" onclick="return cancle_order('<?= $row['no'] ?>');">결제 취소</a>
                                                <?
                                            }
                                        }
                                    }else{
                                        if($row["ResultMsg"]=="정상처리"){
                                            echo "입금전";
                                        }else{
                                            echo ($row["ResultMsg"]=="ok" ? "입금완료" : $row["ResultMsg"]);
                                            echo "<br>";

                                            if ($can_vbank_cancel) {
                                                ?>
                                                <a class="btn btn_02"
                                                   href="javascript:void(0);"
                                                   onclick="return vbank_cancel('<?= $row['no'] ?>');">취소 처리</a>
                                                <?php
                                            } else if($row["ResultMsg"]!="취소완료"){
                                                ?>
                                                <span class="btn btn_02" style="opacity:.45;cursor:not-allowed"
                                                      title="입금완료 상태 & 은행/입금자 정보가 있을 때만 가능합니다.">취소 처리</span>
                                                <?php
                                            }
                                        }
                                    }
                                }?></td>
                        </tr>

                        <?php
                        $k++;
                    }
                    if ($i == 0)
                        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
                    ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="btn_fixed_top">
            <!--<input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">-->
            <?php if ($is_admin == 'super') { ?>
                <!--<a href="./member_form.php" id="member_add" class="btn btn_01">회원추가</a>-->
            <?php } ?>


        </div>


    </form>

<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

    <script>


        function fmemberlist_submit(f)
        {
            if (!is_checked("chk[]")) {
                alert(document.pressed+" 하실 항목을 하나 이상 선택하세요.");
                return false;
            }

            if(document.pressed == "선택삭제") {
                if(!confirm("선택한 자료를 정말 삭제하시겠습니까?")) {
                    return false;
                }
            }

            return true;
        }

        if(document.pressed == "완전삭제") {
            if(!confirm("선택한 자료를 정말 완전히 삭제하시겠습니까?\n\n삭제된 회원은 복구 불가능합니다.")) {
                return false;
            }
        }


    </script>

<?php
include_once ('./admin.tail.php');