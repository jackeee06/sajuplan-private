<?php
$sub_menu = '350520';
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, "w");

check_admin_token();

@mkdir(G5_DATA_PATH."/coupon", G5_DIR_PERMISSION);
@chmod(G5_DATA_PATH."/coupon", G5_DIR_PERMISSION);

$_POST = array_map('trim', $_POST);




$check_sanitize_keys = array(
    'cz_subject',       // 쿠폰이름
    'cz_type',          // 발행쿠폰타입
    'cz_start',         // 사용시작일
    'cz_end',           // 사용종료일
    'cz_period',        // 쿠폰사용기한
    'cz_point',         // 쿠폰교환 포인트
    'cp_method',        // 발급쿠폰종류
    'cp_target',        // 적용상품
    'cp_price',         // 할인금액
    'cp_type',          // 할인금액타입
    'cp_trunc',         // 절사금액
    'cp_minimum',       // 최소주문금액
    'cp_maximum',       // 최대할인금액
);



foreach( $check_sanitize_keys as $key ){
    $$key = $_POST[$key] = isset($_POST[$key]) ? strip_tags(clean_xss_attributes($_POST[$key])) : '';
}

if(!$_POST['cz_subject'])
    alert('쿠폰이름을 입력해 주십시오.');

if(!$_POST['cz_start'] || !$_POST['cz_end'])
    alert('사용 시작일과 종료일을 입력해 주십시오.');

if($_POST['cz_start'] > $_POST['cz_end'])
    alert('사용 시작일은 종료일 이전으로 입력해 주십시오.');

if($_POST['cz_end'] < G5_TIME_YMD)
    alert('종료일은 오늘('.G5_TIME_YMD.')이후로 입력해 주십시오.');

if($_POST['cz_type'] && !$_POST['cz_point'])
    alert('쿠폰교환 포인트를 입력해 주십시오.');

if(!$_POST['cz_period'])
    alert('쿠폰사용기한을 입력해 주십시오.');

if( isset($_FILES['cp_img']) && !empty($_FILES['cp_img']['name']) ){
    if( !preg_match('/\.(gif|jpe?g|bmp|png)$/i', $_FILES['cp_img']['name']) ){
        alert("이미지 파일만 업로드 할수 있습니다.");
    }

    $timg = @getimagesize($_FILES['cp_img']['tmp_name']);
    if ($timg['2'] < 1 || $timg['2'] > 16){
        alert("이미지 파일만 업로드 할수 있습니다.");
    }
}

if($_POST['cp_method'] == 0 && !$_POST['cp_target'])
    alert('적용상품을 입력해 주십시오.');

if($_POST['cp_method'] == 1 && !$_POST['cp_target'])
    alert('적용분류를 입력해 주십시오.');



// 
// if($_POST['cp_method']!="4"){
// 	if(!$_POST['cp_price']) {
// 		if($_POST['cp_type'])
// 			alert('할인비율을 입력해 주십시오.');
// 		else
// 			alert('할인금액을 입력해 주십시오.');
// 	}
// }

// if( (int) $_POST['cp_price'] < 0 ){
//     alert('할인금액 또는 할인비율은 음수를 입력할수 없습니다.');
// }

// if($_POST['cp_type'] && ($_POST['cp_price'] < 1 || $_POST['cp_price'] > 99))
//     alert('할인비율을은 1과 99사이 값으로 입력해 주십시오.');

// if($_POST['cp_method'] == 0) {
//     $sql = " select count(*) as cnt from {$g5['g5_shop_item_table']} where it_id = '$cp_target' and it_nocoupon = '0' ";
//     $row = sql_fetch($sql);
//     if(!$row['cnt'])
//         alert('입력하신 상품코드는 존재하지 않는 코드이거나 쿠폰적용안함으로 설정된 상품입니다.');
// } else if($_POST['cp_method'] == 1) {
//     $sql = " select count(*) as cnt from {$g5['g5_shop_category_table']} where ca_id = '$cp_target' and ca_nocoupon = '0' ";
//     $row = sql_fetch($sql);
//     if(!$row['cnt'])
//         alert('입력하신 분류코드는 존재하지 않는 분류코드이거나 쿠폰적용안함으로 설정된 분류입니다.');
// }


if($_POST["chk_all_mb"]){ // (특정 타켓 X)
	$_POST["ids"] = "allmember";
}

// 우선 체크확인
if( isset($_POST['ids']) && $_POST['ids'] !== 'allmember' ){
    $ids_arr = array_filter(array_map('trim', explode(',', $_POST['ids'])));
} else {
    $ids_arr = [];
}

// if(count($ids_arr) < 1){
//     alert('지급하실 회원을 먼저 지정해주세요.');
// }

//[입력코드의 쿠폰발행은]쿠폰번호를 먼저 선 생성해야함.
//(다운로드 하지않은 회원들의 쿠폰은 선 전체 삭제 처리함) (특정 타켓 발송만 삭제처리)

$sql_common = " cz_subject  = '{$_POST['cz_subject']}',
                cz_start    = '{$_POST['cz_start']}',
                cz_end      = '{$_POST['cz_end']}',
                cz_period   = '{$_POST['cz_period']}',
                cz_point    = '{$_POST['cz_point']}',
                cp_method   = '{$_POST['cp_method']}',
                cp_target   = '{$_POST['cp_target']}',
                cp_price    = '{$_POST['cp_price']}',
                cp_type     = '{$_POST['cp_type']}',
                cp_trunc    = '{$_POST['cp_trunc']}',
                cp_minimum  = '{$_POST['cp_minimum']}',
                cp_maximum  = '{$_POST['cp_maximum']}',
				ids = '{$_POST['ids']}'";

if($w == '') {

    if(!$_FILES['cp_img']['name'])
        alert('쿠폰이미지를 업로드해 주십시오.');
    //쿠폰 ID를 발급 
    if($_POST['cz_type'] == "3"){
       $cp_id = get_coupon_id();
    }
    
    //전체 회원에게 알림톡 발송?


    $sql = " INSERT INTO {$g5['g5_shop_coupon_zone_table']}
                set $sql_common,
                    cz_datetime = '".G5_TIME_YMDHIS."' 
                    ";
    if($_POST['cz_type'] == "3"){
        $sql = $sql.",
                    cp_id = '{$cp_id}',
                    cz_type     = '{$_POST['cz_type']}'
                    ";
    }
                    
    //미리 쿠폰 코드를 만들어서 넣어야할것 같기도함.
    sql_query($sql, true);
    $cz_id     = sql_insert_id();
    $now_date  = date('Y-m-d H:i:s');


    // if($_POST['cz_type'] == "3"){ //특정 타켓회원들에게 쿠폰은 미리 발급되어야함(쿠폰코드 선발급 - 알림톡 관련 처리 필요
    //   foreach ($ids_arr as $ids) {
    //     $query = "
    //     select
    //      count(cp_no) as cnt
    //     from
    //      g5_shop_coupon
    //     where
    //      cz_id = '{$cz_id}'
    //     and
    //      mb_id = '{$ids}'
    //     ";
    //     $cp_row = sql_fetch($query);
    //     //지급 되지않은 사람에게만 지급 처리(미리 쿠폰코드 선 발급)
    //     if((int)$cp_row['cnt'] == 0){
            
    //         $cp_id = get_coupon_id();
            // $sql_common_shop_coupon = "
            //     cp_id       = '{$cp_id}',
            //     cp_subject  = '{$_POST['cz_subject']}',
            //     cp_method   = '{$_POST['cp_method']}',
            //     cp_target   = '{$_POST['cp_target']}',
            //     mb_id       = '{$ids}',
            //     cz_id       = '{$cz_id}',
            //     cp_start    = '{$_POST['cz_start']}',
            //     cp_end      = '{$_POST['cz_end']}',
            //     cp_price    = '{$_POST['cz_point']}',
            //     cp_type     = '{$_POST['cp_type']}',
            //     cp_trunc    = '{$_POST['cp_trunc']}',
            //     cp_minimum  = '{$_POST['cp_minimum']}',
            //     cp_maximum  = '{$_POST['cp_maximum']}',
            //     cz_type     = '{$_POST['cz_type']}',
            //     cp_show     = 'N',
            //     cp_datetime = '{$now_date}'
            // ";
            // // 쿠폰을 입력 처리를 안했기때문에 우선 발급만
            // $sql = "INSERT INTO g5_shop_coupon set $sql_common_shop_coupon";
            // sql_query($sql);

    //     }
    //   }
    // }


} else if($w == 'u') {

    $sql = " select * from {$g5['g5_shop_coupon_zone_table']} where cz_id = '$cz_id' ";
    $cp = sql_fetch($sql);

    if(! (isset($cp['cz_id']) && $cp['cz_id']))
        alert('쿠폰정보가 존재하지 않습니다.', './couponzonelist.php');

    if ((isset($_POST['cp_img_del']) && $_POST['cp_img_del']) && $cp['cz_file']) {
        @unlink(G5_DATA_PATH."/coupon/{$cp['cz_file']}");
        $cp['cz_file'] = '';
    }

    if(!$cp['cz_file'] && !$_FILES['cp_img']['name'])
        alert('쿠폰이미지를 업로드해 주십시오.');

    $sql = " update {$g5['g5_shop_coupon_zone_table']}
                set $sql_common
                where cz_id = '$cz_id' ";

    sql_query($sql);

    
    foreach ($ids_arr as $ids) {


    }


}

// 이미지업로드
if($_FILES['cp_img']['tmp_name']) {
    preg_match('#.+\.([a-z]+)$#', $_FILES['cp_img']['name'], $m);
    $filename = date('YmdHis').(microtime(true) * 10000).'.'.strtolower($m[1]);

    upload_file($_FILES['cp_img']['tmp_name'], $filename, G5_DATA_PATH."/coupon");

    $sql = " update {$g5['g5_shop_coupon_zone_table']}
                set cz_file = '$filename'
                where cz_id = '$cz_id' ";
    sql_query($sql);
}

goto_url('./couponzonelist.php?'.$qstr);