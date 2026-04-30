<?php
$sub_menu = "999200";
include_once('./_common.php');

auth_check($auth[$sub_menu], "r");

$g5['title'] = "엑셀입력";
//include_once(G5_PATH.'/head.sub.php');
include_once('../admin.head.php');
?>

<div class="new_win">
    <!--<h1><?php echo $g5['title']; ?></h1>-->

    <div class="local_desc01 local_desc">
        <p>
        </p>

        <p>
            엑셀파일을 이용하여 회원을 일괄등록할 수 있습니다.<br>
            형식은 <strong>회원일괄등록용 엑셀파일</strong>을 다운로드하여 회원 정보를 입력하시면 됩니다.<br>
            수정 완료 후 엑셀파일을 업로드하시면 회원정보가 일괄등록됩니다.<br>
            엑셀파일을 저장하실 때는 <strong>Excel 97 - 2003 통합문서 (*.xls)</strong> 로 저장하셔야 합니다.
        </p>
        <p>
            <a href="./memberexcel.xls">신규회원일괄등록용 엑셀파일 다운로드</a>
        </p>
    </div>

    <!--<form name="mbxlsupload" method="post" action="./member_xls_upload.php" enctype="MULTIPART/FORM-DATA" autocomplete="off">
    <div id="excelfile_upload">
        <label for="excelfile">파일선택</label>
        <input type="file" name="excelfile" id="excelfile">
    </div>

    <div class="btn_confirm01 btn_confirm">
        <input type="submit" value="신규회원 엑셀파일 등록" class="btn_submit">
        <button type="button" onclick="window.close();">닫기</button>
    </div>
    </form>-->



	    <form name="mbxlsupload" method="post" action="./member_xls_upload_csv.php" enctype="MULTIPART/FORM-DATA" autocomplete="off">
    <div id="excelfile_upload">
        <label for="excelfile">1.csv 파일선택</label>
        <input type="file" name="excelfile" id="excelfile">
    </div>

    <div class="btn_confirm01 btn_confirm">
		<input type="button" class="btn_submit" value="일반회원 다운로드" onclick="document.location.href='./member_xls_download1.php';">
		<input type="button" class="btn_submit" value="상담사 회원 다운로드" onclick="document.location.href='./member_xls_download.php';">
        <input type="submit" value="신규회원 엑셀파일 등록" class="btn_submit">
    </div>
    </form>


	<hr>

    <form name="mbxlsupdate" method="post" action="./member_xls_upload_csv_mtonet.php" enctype="MULTIPART/FORM-DATA" autocomplete="off">
    <div id="excelfile_upload">
        <label for="excelfile">2파일선택</label>
        <input type="file" name="excelfile" id="excelfile">
    </div>
    <div class="btn_confirm01 btn_confirm">
        
        <input type="submit" value="csv .회원정보 엠투넷 등록" class="btn_submit">
        <button type="button" onclick="window.close();">닫기</button>
    </div>
    </form>

</div>

<?php
include_once(G5_PATH.'/tail.sub.php');