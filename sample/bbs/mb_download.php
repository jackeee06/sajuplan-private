<?php
include_once('./_common.php');

// clean the output buffer
ob_end_clean();

$no = (int)$no;

//@include_once($board_skin_path.'/download.head.skin.php');

//if (!get_session('ss_mbld_'.$mb_id.'_'.$no))
  // alert('잘못된 접근입니다.');

// 비회원은 다운로드 불가, 본인 파일만 다운가능, 최고관리자는 pass
if($member['mb_id'] != $mb_id || $is_guest ){
    if($is_admin != 'super')
        alert('본인의 파일만 다운로드 됩니다.');
}

$sql = " select bf_source, bf_file from g5_member_file where mb_id = '$mb_id' and bf_no = '$no' ";
$file = sql_fetch($sql);
if (!$file['bf_file'])
    alert_close('파일 정보가 존재하지 않습니다.');


$filepath = G5_DATA_PATH.'/member2/'.$mb_id.'/'.$file['bf_file'];
$filepath = addslashes($filepath);
if (!is_file($filepath) || !file_exists($filepath))
    alert('파일이 존재하지 않습니다.');

// 사용자 코드 실행
@include_once($board_skin_path.'/download.skin.php');

// 이미 다운로드 받은 파일인지를 검사한 후 다운로드 카운트 증가 ( SIR 그누위즈 님 코드 제안 )
$ss_name = 'ss_down_'.$mb_id.'_'.$no;
if (!get_session($ss_name))
{
    // 다운로드 카운트 증가
    $sql = " update g5_member_file set bf_download = bf_download + 1 where mb_id = '$mb_id' and bf_no = '$no' ";
    sql_query($sql);
    // 다운로드 카운트를 증가시키고 세션을 생성
    $_SESSION[$ss_name] = true;
}

$g5['title'] = '다운로드 &gt; '.conv_subject($write['wr_subject'], 255);

//파일명에 한글이 있는 경우
if(preg_match("/[\xA1-\xFE][\xA1-\xFE]/", $file['bf_source'])){
    $original = iconv('utf-8', 'euc-kr', $file['bf_source']); // SIR 잉끼님 제안코드
} else {
    $original = urlencode($file['bf_source']);
}

@include_once($board_skin_path.'/download.tail.skin.php');

if(preg_match("/msie/i", $_SERVER['HTTP_USER_AGENT']) && preg_match("/5\.5/", $_SERVER['HTTP_USER_AGENT'])) {
    header("content-type: doesn/matter");
    header("content-length: ".filesize("$filepath"));
    header("content-disposition: attachment; filename=\"$original\"");
    header("content-transfer-encoding: binary");
} else if (preg_match("/Firefox/i", $_SERVER['HTTP_USER_AGENT'])){
    header("content-type: file/unknown");
    header("content-length: ".filesize("$filepath"));
    header("content-disposition: attachment; filename=\"".basename($file['bf_source'])."\"");
    header("content-description: php generated data");
} else {
    header("content-type: file/unknown");
    header("content-length: ".filesize("$filepath"));
    header("content-disposition: attachment; filename=\"$original\"");
    header("content-description: php generated data");
}
header("pragma: no-cache");
header("expires: 0");
flush();

$fp = fopen($filepath, 'rb');

// 4.00 대체
// 서버부하를 줄이려면 print 나 echo 또는 while 문을 이용한 방법보다는 이방법이...
//if (!fpassthru($fp)) {
//    fclose($fp);
//}

$download_rate = 10;

while(!feof($fp)) {
    //echo fread($fp, 100*1024);
    /*
    echo fread($fp, 100*1024);
    flush();
    */

    print fread($fp, round($download_rate * 1024));
    flush();
    usleep(1000);
}
fclose ($fp);
flush();
?>
