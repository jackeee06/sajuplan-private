<?php
$sub_menu = "350120";
include_once('./_common.php');
auth_check_menu($auth, $sub_menu, 'r');
#############################################################################


header('Pragma: public');
header("Content-Description: File Transfer");
header('Content-type: application/vnd.ms-excel'); //header("Content-type: text/csv");
header("X-Download-Options: noopen");
header('Expires: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Content-Disposition: attachment; filename="Counselor_'.date("YmdHi", time()) . '.xls"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

//#############################################################




$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';
$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';


$sql_common = " from {$g5['member_table']} a left join g5_write_counselor b on(a.mb_id=b.mb_id) ";

$sql_search = " where (1) and a.mb_level = '5'  ";
if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'a.mb_point' :
            $sql_search .= " ({$sfl} >= '{$stx}') ";
            break;
        case 'a.mb_level' :
            $sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        case 'a.mb_tel' :
        case 'a.mb_hp' :
            $sql_search .= " ({$sfl} like '%{$stx}') ";
            break;
        case 'a.state' :

            if($stx=="IDLE" or $stx=="RDVC" or $stx=="RDCH"){
                $sql_search .= " ({$sfl} like '%{$stx}') ";
            }else{
                //20250731 EUN RDVC 추가 시작
                //$sql_search .= " ({$sfl} !='IDLE') ";
                $sql_search .= " ({$sfl} != 'IDLE' AND {$sfl} != 'RDVC' AND {$sfl} != 'RDCH') ";
                //20250731 EUN RDVC 추가 마감
            }
            break;
        default :
            $sql_search .= " ({$sfl} like '{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}





if (!$sst) {
    $sst = "a.mb_no";
    $sod = "asc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함




$sql = " select * {$sql_common} {$sql_search} {$sql_order}";
//echo $sql;


$result = sql_query($sql);

$colspan = 16;


// 타로
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='타로' ";
$row = sql_fetch($sql);
$taro_count = $row["cnt"];

// 신점
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='신점' ";
$row = sql_fetch($sql);
$sin_count = $row["cnt"];

// 사주
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='사주' ";
$row = sql_fetch($sql);
$saju_count = $row["cnt"];

// 심리
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='심리' ";
//echo $sql;
//echo "<br>";
$row = sql_fetch($sql);
$sim_count = $row["cnt"];


//20250731 eun RDVC 추가 시작
// 상담가능
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state='IDLE' or a.state='RDVC' or a.state='RDCH') ";
//echo $sql;
//echo "<br>";
$row = sql_fetch($sql);
$id_count = $row["cnt"];

// 부재중
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state!='IDLE' and a.state!='RDVC' or a.state!='RDCH) ";
//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and a.state!='IDLE' ";
//echo $sql;
//echo "<br>";
$row = sql_fetch($sql);
$abs_count = $row["cnt"];
//20250731 eun RDVC 추가 마감



$qstr = "$qstr&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page&fr_date=".$fr_date."&to_date=".$to_date;


////echo $qstr;


?>




<div class="tbl_head01 tbl_wrap">
    <div class="tbl_head01 tbl_wrap">
        <table>
            <caption><?php echo $g5['title']; ?> 목록</caption>
            <thead>
            <tr>
                <th scope="col" id="mb_list_chk" >가입일시</th>
                <th scope="col" id="mb_list_id">회원ID</th>
                <th scope="col" id="mb_list_id">이름</th>
                <th scope="col" id="mb_list_auth">닉네임</th>
                <th scope="col" id="mb_list_chk" class="" >분야</th>
                <th scope="col" id="mb_list_auth">휴대폰</th>
                <th scope="col" id="mb_list_auth">번호</th>
                <th scope="col" id="mb_list_auth">mnet번호</th>
                <th scope="col" id="mb_list_auth">권한</th>
                <th scope="col" id="mb_list_chk" class="" >누적후기</th>
                <th scope="col" id="mb_list_grp">누적상담수</th>
                <th scope="col" id="mb_list_grp" class="" >누적상담시간</th>
                <th scope="col" id="mb_list_grp" class="" >단골수</th>
                <th scope="col" id="mb_list_auth" >포인트</th>
                <th scope="col" id="mb_list_grp" class="" >지난달매출<br />(070)</th>
                <th scope="col" id="mb_list_grp" class="" >지난달매출<br />(060)</th>
                <th scope="col" id="mb_list_grp" class="" >로열티</th>
                <th scope="col" id="mb_list_grp" class="" >상태</th>

            </tr>
            </thead>
            <tbody>

            <?php

            for ($i=0; $row=sql_fetch_array($result); $i++) {

                //print_r($row);


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

                ?>

                <tr class="<?php echo $bg; ?>">

                    <td class=""><!--가입일--><?//=$row["mb_datetime"]?> <?php //echo date("Y-m-d", strtotime($row['mb_datetime'])) ?> <?php echo substr($row['mb_datetime'],2,18); ?></td>

                    <td headers="mb_list_id"><!--아이디--><?php echo $mb_id ?></td>
                    <td headers="mb_list_id"><!--이름--><?php echo get_text($row['mb_name']); ?></td>
                    <td headers="mb_list_id"><!--닉네임--><?php echo get_text($row['mb_nick']); ?></td>
                    <td><!--분야--><?=$row["ca_name"]?></td>
                    <td headers="mb_list_id"><?php echo get_text($row['mb_hp']); ?></td>
                    <td headers="mb_list_id"><!--상담사 번호--><?php echo $row['mb_no']; ?></td>
                    <td headers="mb_list_id"><!--mnet 번호--><?php echo $row['mb_1']; ?></td>
                    <td headers="mb_list_auth">
                        <!--권한--><?php echo $row['mb_level']; ?>
                    </td>

                    <!--<td headers="mb_list_grp" class="">상담사번호<?=$row["mb_no"]?></td>-->
                    <td><!--누적후기--><?=get_counselor_afcnt($row["mb_id"])?></td>
                    <td><!--누적상담건수--><?=get_counselor_counter_all($row["mb_id"])?></td>
                    <td><!--누적상담시간--><?=gmdate("H:i:s", get_counselor_sum_time($row["mb_id"]));?></td>
                    <td><!--단골수--><?=get_counselor_scrap_count($row["wr_id"])?></td>
                    <td headers="mb_list_auth">
                        <!--포인트--><?php echo number_format($row['mb_point']) ?>
                    </td>
                    <td><!--지난달매출(070)--><?=number_format(get_con_total_account_befre_mode($row["mb_id"], "070"))?></td>
                    <td><!--지난달매출(060)--><?=number_format(get_con_total_account_befre_mode($row["mb_id"], "060"))?></td>

                    <td headers="mb_list_grp" class="" style="width:70px;">
                        <?php echo number_format($row['mb_20']) ?>
                    </td>
                    <td>
                        <?
                        $qry = "select * from member_status_history where mb_id='".$row["mb_id"]."'";
                        $rrs = sql_fetch($qry);
                        if($rrs["status"]=="ABSE"){
                            echo  $s_state[$rrs["status"]];
                            echo "<br>";
                            ?>
                            (<?= diff_time($rrs["wr_datetime"], date("Y-m-d H:i:s",time()));?>)
                        <?}?>

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
