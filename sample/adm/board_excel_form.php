<?php
$sub_menu = '999100';
include_once('./_common.php');

auth_check($auth[$sub_menu], "w");

$g5['title'] = '게시판 엑셀 업로드';
include_once (G5_ADMIN_PATH.'/admin.head.php');
?>

<style>
/* 엑셀 일괄 등록 */
#excelfile_upload {margin:10px ;padding:20px;border:1px solid #e9e9e9;background:#fff}
#excelfile_upload label {font-weight:bold}
#excelfile_input {margin:0 0 20px;text-align:center}
#excelfile_result {margin:0 20px 20px;border-bottom:1px solid #e9e9e9;zoom:1}
#excelfile_result:after {display:block;visibility:hidden;clear:both;content:""}
#excelfile_result dt {clear:both;float:left;padding:10px 0;width:40%;font-weight:bold}
#excelfile_result dd {float:left;margin:0;padding:10px 0;width:60%}
#excelfile_result .result_done {color:#5d910b}
#excelfile_result .result_fail {color:#ff3061}
</style>

<div class="local_desc01 local_desc">
	<p>
		엑셀파일을 이용하여 게시글을 일괄 등록할 수 있습니다.<br>
		형식은 <strong>게시글일괄등록용 엑셀파일</strong>을 다운로드하여 회원 정보를 입력하시면 됩니다.<br>
		수정 완료 후 엑셀파일을 업로드하시면 게시글이 일괄등록됩니다.<br>
		엑셀파일을 저장하실 때는 <strong>Excel 97 - 2003 통합문서 (*.xls)</strong> 로 저장하셔야 합니다.
	</p>

	<p>
		<!--<a href="<?php echo G5_URL; ?>/<?php echo G5_LIB_DIR; ?>/Excel/boardexcel.xls">게시글일괄등록용 엑셀파일 다운로드</a>-->
        <a href="<?php echo G5_URL; ?>/include/fortune_sample.xls" style="padding:4px 8px; background-color:#000; display:inline-block; margin-top:10px; color:#fff; text-decoration:none; border-radius:4px; margin-right:20px;">오늘의 운세 엑셀파일 다운로드</a>
        
        <a href="<?php echo G5_URL; ?>/include/review_sample.xls" style="padding:4px 8px; background-color:#F00; display:inline-block; margin-top:10px; color:#fff; text-decoration:none; border-radius:4px; margin-right:20px;">상담후기 엑셀파일 다운로드</a>
	</p>
</div>

<div class="local_desc01 local_desc">
	<p>
		엑셀 게시글 일괄등록을 선택하신 게시판은 <strong><?php echo $bo_table;?></strong> 입니다.<br>
	</p>
</div>

<form name="fmemberexcel" method="post" action="./board_excel_update.php" enctype="MULTIPART/FORM-DATA" autocomplete="off">
<input type="hidden" name="bo_table" value="<?php echo $bo_table;?>">

<div id="excelfile_upload">
	<label for="excelfile">파일선택</label>
	<input type="file" name="excelfile" id="excelfile">
</div>

<div class="btn_fixed_top btn_confirm">
	<a href="./board_excel_form.php" class="btn btn_02">취소</a>
	<input type="submit" value="확인" class="btn_submit btn">
</div>

</form>

<?
include_once (G5_ADMIN_PATH.'/admin.tail.php');
?>