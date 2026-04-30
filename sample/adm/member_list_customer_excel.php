<?php
$sub_menu = "350110";
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, 'r');
##################################################################



//########################################################3

header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Members_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

//#############################################################





$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


$sql_common = " from {$g5['member_table']} ";

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
    $sql_search .= " and mb_datetime between '$fr_date 00:00:00' and '$to_date 23:59:59' ";
}

if($mb_status=="1"){
	$sql_search .=" and mb_intercept_date <> ''";
}

if($mb_status=="2"){
	$sql_search .=" and mb_leave_date <> ''";
}

if (!$sst) {
    $sst = "mb_datetime";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

//echo $sql;
//exit;

$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

// 탈퇴회원수
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_leave_date <> '' {$sql_order} ";
$row = sql_fetch($sql);
$leave_count = $row['cnt'];

// 차단회원수
$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_intercept_date <> '' {$sql_order} ";
$row = sql_fetch($sql);
$intercept_count = $row['cnt'];


// 상담사
$sql = " select count(*) as cnt {$sql_common} where mb_level='5' ";
$row = sql_fetch($sql);
$c_count = $row['cnt'];


//일반
$sql = " select count(*) as cnt {$sql_common} where mb_level ='2' ";
$row = sql_fetch($sql);
$j_count = $row['cnt'];



$sql = " select * {$sql_common} {$sql_search} {$sql_order}";
$result = sql_query($sql);
$colspan = 16;
$qstr = $qstr."&mb_status=".$mb_status;

?>

<style>
.gray_bg { background-color:#FC0 !important;}
</style>



<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>
  
        <th scope="col" id="mb_list_join">가입일시</th>
        <th scope="col" id="mb_list_id">아이디</th>
        <th scope="col" id="mb_list_name">이름</th>
        <th scope="col" id="">휴대폰</th>
        <th scope="col" id="mb_list_deny">권한</th>
		<th scope="col" id="mb_no">번호</th>
        <th scope="col" id="mb_list_point"> 포인트</th>
        <th scope="col" class="">성별</th>
        <th scope="col" class="">연령</th>
        <th scope="col" class="">결제건수</th>
        <th scope="col" class="">누적결제<br />
          (070)</th>
        <th scope="col" class="">누적결제<br />
          (060)</th>
		<th scope="col" class="">쿠폰다운</th>
        <th scope="col" class="">가입경과일</th>
        <th scope="col" class="">가입출처</th>
        <th scope="col" id="mb_list_lastcall">최근접속일</th>

        
    </tr>
    </thead>
    <tbody>
    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        // 접근가능한 그룹수
        $sql2 = " select count(*) as cnt from {$g5['group_member_table']} where mb_id = '{$row['mb_id']}' ";
        $row2 = sql_fetch($sql2);
        $group = '';
        if ($row2['cnt'])
            $group = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'">'.$row2['cnt'].'</a>';


        $leave_date = $row['mb_leave_date'] ? $row['mb_leave_date'] : date('Ymd', G5_SERVER_TIME);
        $intercept_date = $row['mb_intercept_date'] ? $row['mb_intercept_date'] : date('Ymd', G5_SERVER_TIME);

        $mb_nick = get_sideview($row['mb_id'], get_text($row['mb_nick']), $row['mb_email'], $row['mb_homepage']);

        $mb_id = $row['mb_id'];
        $leave_msg = '';
        $intercept_msg = '';
        $intercept_title = '';
        if ($row['mb_leave_date']) {
            $mb_id = $mb_id;
            $leave_msg = '<span class="mb_leave_msg">탈퇴함</span>';
        }
        else if ($row['mb_intercept_date']) {
            $mb_id = $mb_id;
            $intercept_msg = '<span class="mb_intercept_msg">차단됨</span>';
            $intercept_title = '차단해제';
        }
        if ($intercept_title == '')
            $intercept_title = '차단하기';

        $address = $row['mb_zip1'] ? print_address($row['mb_addr1'], $row['mb_addr2'], $row['mb_addr3'], $row['mb_addr_jibeon']) : '';

        $bg = 'bg'.($i%2);

        switch($row['mb_certify']) {
            case 'hp':
                $mb_certify_case = '휴대폰';
                $mb_certify_val = 'hp';
                break;
            case 'ipin':
                $mb_certify_case = '아이핀';
                $mb_certify_val = '';
                break;
            case 'simple':
                $mb_certify_case = '간편인증';
                $mb_certify_val = '';
                break;
            case 'admin':
                $mb_certify_case = '관리자';
                $mb_certify_val = 'admin';
                break;
            default:
                $mb_certify_case = '&nbsp;';
                $mb_certify_val = 'admin';
                break;
        }
    ?>

    <tr >
 
        <td headers="mb_list_join" class=""><?php echo substr($row['mb_datetime'],2,18); ?></td>
        <td headers="mb_list_id" class="">
            <?php echo $mb_id ?>
           
        </td>
        <td headers="mb_list_name" class=""><?php echo get_text($row['mb_name']); ?></td>
        <td><?php echo get_text($row['mb_hp']); ?></td>
        <td headers="mb_list_auth" class="">
            <?php echo $row['mb_level']; ?>
        </td>
		<td headers="mb_list_auth" class="">
            <?php echo $row['mb_1'] ?>
        </td>
        <td headers="mb_list_point" class=""><?php echo number_format($row['mb_point']) ?></td>
        <td class=""><?php echo $row['mb_10'] ?></td>
        <td class="">
			<?
			if($row["mb_birth"]){
				echo getAge($row["mb_birth"]);
			}else{
				echo "-";
			}
			?>
		</td>
        <td class=""><?echo get_member_pay_count($row["mb_id"]);?></td>
        <td class=""><?echo number_format(get_con_pay_sum($row["mb_1"], '1'))?></td>
        <td class=""><?echo number_format(get_con_pay_sum($row["mb_1"], '2'))?></td>
		<td class="">
		<?
			$csql = "select count(*) as ct from g5_shop_coupon where mb_id='".$row["mb_id"]."'";
			$coupon_count =  sql_fetch($csql);
			echo (int)$coupon_count["ct"];
		?>
		</td>
        <td class=""><?=get_join_dur($row["mb_id"])?></td>
        <td class=""><?php echo $row['org_source']?$row['org_source']:'신규앱'; ?></td>
        <td headers="mb_list_lastcall" class="td_date"><?php echo substr($row['mb_today_login'],2,8); ?></td>
       
       
    </tr>

    <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>
    </tbody>
    </table>
</div>