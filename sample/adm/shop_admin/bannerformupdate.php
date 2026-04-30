<?php
$sub_menu = '350600';
include_once('./_common.php');

check_demo();

$w = isset($_REQUEST['w']) ? $_REQUEST['w'] : '';

if ($w == 'd')
    auth_check_menu($auth, $sub_menu, "d");
else
    auth_check_menu($auth, $sub_menu, "w");

check_admin_token();

@mkdir(G5_DATA_PATH . "/banner", G5_DIR_PERMISSION);
@chmod(G5_DATA_PATH . "/banner", G5_DIR_PERMISSION);

$bn_bimg = isset($_FILES['bn_bimg']['tmp_name']) ? $_FILES['bn_bimg']['tmp_name'] : '';
$bn_bimg_name = isset($_FILES['bn_bimg']['name']) ? $_FILES['bn_bimg']['name'] : '';
$bn_id = isset($_REQUEST['bn_id']) ? preg_replace('/[^0-9]/', '', $_REQUEST['bn_id']) : 0;
$bn_bimg_del = (isset($_POST['bn_bimg_del']) && $_POST['bn_bimg_del']) ? preg_replace('/[^0-9]/', '', $_POST['bn_id']) : 0;
$bn_url = isset($_POST['bn_url']) ? strip_tags(clean_xss_attributes($bn_url)) : '';
$bn_alt = isset($_POST['bn_alt']) ? strip_tags(clean_xss_attributes($bn_alt)) : '';
$bn_device = isset($_POST['bn_device']) ? clean_xss_tags($_POST['bn_device'], 1, 1) : '';
$bn_position = isset($_POST['bn_position']) ? clean_xss_tags($_POST['bn_position'], 1, 1) : '';
$bn_border = isset($_POST['bn_border']) ? (int)$_POST['bn_border'] : 0;
$bn_new_win = isset($_POST['bn_new_win']) ? (int)$_POST['bn_new_win'] : 0;
$bn_begin_time = isset($_POST['bn_begin_time']) ? clean_xss_tags($_POST['bn_begin_time'], 1, 1) : '';
$bn_end_time = isset($_POST['bn_end_time']) ? clean_xss_tags($_POST['bn_end_time'], 1, 1) : '';
$bn_order = isset($_POST['bn_order']) ? (int)$_POST['bn_order'] : 0;

//if ($bn_bimg_del) @unlink(G5_DATA_PATH . "/banner/$bn_id");
if ($bn_bimg_del) {
    foreach (glob(G5_DATA_PATH . "/banner/{$bn_id}.*") as $old) @unlink($old);
    @unlink(G5_DATA_PATH . "/banner/{$bn_id}"); // 구버전 무확장자 잔재
}

// 20250716 eun 배너에 .mp4 업로드 가능 작업 시작 (최대 600kb)
//파일이 이미지인지, .mp4인지 체크합니다.
/*if ($bn_bimg || $bn_bimg_name) {
    //확장자 확인
    $ext = strtolower(pathinfo($bn_bimg_name, PATHINFO_EXTENSION));
    //PATHINFO_EXTENSION는 확장자만 반환
    if (in_array($ext, ['gif', 'jpg', 'jpeg', 'bmp', 'png', 'webp'])) {
        // $timg = @getimagesize($bn_bimg);
        //  if (!$timg || $timg[2] < 1 || $timg[2] > 16) {
         //     alert("유효한 이미지 파일만 업로드할 수 있습니다.");
         // }
        // 기존
        $timg = @getimagesize($bn_bimg);
        if (!$timg || $timg[2] < 1 || $timg[2] > 16) alert("유효한 이미지 파일만 업로드할 수 있습니다.");

        // 교체
        $timg = @getimagesize($bn_bimg);

        // PHP에 IMAGETYPE_WEBP 상수가 없는 구버전 대비
        if (!defined('IMAGETYPE_WEBP')) define('IMAGETYPE_WEBP', 18);

        $allowed_types = [
            IMAGETYPE_GIF, IMAGETYPE_JPEG, IMAGETYPE_PNG,
            IMAGETYPE_BMP, IMAGETYPE_WEBP
        ];

        if (!$timg || !in_array((int)$timg[2], $allowed_types, true)) {
            alert("유효한 이미지 파일만 업로드할 수 있습니다. (gif, jpg, png, bmp, webp)");
        }


    } elseif ($ext === 'mp4') {
        // — MP4: MIME 타입 + 용량 체크
        // 임시 파일과 크기 정보가 필요
        $tmp = $_FILES['bn_bimg']['tmp_name'] ?? '';
        $size = $_FILES['bn_bimg']['size'] ?? 0;
        if (!$tmp || mime_content_type($tmp) !== 'video/mp4') {
            alert("유효한 MP4 파일만 업로드 할 수 있습니다.");
        }
        if ($size > 600 * 1024) {
            alert("MP4 파일은 최대 600KB 이하만 업로드할 수 있습니다.");
        }
    } else {
        alert("이미지 또는 600KB 이하의 MP4 파일만 업로드할 수 있습니다.");
    }
}*/
//확장자 확인
// if ($bn_bimg_del) ... 삭제 블록은 그대로 유지

// === 여기부터 업로드 검증: 새 파일이 있을 때만 실행 ===
if (!empty($_FILES['bn_bimg']['name'])) {
    $bn_bimg      = $_FILES['bn_bimg']['tmp_name'] ?? '';
    $bn_bimg_name = $_FILES['bn_bimg']['name'] ?? '';
    $ext = strtolower(pathinfo($bn_bimg_name, PATHINFO_EXTENSION));

    if (in_array($ext, ['gif','jpg','jpeg','bmp','png','webp'], true)) {
        $timg = @getimagesize($bn_bimg);

        // PHP 구버전 대비 (IMAGETYPE_WEBP 상수 없을 수 있음)
        if (!defined('IMAGETYPE_WEBP')) define('IMAGETYPE_WEBP', 18);

        $allowed_types = [IMAGETYPE_GIF, IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_BMP, IMAGETYPE_WEBP];
        if (!$timg || !in_array((int)$timg[2], $allowed_types, true)) {
            alert("유효한 이미지 파일만 업로드할 수 있습니다. (gif, jpg, png, bmp, webp)");
        }
    }
    elseif ($ext === 'mp4') {
        $tmp  = $_FILES['bn_bimg']['tmp_name'] ?? '';
        $size = $_FILES['bn_bimg']['size'] ?? 0;

        if (!$tmp || mime_content_type($tmp) !== 'video/mp4') {
            alert("유효한 MP4 파일만 업로드 할 수 있습니다.");
        }
        if ($size > 600 * 1024) {
            alert("MP4 파일은 최대 600KB 이하만 업로드할 수 있습니다.");
        }
    }
    else {
        alert("이미지 또는 600KB 이하의 MP4 파일만 업로드할 수 있습니다.");
    }
}
// === 업로드 검증 끝 ===


// 20250716 eun 배너에 .mp4 업로드 가능 작업 마감
if ($w == "") {
    if (!$bn_bimg_name) alert('배너 이미지를 업로드 하세요.');

    sql_query(" alter table {$g5['g5_shop_banner_table']} auto_increment=1 ");

    $sql = " insert into {$g5['g5_shop_banner_table']}
                set bn_alt        = '$bn_alt',
                    bn_url        = '$bn_url',
                    bn_device     = '$bn_device',
                    bn_position   = '$bn_position',
                    bn_border     = '$bn_border',
                    bn_new_win    = '$bn_new_win',
                    bn_begin_time = '$bn_begin_time',
                    bn_end_time   = '$bn_end_time',
                    bn_time       = '" . G5_TIME_YMDHIS . "',
                    bn_hit        = '0',
                    bn_order      = '$bn_order' ";
    sql_query($sql);

    $bn_id = sql_insert_id();
} else if ($w == "u") {
    $sql = " update {$g5['g5_shop_banner_table']}
                set bn_alt        = '$bn_alt',
                    bn_url        = '$bn_url',
                    bn_device     = '$bn_device',
                    bn_position   = '$bn_position',
                    bn_border     = '$bn_border',
                    bn_new_win    = '$bn_new_win',
                    bn_begin_time = '$bn_begin_time',
                    bn_end_time   = '$bn_end_time',
                    bn_time       = '" . G5_TIME_YMDHIS . "',
                    bn_order      = '$bn_order'
              where bn_id = '$bn_id' ";
    sql_query($sql);
    /*} else if ($w == "d") {
        @unlink(G5_DATA_PATH . "/banner/$bn_id");

        $sql = " delete from {$g5['g5_shop_banner_table']} where bn_id = $bn_id ";
        $result = sql_query($sql);
    }*/
} else if ($w == "d") {
    foreach (glob(G5_DATA_PATH . "/banner/{$bn_id}.*") as $old) @unlink($old);
    @unlink(G5_DATA_PATH . "/banner/{$bn_id}"); // 구버전 잔재

    $sql = " delete from {$g5['g5_shop_banner_table']} where bn_id = $bn_id ";
    $result = sql_query($sql);
}


/*
if ($w == "" || $w == "u") {
    if ($_FILES['bn_bimg']['name']) upload_file($_FILES['bn_bimg']['tmp_name'], $bn_id, G5_DATA_PATH . "/banner");

    goto_url("./bannerform.php?w=u&amp;bn_id=$bn_id");
} else {
    goto_url("./bannerlist.php");
}*/

if ($w == "" || $w == "u") {
    if (!empty($_FILES['bn_bimg']['name'])) {
        // 기존 같은 bn_id 파일 모두 삭제 (확장자 포함 + 무확장자)
        foreach (glob(G5_DATA_PATH . "/banner/{$bn_id}.*") as $old) @unlink($old);
        @unlink(G5_DATA_PATH . "/banner/{$bn_id}");

        // 업로드 확장자 기준으로 저장
        $ext = strtolower(pathinfo($_FILES['bn_bimg']['name'], PATHINFO_EXTENSION));
        $save_name = "{$bn_id}.{$ext}";
        upload_file($_FILES['bn_bimg']['tmp_name'], $save_name, G5_DATA_PATH . "/banner");
    }

    goto_url("./bannerform.php?w=u&amp;bn_id=$bn_id");
} else {
    goto_url("./bannerlist.php");
}
