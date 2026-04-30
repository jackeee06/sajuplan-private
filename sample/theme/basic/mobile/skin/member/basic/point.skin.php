<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가


/////////////////////////// 구글 결제 함수때문에 삽입 ////////////
$mode = $_REQUEST["mode"];
$order_id = $_REQUEST["order_id"];
$price = $_REQUEST["price"];
$item_id = $_REQUEST["item_id"];
$item_name = $_REQUEST["item_name"];
////////////////////////// 구글 결제 함수 때문에 삽입 끝 /////////


// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);
?>

<!-- 구글 통계함수 호출 -->
<script>
var mode = "<?=$mode?>";
var item_name = "<?=$item_name?>";
var item_id = "<?=$item_id?>";
var price = "<?=$price?>";
var order_id = "<?=$order_id?>";
if(mode=="purchase"){
	g4_purchase(order_id, price, item_id, item_name);

}
</script>
<!-- 구글 통계함수 호출 끝 -->

<style>
.top_nav_02 { border-color: #465bf0 !important; color: #465bf0; font-weight: 600;}

.new_win .new_win_con2 { width: 100%; float: left;}

.level_info { margin-top:0;}
</style>

<?php include_once("../include/point_history_navi.php"); ?>

<div id="point" class="new_win">
	
    <div class="con_section con_section_b_bot_02">
    <ul class="level_info">
    	<p class="level_info_title">보유포인트</p>
    	<li class="my_levelup">
        	
        	<p>
				<span class="point"><?php echo number_format($member['mb_point']); ?></span>ⓟ
            </p>
            
            <a href="../coin/coin_fill.php" class="point_bg white btn">충전</a>
        </li>
    </ul>    	
    </div>
    
    
    <div class="new_win_con2">
        <!--
        <ul class="point_all">
        	<li class="full_li">
        		보유포인트
        		<span><?php echo number_format($member['mb_point']); ?></span>
        	</li>
		</ul>
        -->
        <ul class="point_list">
            <?php
            $sum_point1 = $sum_point2 = $sum_point3 = 0;
            
            $i = 0;
            foreach((array) $list as $row){

				

                $point1 = $point2 = 0;
                $point_use_class = '';
                if ($row['po_point'] > 0) {
                    $point1 = '+' .number_format($row['po_point']);
                    $sum_point1 += $row['po_point'];
                } else {
                    $point2 = number_format($row['po_point']);
                    $sum_point2 += $row['po_point'];
                    $point_use_class = 'point_use';
                }

                $po_content = $row['po_content'];

                $expr = '';
    //            if($row['po_expired'] == 1)
                    $expr = ' txt_expired';
            ?>
            <li class="<?php echo $point_use_class; ?>">
                <div class="point_top">
                    <span class="point_tit"><?php echo $po_content; ?></span>
                    <span class="point_num"><?php if ($point1) echo $point1; else echo $point2; ?></span>
                </div>
                
                <div class="point_date" style="">
                	<?php echo conv_date_format('y-m-d H:i', $row['po_datetime']); ?>
                    
					<?
					if($row["po_rel_action"]){
						$ss = explode("@",$row["po_rel_action"]);
						if($ss[0]){
							$no = $ss[0];
							$r = sql_fetch("select * from platform_consulting where no='".$no."'");
							$rtime = $r["usetm"];
						}
					}
					?>
					<?if($rtime){?>
					(총상담시간 : <?=gmdate('H:i:s', $rtime);?>)
					<?}?>
                </div>                
                

                <!-- 포인트 발생일
                <span class="point_date1"><i class="fa fa-clock-o" aria-hidden="true"></i> <?php echo conv_date_format('y-m-d H시', $row['po_datetime']); ?></span>
                
                <!-- 포인트 만료일
                <span class="point_date<?php echo $expr; ?>">
                    <?php if ($row['po_expired'] == 1) { ?>
                    만료 <?php echo substr(str_replace('-', '', $row['po_expire_date']), 2); ?>
                    <?php } else echo $row['po_expire_date'] == '9999-12-31' ? '&nbsp;' : $row['po_expire_date']; ?>
                </span>
                -->
            </li>
            <?php
                $i++;
            }   // end foreach

            if ($i == 0)
                echo '<li class="empty_list">자료가 없습니다.</li>';
            else {
                if ($sum_point1 > 0)
                    $sum_point1 = "+" . number_format($sum_point1);
                $sum_point2 = number_format($sum_point2);
            }
            ?>
			<!--
            <li class="point_status">
                소계
                <span><?php echo $sum_point1; ?></span>
                <span><?php echo $sum_point2; ?></span>
            </li>
            -->
        </ul>

        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, $_SERVER['SCRIPT_NAME'].'?'.$qstr.'&amp;page='); ?>

    </div>
</div>