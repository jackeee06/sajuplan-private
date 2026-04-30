<?php
include_once('./_common.php');
echo '<meta charset="utf-8">';

$sql_common = " from {$g5['member_table']} ";

$sql_search = " where (1) and mb_level < 5";
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

if (!$sst) {
    $sst = "mb_datetime";
    $sod = "desc";
}

$sql_order = " order by {$sst} {$sod} ";

$sql = " select * {$sql_common} {$sql_search} {$sql_order} ";
$result = sql_query($sql);

header("Content-Type: application/vnd.ms-excel"); 
header("Content-Type: application/x-msexcel"); 
header("Content-Disposition: attachment; filename=member.xls");
header("Content-Description: PHP4 Generated Data" ); 
//header("Content-charset=utf-8");
?>

<html>
<head>
<style>
.sty { font-family:굴림; font-size:12px;}
.sty0 { font-family:굴림; font-size:12px; text-align:center;}
.sty1 {mso-number-format:"\@";font-family:굴림; font-size:12px}
.sty2 {font-family:굴림; font-size:12px}
.sty3 {font-family:굴림; font-size:12px; color: #ff0000}
.title {font-family:굴림; font-size:12px; font-weight:600}
.title_s {font-family:굴림; font-size:16px}
</style>
</head>
<body bgcolor="#FFFFFF">
<table border="1" style="table-layout:fixed">
<tr align="center">    
    <td bgcolor="#CCFFCC">mb_id</td>
	<td bgcolor="#CCFFCC">mb_password</td>
    <td bgcolor="#CCFFCC">mb_name</td>
    <td bgcolor="#CCFFCC">mb_nick</td>
    <td bgcolor="#CCFFCC">mb_email</td>
    <td bgcolor="#CCFFCC">mb_homepage</td>
    <td bgcolor="#CCFFCC">mb_level</td>
    <td bgcolor="#CCFFCC">mb_tel</td>
    <td bgcolor="#CCFFCC">mb_hp</td>
    <td bgcolor="#CCFFCC">mb_adult</td>
    <td bgcolor="#CCFFCC">mb_zip</td>
    <td bgcolor="#CCFFCC">mb_addr1</td>
    <td bgcolor="#CCFFCC">mb_addr2</td>
    <td bgcolor="#CCFFCC">mb_addr3</td>
    <td bgcolor="#CCFFCC">mb_addr_jibeon</td>
    <td bgcolor="#CCFFCC">mb_recommend</td>
    <td bgcolor="#CCFFCC">mb_mailling</td>
    <td bgcolor="#CCFFCC">mb_sms</td>
    <td bgcolor="#CCFFCC">mb_open</td>
    <td bgcolor="#ec6644">mb_1(엠투넷회원번호/상담사번호)(공용)</td>
    <td bgcolor="#407cf9">mb_2(상담사연결순위)</td>
    <td bgcolor="#407cf9">mb_3(상담사실제연결전화번호)</td>
    <td bgcolor="#407cf9">mb_4(회원차감단위금액)</td>
    <td bgcolor="#407cf9">mb_5(회원차간단위시간)</td>
    <td bgcolor="#407cf9">mb_6(선불여부)</td>
    <td bgcolor="#407cf9">mb_7(상담사접속번호)</td>
    <td bgcolor="#407cf9">mb_8(상담사계좌번호)</td>
    <td bgcolor="#407cf9">mb_9(상담사용)</td>
    <td bgcolor="#CCFFCC">mb_10(남/여구분)</td>
	<td bgcolor="#CCFFCC">mb_point</td>
	<td bgcolor="#CCFFCC">mb_time(태어난시간)</td>
	<td bgcolor="#CCFFCC">mb_birth(생년월일)</td>
	<td bgcolor="#CCFFCC">mb_11(양력/음력)</td>
	<td bgcolor="#CCFFCC">mb_datetime(가입일)</td>
	<td bgcolor="#CCFFCC">mb_leave_date(이용/이용정지)</td>
	<td bgcolor="#CCFFCC">org_soruce(가입출처)</td>
	
</tr>

<?php while($row=sql_fetch_array($result)) { ?>
    <tr>
        <td class="sty1"><?php echo $row['mb_id'];?></td>
		<td class="sty1"></td>
        <td class="sty1"><?php echo $row['mb_name'];?></td>
        <td class="sty1"><?php echo $row['mb_nick'];?></td>
        <td class="sty1"><?php echo $row['mb_email'];?></td>
        <td class="sty1"><?php echo $row['mb_homepage'];?></td>
        <td class="sty1"><?php echo $row['mb_level'];?></td>
        <td class="sty1"><?php echo $row['mb_tel'];?></td>
        <td class="sty1"><?php echo $row['mb_hp'];?></td>
        <td class="sty1"><?php echo $row['mb_adult'];?></td>
        <td class="sty1"><?php echo $row['mb_zip1'];?><?php echo $row['mb_zip2'];?></td>
        <td class="sty1"><?php echo $row['mb_addr1'];?></td>
        <td class="sty1"><?php echo $row['mb_addr2'];?></td>
        <td class="sty1"><?php echo $row['mb_addr3'];?></td>
        <td class="sty1"><?php echo $row['mb_addr_jibeon'];?></td>
        <td class="sty1"><?php echo $row['mb_recommend'];?></td>
        <td class="sty1"><?php echo $row['mb_mailling'];?></td>
        <td class="sty1"><?php echo $row['mb_sms'];?></td>
        <td class="sty1"><?php echo $row['mb_open'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_1'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_2'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_3'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_4'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_5'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_6'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_7'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_8'];?></td>
        <td class="sty1" bgcolor="#deded6"><?php echo $row['mb_9'];?></td>
        <td class="sty1"><?php echo $row['mb_10'];?></td>
		<td class="sty1"><?php echo $row['mb_point'];?></td>
		<td class="sty1"><?php echo $row['mb_time'];?></td>
		<td class="sty1"><?php echo $row['mb_birth'];?></td>
		<td class="sty1"><?php echo $row['mb_11'];?></td>
		<td class="sty1"><?php echo $row['mb_datetime'];?></td>
		<td class="sty1"><?php echo $row['mb_leave_date']?'이용정지':'이용';?></td>
		<td class="sty1"><?php echo $row['org_source']?></td>
    </tr>
<?php } ?>
    </table>
</body>
</html>