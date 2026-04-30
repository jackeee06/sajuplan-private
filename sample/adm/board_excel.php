<?php
$sub_menu = "999100";
include_once('./_common.php');

auth_check($auth[$sub_menu], 'r');

if ($is_admin != 'super')
    alert('최고관리자만 접근 가능합니다.');

$g5['title'] = '게시판 엑셀 업로드';
include_once (G5_ADMIN_PATH.'/admin.head.php');

$pg_anchor = '<ul class="anchor">
    <li><a href="#board_excel">게시판 엑셀 업로드</a></li>
</ul>';

// 전체 게시판을 SELECT 형식으로 얻음 (gnuwiz)
// $name = select id&name
// $event = required
// $class = css class name
function get_board_select($name, $event='', $class='')
{
    global $g5;

    $sql = " select * from {$g5['board_table']} a where (1) order by a.gr_id, a.bo_table asc ";
    $result = sql_query($sql);
    $str = "<select id=\"$name\" name=\"$name\" $event class=\"$class\">\n";
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        if ($i == 0) $str .= "<option value=\"\">선택</option>";
        $str .= "<option value=\"$row[bo_table]\">$row[bo_table] [$row[bo_subject]]</option>\n";
    }
    $str .= "</select>";
    return $str;
}
?>

<div class="local_desc01 local_desc">
    <p>
        게시판 엑셀 업로드 시 선택한 게시판에 엑셀의 내용이 게시글로 등록됩니다.
		<!--<br><strong>그누보드5 , 영카드5</strong> 에서 사용 가능합니다.-->
    </p>
</div>

<form name="fconfigform" id="fconfigform" method="post" onsubmit="return fconfigform_submit(this);" enctype="MULTIPART/FORM-DATA">
<input type="hidden" name="token" value="" id="token">

<section id="board_excel">
    <div class="tbl_frm01 tbl_wrap">
       <table>
        <caption>게시판 엑셀 업로드</caption>
        <colgroup>
            <col class="grid_4">
            <col>
            <col class="grid_4">
            <col>
        </colgroup>
        <tbody>
        <tr>
            <th scope="row"><label for="bo_table">게시판 선택<strong class="sound_only">필수</strong></label></th>
            <td>
                <?php echo help('엑셀 업로드를 사용할 게시판을 선택해주세요.') ?>
				<?php echo get_board_select("bo_table","required","required");?>
            </td>
        </tr>
        </tbody>
        </table>
    </div>
</section>

<div class="btn_fixed_top btn_confirm">
    <input type="submit" value="확인" class="btn_submit btn" accesskey="s">
</div>

</form>

<script>
function fconfigform_submit(f)
{
    f.action = "./board_excel_form.php";
    return true;
}
</script>

<?
include_once (G5_ADMIN_PATH.'/admin.tail.php');
?>