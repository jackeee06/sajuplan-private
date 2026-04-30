<?php
$sub_menu = "350420";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');

########################################################3

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Pay_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

#############################################################

$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


$sql_common = " from saju_payment a left join g5_member b on(a.mb_id=b.mb_id)";

$sql_search = " where (1) ";
if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'mb_point' :
            $sql_search .= " ({$sfl} >= '{$stx}') ";
            break;
        case 'mb_level' :
            $sql_search .= " ({$sfl} = '{$stx}') ";
            break;
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


if ($fr_date && $to_date) {
    $sql_search .= " and od_time between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}


if (!$sst) {
    $sst = "od_time";
    $sod = "desc";
}

//$sql_order = "";
$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

//echo $sql;


$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산


$sql = " select a.*, b.* {$sql_common} {$sql_search} {$sql_order}";

//echo $sql;
//echo "<br><br><br>";

$result = sql_query($sql);




// 카드결제
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and  a.PayMethod='DIR_CARD'";
$row = sql_fetch($sql);
$card_count = $row['cnt'];

// 가상결제
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and  a.PayMethod!='DIR_CARD'";
$row = sql_fetch($sql);
$acc_count = $row['cnt'];
?>



<div class="tbl_head01 tbl_wrap">
    <div class="tbl_head01 tbl_wrap">
    <table>
    <thead>
    <tr>
        
        <th scope="col" id="mb_list_id">날짜</th>        
        <th scope="col" id="mb_list_auth">결제방법</th>  
        <th scope="col" id="mb_list_auth">사용자코드</th>
        <th scope="col" id="mb_list_mng">ID(이메일)</th>
        <th scope="col" id="mb_list_mng">닉네임</th>
        <th scope="col" id="mb_list_mng">핸드폰번호</th>
        <th scope="col" id="mb_list_mng">결제금액</th>
        <th scope="col" id="mb_list_mng">충전금액</th>
        <th scope="col" id="mb_list_mng">결과</th>
    </tr>
    </thead>
    <tbody>
    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {

        $bg = 'bg'.($i%2);


		if($row["ResultMsg"]=="ok"){
			$row["ResultMsg"] = "입금완료";
		}
		

    ?>

        
    <tr class="<?php echo $bg; ?>">
      
        <td><?=$row["od_time"]?></td>
        <td>
			<?

	
			//ECHO $row["PayMethod"];

	
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
			</td>
        <td><?=$row["Membid"]?></td>
        <td style="mso-number-format:'\@'"><?=$row["mb_email"]?></td>
        <td style="mso-number-format:'\@'"><?=$row["mb_nick"]?></td>
        <td style="mso-number-format:'\@'"><?=format_phone($row["TelNo"])?></td>
        <td><?=number_format($row["Amount"])?></td>
        <td><?=number_format($row["Coin_Amount"])?></td>
        <td align="center"><?
						if($row["ResultMsg"]=="processing completed"){
							echo "입금완료";
							echo "<br>";

							if($cancle_flag==true){
							?>
								<a class="btn btn_02" href="#none;" onclick="cancle_order('<?=$row["no"]?>');">결제 취소</a>
							<?
							}
						}else{
							
							if($order_paytype!="가상결제"){
								
								echo $row["ResultMsg"];
								if($row["ResultMsg"]=="입금완료"){
									//echo "<br>";
									if($cancle_flag==true){
									?>
									<?
									}
								}
							}else{
								if($row["ResultMsg"]=="정상처리"){
									echo "입금전";
								}else{
									echo $row["ResultMsg"];
								}
							}
						}?></td>
    </tr>

    <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>
    </tbody>
    </table>
</div>
</div>

