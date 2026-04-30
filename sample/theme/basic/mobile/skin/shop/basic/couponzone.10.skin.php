<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.G5_SHOP_CSS_URL.'/style.css">', 0);

$g5['title'] = "쿠폰";
?>

<style>
.top_nav_02 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}

.couponzone_list,
.couponzone_list ul { width:100%; float:left;}

#point_coupon,
#scp_list {width:100%; float:left;}


#point_coupon li,
#scp_list li {    width: 100%;
    float: left;
    text-align: left; padding:10px 0;}
	
#scp_list { border-top:1px solid #eee;}	
	
#point_coupon img { width:100%;}

#point_coupon .cp_evt { display:none;}

.cp_inner {padding:10px; border:1px solid #eee; box-shadow:0px 1px 6px 0 #dedede; border-radius: 5px;}

.no_coupon { padding:30px; text-align:center;}

.coupon_btn { width:100%;}


.coupon_tit { font-size: 1.25em;
    font-weight: bold;
    margin-top: 20px;  display: flex; justify-content: space-between;}
	
.cp_evt { color: #465bf0;}

.cp_cnt { padding:10px 0px 0; display:flex; justify-content: space-between;}

.coupon_info_btn {color: #999;
    background: #f5f5f5;
    padding: 5px;
    line-height: 20px;
    font-size: 0.92em;
    border-radius: 5px;}
	
.coupon_date { color: #888d92;}

.coupon_info { /*display:none !important;*/}
</style>


<?php include_once(G5_PATH.'/include/coupon_navi.php'); ?>
<!--
<div style="width:100%; float:left; padding:20px; background-color:#f5f5f5;">
	<a href="../shop/coupon.php">
    <ul class="point_bg  white" style=" width:100%; float:left; padding:20px 14px; text-align:center; border-radius:6px; font-weight:600; font-size:16px;">내 쿠폰 확인</ul>
    </a>
</div>
-->

<section class="couponzone_list" id="point_coupon">
    <h2 style="padding: 20px; line-height: 30px; font-size: 18px; text-align:left; font-weight:bold;">
    	포인트 쿠폰
        <span style="color:#999; display:inline-block; font-size:14px; margin-left:6px; font-weight:400; float:right;"><i class="xi-info-o" style="font-size:16px; vertical-align:-2px;"></i> 다운로드 1회, 즉시 포인트가 지급됩니다</span>
    </h2>
    <!--<p style="margin:10px 20px 0; padding:10px; background-color:#f5f5f5; border-radius:4px; text-align:left;">회원이시라면 다운로드 후 포인트를 바로 사용하실 수 있습니다.</p>-->

    <?php

	$ad_sql = "";

	if($member["mb_id"]){
		$ad_sql = " and (ids='allmember' or FIND_IN_SET('".$member["mb_id"]."', ids) > 0) ";
	}else{
		$ad_sql = " and 1=2";
	}

    $sql = " select * $sql_common and (
        cz_type = '2' 
    ) {$ad_sql} $sql_order ";


    //     or 
    //     ( 
    //       cz_type = '3' 
    //       and cz_id in (select cz_id from {$g5['g5_shop_coupon_table']} where mb_id = '{$member['mb_id']}')
    //     ) 

	//echo $sql;
	//echo "<br>";

    $result = sql_query($sql);

    $coupon = '';
    $coupon_info_class = '';

    for($i=0; $row=sql_fetch_array($result); $i++) {
        if(!$row['cz_file'])
            continue;

        $img_file = G5_DATA_PATH.'/coupon/'.$row['cz_file'];
        if(!is_file($img_file))
            continue;

        $subj = get_text($row['cz_subject']);

        switch($row['cp_method']) {
            case '0':
                $row3 = get_shop_item($row['cp_target'], true);
				$cp_link = '<a href="'.shop_item_url($row3['it_id']).'" target="_blank">'.get_text($row3['it_name']).'</a>';
                $cp_target = '개별상품할인';
                $coupon_info_class = 'cp_2';
                break;
            case '1':
                $sql3 = " select ca_id, ca_name from {$g5['g5_shop_category_table']} where ca_id = '{$row['cp_target']}' ";
                $row3 = sql_fetch($sql3);
                $cp_link = '<a href="'.shop_category_url($row3['ca_id']).'" target="_blank">'.get_text($row3['ca_name']).'</a>';
                $cp_target = '카테고리할인';
                $coupon_info_class = 'cp_1';
                break;
            case '2':
                $cp_link = $cp_target = '주문금액할인';
                $coupon_info_class = 'cp_3';
                break;
            case '3':
                $cp_link = $cp_target = '배송비할인';
                $coupon_info_class = 'cp_4';
                break;
        }
		if($row["cz_type"]=="2"){
				$cp_link = $cp_target = '포인트증가';
                $coupon_info_class = 'cp_3';
		}

        // 다운로드 쿠폰인지
        $disabled = '';
        if(is_coupon_downloaded($member['mb_id'], $row['cz_id'])){
            $disabled = ' disabled';
		
		}

        // $row['cp_type'] 값이 있으면 % 이며 없으면 원 입니다.
        $print_cp_price = $row['cp_type'] ? '<b>'.$row['cp_price'].'</b> %' : '<b>'.number_format($row['cp_price']).'</b> 원';

        $coupon .= '<li>'.PHP_EOL;
		$coupon .= '<div class="cp_inner">'.PHP_EOL;
        $coupon .= '<div class="coupon_img"><img src="'.str_replace(G5_PATH, G5_URL, $img_file).'" alt="'.$subj.'">'.PHP_EOL;
        $coupon .= '<div class="coupon_tit"><span>'.$subj.'</span><br><span class="cp_evt">'.$print_cp_price.'</span></div>'.PHP_EOL;
		$coupon .= '</div>'.PHP_EOL;
		$coupon .= '<div class="cp_cnt">'.PHP_EOL;
		$coupon .= '<div class="coupon_target">'.PHP_EOL;
		$coupon .= '<span class="sound_only">적용</span><button class="coupon_info_btn '.$coupon_info_class.'">'.$cp_target.' <i class="fa fa-angle-right" aria-hidden="true"></i></button>'.PHP_EOL;
        $coupon .= '<div class="coupon_info">
        <h4>'.$cp_target.'</h4>
        <ul>
        	<li>적용 : '.$cp_link.'</li>';

        if( $row['cp_minimum'] ){   // 쿠폰에 최소주문금액이 있다면
        	$coupon .= '<li>최소주문금액 : <span class="cp_evt"><b>'.number_format($row['cp_minimum']).'</b>원</span></li>';
        }

        $coupon .= '</ul>
        <button class="coupon_info_cls"><i class="fa fa-times" aria-hidden="true"></i><span class="sound_only">닫기</span></button>
        </div>'.PHP_EOL;
		
        $coupon .= '</div>'.PHP_EOL;		
		$coupon .= '<div class="coupon_date"><span class="sound_only">기한</span>다운로드 후 '.number_format($row['cz_period']).'일</div>'.PHP_EOL;
		
		
		
        $coupon .= '</div>'.PHP_EOL;
		
        // 포인트 쿠폰이라서 증가적인 포인트 값이 있음.
		$coupon .= '<div class="coupon_btn"><button type="button" class="coupon_download btn02 point_bg point_bo'.$disabled.'" data-cid="'.$row['cz_id'].'">포인트(코인) '.number_format($row['cz_point']).'점 증가</button></div>'.PHP_EOL;
		
        $coupon .= '</li>'.PHP_EOL;
    }

    if($coupon)
        echo '<ul>'.PHP_EOL.$coupon.'</ul>'.PHP_EOL;
    else
        echo '<p class="no_coupon">다운로드 할 수 있는 쿠폰이 없습니다.</p>';
    ?>
</section>

<section id="scp_list" class="couponzone_list">
    <h2 style="padding: 20px; line-height: 30px; font-size: 18px; text-align:left; font-weight:bold;">
    	다운로드 쿠폰
        <span style="color:#999; display:inline-block; font-size:14px; margin-left:6px; font-weight:400; float:right;"><i class="xi-info-o" style="font-size:16px; vertical-align:-2px;"></i> 다운로드 후 바로 사용하실 수 있습니다.</span>
    </h2>
    <!--<p style="margin:10px 20px 0; padding:10px; background-color:#f5f5f5; border-radius:4px; text-align:left;"><?php //echo $default['de_admin_company_name']; ?>회원이시라면 쿠폰 다운로드 후 바로 사용하실 수 있습니다.</p>-->

    <?php
	$ad_sql = "";
	if($member["mb_id"]){
		$ad_sql = " and (ids='allmember' or ids like '%".$member["mb_id"]."%' or ids='')";
	}else{
		$ad_sql = " and (ids='allmember' or ids='')";
	}

    $sql = " select * $sql_common and cz_type = '0' {$ad_sql} $sql_order ";
    $result = sql_query($sql);

    $coupon = '';
    $coupon_info_class = '';

    for($i=0; $row=sql_fetch_array($result); $i++) {
        if(!$row['cz_file'])
            continue;

        $img_file = G5_DATA_PATH.'/coupon/'.$row['cz_file'];
        if(!is_file($img_file))
            continue;

        $subj = get_text($row['cz_subject']);

        switch($row['cp_method']) {
            case '0':
                $row3 = get_shop_item($row['cp_target'], true);
				$cp_target = '개별상품할인';
                $cp_link ='<a href="'.shop_item_url($row3['it_id']).'" target="_blank">'.get_text($row3['it_name']).'</a>';
                $coupon_info_class = 'cp_2';
                break;
            case '1':
                $sql3 = " select ca_id, ca_name from {$g5['g5_shop_category_table']} where ca_id = '{$row['cp_target']}' ";
                $row3 = sql_fetch($sql3);
                $cp_target = '카테고리할인';
                $cp_link = '<a href="'.shop_category_url($row3['ca_id']).'" target="_blank">'.get_text($row3['ca_name']).'</a>';
                $coupon_info_class = 'cp_1';
                break;
            case '2':
                $cp_link = $cp_target = '주문금액할인';
                $coupon_info_class = 'cp_3';
                break;
            case '3':
                $cp_link = $cp_target = '배송비할인';
                $coupon_info_class = 'cp_4';
                break;
        }

        // 다운로드 쿠폰인지
        $disabled = '';
        if(is_coupon_downloaded($member['mb_id'], $row['cz_id']))
            $disabled = ' disabled';

        // $row['cp_type'] 값이 있으면 % 이며 없으면 원 입니다. 
        // 하씨; 대충 만들어놨네; 
        
        $print_cp_price = $row['cp_type'] ? '<b>'.$row['cp_price'].'</b> %' : '<b>'.number_format($row['cp_price']).'</b> 원';

        $coupon .= '<li>'.PHP_EOL;
		$coupon .= '<div class="cp_inner">'.PHP_EOL;
        $coupon .= '<div class="coupon_img"><img src="'.str_replace(G5_PATH, G5_URL, $img_file).'" alt="'.$subj.'">'.PHP_EOL;
        $coupon .= '<div class="coupon_tit"><span>'.$subj.'</span><br><span class="cp_evt">'.$print_cp_price.'</span></div>'.PHP_EOL;
		$coupon .= '</div>'.PHP_EOL;
		$coupon .= '<div class="cp_cnt">'.PHP_EOL;
        $coupon .= '<div class="coupon_target">'.PHP_EOL;
        $coupon .= '<span class="sound_only">적용</span><button class="coupon_info_btn '.$coupon_info_class.'">'.$cp_target.' <i class="fa fa-angle-right" aria-hidden="true"></i></button>'.PHP_EOL;
        $coupon .= '<div class="coupon_info">
        <h4>'.$cp_target.'</h4>
        <ul>
        	<li>적용 : '.$cp_link.'</li>';

        if( $row['cp_minimum'] ){   // 쿠폰에 최소주문금액이 있다면
        	$coupon .= '<li>최소주문금액 : <span class="cp_evt"><b>'.number_format($row['cp_minimum']).'</b>원</span></li>';
        }

        $coupon .= '</ul>
        <button class="coupon_info_cls"><i class="fa fa-times" aria-hidden="true"></i><span class="sound_only">닫기</span></button>
        </div>'.PHP_EOL;
        $coupon .= '</div>'.PHP_EOL;
        $coupon .= '<div class="coupon_date"><span class="sound_only">기한</span>다운로드 후 '.number_format($row['cz_period']).'일</div>'.PHP_EOL;
        //cp_1 카테고리할인
        //cp_2 개별상품할인
        //cp_3 주문금액할인
        //cp_4 배송비할인
		$coupon .= '</div>'.PHP_EOL;
		
		$coupon .= '<div class="coupon_btn"><button type="button" class="coupon_download btn02'.$disabled.'" data-cid="'.$row['cz_id'].'">쿠폰다운로드</button></div>'.PHP_EOL;
		
        $coupon .= '</div>'.PHP_EOL;
        
        $coupon .= '</li>'.PHP_EOL;
    }

    if($coupon)
        echo '<ul>'.PHP_EOL.$coupon.'</ul>'.PHP_EOL;
    else
        echo '<p class="no_coupon">다운로드 할 수 있는 쿠폰이 없습니다.</p>';
    ?>
</section>



<script>
$(function (){
	$(".coupon_info_btn").on("click", function() {
        $(this).parent("div").children(".coupon_info").show();
    });
    $(".coupon_info_cls").on("click", function() {
        $(".coupon_info").hide();
    });
    // 쿠폰 정보창 닫기
    $(document).mouseup(function (e){
        var container = $(".coupon_info");
        if( container.has(e.target).length === 0)
        container.hide();
    });
});
</script>