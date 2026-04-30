<?php
include_once('./_common.php');



// 테마에 coupon.php 있으면 include
if(defined('G5_THEME_MSHOP_PATH')) {
    $theme_coupon_file = G5_THEME_MSHOP_PATH.'/coupon.php';

	///home/dfsoft_thesaju/www/theme/basic/mobile/shop/coupon.php

    if(is_file($theme_coupon_file)) {
        include_once($theme_coupon_file);
        return;
        unset($theme_coupon_file);
    }
}

if ($is_guest)
    //alert_close('회원만 조회하실 수 있습니다.');
	alert('로그인이 필요한 서비스입니다', G5_BBS_URL.'/login.php?'.$qstr.'&url='.urlencode(G5_SHOP_URL.'/coupon.php'));
	
	
//$g5['title'] = $member['mb_nick'].' 님의 쿠폰 내역';
$g5['title'] = '쿠폰함';


//include_once(G5_PATH.'/head.sub.php');
include_once(G5_PATH.'/head.php');

//$sql = " select cp_id, cp_subject, cp_method, cp_target, cp_start, cp_end, cp_type, cp_price
            //from {$g5['g5_shop_coupon_table']}
            //where mb_id IN ( '{$member['mb_id']}', '전체회원' )
              //and cp_start <= '".G5_TIME_YMD."'
              //and cp_end >= '".G5_TIME_YMD."'
            //order by cp_no ";
//$result = sql_query($sql);

// 여기 수정 필요
$sql = " select cp_id, cp_subject, cp_method, cp_target, cp_start, cp_end, cp_type, cp_price
, (select cz_file from {$g5['g5_shop_coupon_zone_table']} where cz_id = {$g5['g5_shop_coupon_table']}.cz_id) as cz_file
            from {$g5['g5_shop_coupon_table']}
            where mb_id IN ( '{$member['mb_id']}', '전체회원' )
              and cp_start <= '".G5_TIME_YMD."'
              and cp_end >= '".G5_TIME_YMD."'
            order by cp_no ";

$result = sql_query($sql);

?>

<style>
.top_nav_01 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}

#scp_list {
    width: 100%;
    float: left;
}
</style>


<?php include_once(G5_PATH.'/include/coupon_navi.php'); ?>


<!-- 쿠폰 내역 시작 { -->
<div id="scp_list" class="couponzone_list new_win">
    <!--<h1 id="win_title"><?php //echo $g5['title'] ?></h1>-->
    <p style="padding: 20px 20px 0; line-height: 30px; font-size: 18px; text-align: left; font-weight: bold;">내 쿠폰</p>
    <ul>
    <?php
    $cp_count = 0;
    for($i=0; $row=sql_fetch_array($result); $i++) {
        if(is_used_coupon($member['mb_id'], $row['cp_id']))
            continue;

        if($row['cp_method'] == 1) {
            $sql = " select ca_name from {$g5['g5_shop_category_table']} where ca_id = '{$row['cp_target']}' ";
            $ca = sql_fetch($sql);
            $cp_target = $ca['ca_name'].'의 상품할인';
        } else if($row['cp_method'] == 2) {
            $cp_target = '결제금액 할인';
        } else if($row['cp_method'] == 3) {
            $cp_target = '배송비 할인';
		} else if($row['cp_method'] == 4) {
            $cp_target = '포인트 쿠폰';
        } else {
            $it = get_shop_item($row['cp_target'], true);
            $cp_target = $it['it_name'].' 상품할인';
        }

        if($row['cp_type'])
            $cp_price = '<strong>'.$row['cp_price'].'</strong> %';
        else
            $cp_price = '<strong>'.number_format($row['cp_price']).'</strong> 원';

        $cp_count++;


		$img_file = G5_DATA_PATH.'/coupon/'.$row['cz_file'];

		//echo $img_file;



    ?>
    <li>
    	<div class="cp_inner" style="padding:10px; border:1px solid #eee; box-shadow:0px 1px 6px 0 #dedede; border-radius: 5px;">
    	
		<?php if ($row['cz_file']) { ?>
			<img src="<?php echo str_replace(G5_PATH, G5_URL, G5_DATA_PATH.'/coupon/'.$row['cz_file']) ?>">
        <?php } else    { ?>
            <img src="<?php echo G5_IMG_URL; ?>/common/basic_coupon.png" />
		<?php } ?>

        <div class="cou_top">
            <div class="cou_tit"><?php echo $row['cp_subject']; ?></div>
            <span class="cou_pri"><?php echo $cp_price; ?></span>
        </div>
        <div>
            <span class="cou_target"><?php echo $cp_target; ?> <i class="fa fa-angle-right" aria-hidden="true"></i></span>
            <span class="cou_date"><?php echo substr($row['cp_start'], 2, 8); ?> ~ <?php echo substr($row['cp_end'], 2, 8); ?></span>
        </div>
        </div>
    </li>
    <?php
    }

    if(!$cp_count)
        echo '<li class="empty_list">사용할 수 있는 쿠폰이 없습니다.</li>';
    ?>
    </ul>

    <!--<div class="win_btn"><button type="button" onclick="window.close();" class="btn_close">창닫기</button></div>-->
</div>

<?php
//include_once(G5_PATH.'/tail.sub.php');
include_once(G5_PATH.'/tail.php');