<?php
$sub_menu = "350800";
include_once('./_common.php');
include_once(G5_EDITOR_LIB);

auth_check_menu($auth, $sub_menu, 'r');

$html_title = '사주메인관리';



$sql = "select * from saju_config";

$row = sql_fetch($sql);


$cf_now_add = $row["cf_now_add"];
$cf_con_num = $row["cf_con_num"];
$cf_1 = $row["cf_1"];

$g5['title'] = $html_title;
include_once('./admin.head.php');
?>

<div class="local_desc"><p>메인항목 숫자설정</p></div>

<form name="cform" id="cform" action="./saju_config_update.php" onsubmit="return cform_check(this);" method="post">

<input type="hidden" name="token" value="" id="token">

<div class="tbl_frm01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col class="grid_4">
        <col>
    </colgroup>
    <tbody>
    <tr>
        <th scope="row"><label for="cf_con_num">최근일주일 상담건수</label></th>
        <td>
	        <input type="text" name="cf_con_num" value="<?php echo $cf_con_num; ?>" id="cf_con_num" required class="required frm_input" size="10">
        	실건수 + 입력값이 메인에 표시됩니다.
        </td>
    </tr>
        <tr>
        <th scope="row"><label for="cf_now_add">현재 접속중인 상담사 숫자</label></th>
        <td>
        	<input type="text" name="cf_now_add" value="<?php echo $cf_now_add; ?>" id="cf_now_add" required class="required frm_input" size="10">
            실건수 + 입력값이 메인에 표시됩니다.
        </td>
    </tr>

	<tr>
        <th scope="row"><label for="cf_1">라이브 숫자</label></th>
        <td>
        	<input type="text" name="cf_1" value="<?php echo $cf_1; ?>" id="cf_1" required class="required frm_input" size="10">
            실건수 + 입력값이 메인에 표시됩니다.
        </td>
    </tr>

    </tbody>
    </table>
</div>

<div class="btn_fixed_top ">
    <input type="submit" class="btn_submit btn" accesskey="s" value="확인">
</div>
</form>

<script>
function cform_check(f)
{
      return true;
}
</script>

<?php
include_once('./admin.tail.php');