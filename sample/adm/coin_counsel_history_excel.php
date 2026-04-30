<?php
$sub_menu = "350410";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
#################################################################3

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Counsel_history_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');



$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';

$stx = $_REQUEST["stx"];
$sfl = $_REQUEST["sfl"];

$sql_common = " from platform_consulting ";

$sql_search = " where (1) and (reason='DISCONNECT' or reason='END_CHAT') AND csrid !='' ";



if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
		case 'mb_id' :

			$sql1 = "select mb_1 from g5_member where mb_id='".$stx."'";


			$rst1 = sql_query($sql1);
			if($rst1){
				$row1 = sql_fetch_array($rst1);
			}

			if($row1["mb_1"]){
				$sql_search .= " membid='".$row1["mb_1"]."'";
			}else{
				$sql_search .= "";
			}

            break;
        case 'cmb_id' :
            $sql_search .= " mb_id= '{$stx}'";
            break;

        case 'mb_hp' :
            $sql_search .= " `from` = '".str_replace("-","",$stx)."'";
            break;
        case 'mb_nick' :

			$sql1 = "select mb_1 from g5_member where mb_nick='".$stx."'";

			$rst1 = sql_query($sql1);
			if($rst1){
				$row1 = sql_fetch_array($rst1);
			}

			if($row1["mb_1"]){
				$sql_search .= " csrid='".$row1["mb_1"]."'";
			}else{
				$sql_search .= "";
			}

            break;
        default :
            $sql_search .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if ($fr_date && $to_date) {
    $sql_search .= " and wr_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}

if (!$sst) {
    $sst = "wr_datetime";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select *  {$sql_common} {$sql_search} {$sql_order}";


//echo $sql;



$result = sql_query($sql);


$colspan = 16;
?>


<form name="fmemberlist" id="fmemberlist" action="./member_list_update.php" onsubmit="return fmemberlist_submit(this);" method="post">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="token" value="">

<div class="tbl_head01 tbl_wrap">
    <div class="tbl_head01 tbl_wrap">
    <table>
    <thead>
    <tr>
         <th scope="col" id="mb_list_auth">날짜</th>
        <th scope="col" id="mb_list_mng">회원ID</th>
        <th scope="col" id="mb_list_mng">회원이름</th>
        <th scope="col" id="mb_list_mng">상담사ID</th>
        <th scope="col" id="mb_list_mng">상담사닉네임</th>
        <th scope="col" id="mb_list_auth">상담유형</th>
        <th scope="col" id="mb_list_auth" class="gray_bg">분야</th>
        <th scope="col" id="mb_list_mng">상담시작</th>
		<th scope="col" id="mb_list_mng">상담종료</th>
        <th scope="col" id="mb_list_mng">진행시간</th>
		<th scope="col" id="mb_list_mng">유·무료</th>
        <th scope="col" id="mb_list_mng">사용포인트</th>

    </tr>
    </thead>
    <tbody>
    <?php
     for ($i=0; $row=sql_fetch_array($result); $i++) {

	$cinfo= get_csrid($row["csrid"]);

	//PRINT_R($cinfo);

	 $con_write_detail = get_con_detail($row["no"]);

	$minfo= get_mbid($row["membid"]);
	$img = get_con_img($cinfo["mb_id"], '70', '70');
         $is_chat = (isset($row['reason']) && $row['reason'] === 'END_CHAT');


         ?>

    <tr class="<?php echo $bg; ?>">

       <td headers="mb_list_auth" class="td_mng_l">
           <!--날짜--><?=$row["eventtm"]?>
        </td>
		<td headers="mb_list_grp" class=""><!--회원ID-->
			<?if($row["membid"]){?>
				<?=$minfo["mb_id"]?><!--(<?=$minfo["mb_email"]?>)-->
			<?}else{?>
				<?=$cinfo["mb_id"]?><!--(<?=$cinfo["mb_email"]?>)-->
			<?}?>
		</td>
		<td headers="mb_list_grp" class="">
			<?if($row["membid"]){?>
				<?=$minfo["mb_name"]?>
			<?}else{?>
				<?=$cinfo["mb_name"]?>
			<?}?>
		</td>
        <td headers="mb_list_grp" class=""><?=$cinfo["mb_id"]?></td>
        <td headers="mb_list_grp" class=""><!--상담사 닉네임--><?=$cinfo["mb_nick"]?></td>
        <td headers="mb_list_auth" class="">
           <!--선불후불--><?  echo $is_chat ? '채팅' : (($row['preflag'] === 'Y') ? '선불' : '후불');?>
        </td>
        <td headers="mb_list_grp" class=""><?= $con_write_detail["wr_2"]?></td>
        <td headers="mb_list_grp" class=""><!--상담시작--><?=$row["start"]?></td>
		<td headers="mb_list_grp" class=""><!--상담종료--><?=$row["end"]?></td>
		<td headers="mb_list_grp" class=""><!--이용시간--><?=gmdate("H시간i분s초", $row["usetm"]);?></td>
		<td headers="mb_list_grp" class=""><?if($row["p_gubun"]=="Y"){echo "유료";}else{echo "무료";}?></td>
        <td headers="mb_list_auth" class=""><!-- 과금금액-->  <?php
            $amt   = (int)($row['amt'] ?? 0);
            $usetm = (int)($row['usetm'] ?? 0);
            echo ($amt <= $cinfo['mb_4'] && $usetm < 30 && !$is_chat) ? '0(환불)' : number_format($amt); // 환불
            /*echo ($amt <= 1000 && $usetm < 30 && !$is_chat) ? '0(환불)' : number_format($amt);*/
            ?></td>
        <td headers="mb_list_grp" class="">




		</td>
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

</form>