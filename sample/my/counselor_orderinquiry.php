<?php
include_once("./_common.php"); // 메뉴별 공통파일
$g5['title'] = '서비스상품';
include_once(G5_THEME_MOBILE_PATH.'/head.php');

#####################################################################3


if(!$member["mb_id"]){
	alert('로그인하셔야합니다.');
	exit;
}

if($member["mb_level"] <'5'){
	alert('상담사만 접근할수있는 페이지입니다.', '/');
	exit;
}

$ca_id = get_cate_id($member["mb_id"]);


/// 해당 카테고리 상품 가져오기
$it_ids = array();
$sql = "select it_id from g5_shop_item where ca_id='".$ca_id."' or ca_id2='".$ca_id."' or ca_id3='".$ca_id."'";
$result = sql_query($sql);
if($result){
	while($row=sql_fetch_array($result)){
		$it_ids[] = $row["it_id"];
	}
	sql_free_result($result);
}


//print_r($it_ids);

$od_ids= array();

//// 실제 쿼리
$sql1 = "select od_id from g5_shop_cart where it_id in (".implode(",",$it_ids).") and ct_select='1' group by od_id order by ct_time desc "; // 장바구니에서 구매완료한 상품 주문번호를 가져온다.
$result1 = sql_query($sql1);
if($result1){
	while($crow = sql_fetch_array($result1)){
		$od_ids[] = $crow["od_id"];
	}
}


//print_r($od_ids);




if(count($od_ids)>0){


$sql = "select * from g5_shop_order where od_id in (".implode(",",$od_ids).")";
$result = sql_query($sql);



// 테이블의 전체 레코드수만 얻음
$sql = " select count(*) as cnt from g5_shop_order where od_id in (".implode(",",$od_ids).")";
$row = sql_fetch($sql);
$total_count = $row['cnt'];



$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) { $page = 1; } // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$limit = " limit $from_record, $rows ";

}

?>


<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<link rel="stylesheet" href="../theme/basic/css/mobile_shop.css">

<link rel="stylesheet" href="../theme/basic/mobile/skin/shop/basic/style.css">


<style>
.top_nav .top_nav02 { border-color: #465bf0; color: #465bf0; font-weight: 600;}
</style>

<?php include_once(G5_PATH.'/include/counselor_goods_navi.php'); ?>

<div class="con_section_03">
    	
		<?
		for ($i=0; $row=sql_fetch_array($result); $i++)
        {
            // 주문상품
            $sql = " select it_name, ct_option
                        from {$g5['g5_shop_cart_table']}
                        where od_id = '{$row['od_id']}'
                        order by io_type, ct_id
                        limit 1 ";
            $ct = sql_fetch($sql);
            $ct_name = get_text($ct['it_name']).' '.get_text($ct['ct_option']);

            $sql = " select count(*) as cnt
                        from {$g5['g5_shop_cart_table']}
                        where od_id = '{$row['od_id']}' ";
            $ct2 = sql_fetch($sql);
            if($ct2['cnt'] > 1)
                $ct_name .= ' 외 '.($ct2['cnt'] - 1).'건';

            switch($row['od_status']) {
                case '주문':
                    $od_status = '<span class="status_01">입금확인중</span>';
                    break;
                case '입금':
                    $od_status = '<span class="status_02">입금완료</span>';
                    break;
                case '준비':
                    $od_status = '<span class="status_03">상품준비중</span>';
                    break;
                case '배송':
                    $od_status = '<span class="status_04">상품배송</span>';
                    break;
                case '완료':
                    $od_status = '<span class="status_05">배송완료</span>';
                    break;
                default:
                    $od_status = '<span class="status_06">주문취소</span>';
                    break;
            }

            $od_invoice = '';
            if($row['od_delivery_company'] && $row['od_invoice'])
                $od_invoice = '<span class="inv_inv"><i class="fa fa-truck" aria-hidden="true"></i> <strong>'.get_text($row['od_delivery_company']).'</strong> '.get_text($row['od_invoice']).'</span>';

            $uid = md5($row['od_id'].$row['od_time'].$row['od_ip']);

			
			$status_color = "point";
			if($row["od_status"]=="취소"){
				$status_color = "black";
			}

        ?>

		
		<div class="c_history_wrap">	
			<!-- 후기 내용 -->
    	    <ul class="c_history_con">
                
                <div class="c_history_title">
					
					<span class="<?=$status_color?>"><?=$row["od_status"]?></span>

                    <span class="c_history_state"></span> 
                </div>        	
	            
                <div class="c_history_info">
                    <dl>
                    	<dt>고객명</dt>
                        <dd><?=$row["od_name"]?></dd>
                    </dl>
                    
                    <dl>
                    	<dt>구매일자</dt>
                        <dd><?=$row["od_time"]?></dd>
                    </dl>

                    <dl>
                    	<dt>구매상품</dt>
                        <dd><?=$ct_name?></dd>
                    </dl>
                    
                    <dl>
                    	<dt>구매금액</dt>
                        <dd><?echo number_format($row['od_cart_price'] + $row['od_send_cost'] + $row['od_send_cost2']);?>원</dd>
                    </dl> 
                </div>          
    	    </ul>
            
		</div>
         
      <?php
        }

        if ($i == 0)
            echo '<div class="empty_list">주문 내역이 없습니다.</div>';
        ?>

  
       
    	

 <?php echo get_paging($config['cf_mobile_pages'], $page, $total_page, "{$_SERVER['SCRIPT_NAME']}?$qstr&amp;page="); ?>


</div>

<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>