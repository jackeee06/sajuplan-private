<?php
include_once('./_common.php');

// 테마에 wishlist.php 있으면 include
if(defined('G5_THEME_MSHOP_PATH')) {
    $theme_wishlist_file = G5_THEME_MSHOP_PATH.'/wishlist.php';
    if(is_file($theme_wishlist_file)) {
        include_once($theme_wishlist_file);
        return;
        unset($theme_wishlist_file);
    }
}

$g5['title'] = "사주문 추천 상담사";
include_once(G5_MSHOP_PATH.'/_head.php');
?>

<?php include_once(G5_PATH.'/include/scrap_navi.php'); ?>

<div class="list_filter_wrap">
	<div class="list_title">위시리스트</div>
</div>    


<style>

.top_nav_02 {
    border-color: #465bf0 !important;
    color: #465bf0;
    font-weight: 600;
}

#wish_li { padding:10px 20px 20px;}

#sod_ws li { border-radius:10px; box-shadow: 0 0 15px rgba(0, 0, 0, .2); margin-bottom:20px;}
#sod_ws .wish_img {position:relative;
    top:auto;
    left:auto;
    z-index: 10;
    width: 100%;
    height:auto;
    margin-top:0;
    overflow: hidden;
    z-index: 4;}

#sod_ws .wish_chk {    position: absolute;
    top: 50px;
	transform:translateY(-50%);
    left: 20px;
    z-index: 9;}
#sod_ws .wish_img .chk_box input[type="checkbox"] + label span {    position: absolute;
    top: 2px;
    left: 0;
    width: 15px;
    height: 15px;
    display: block;
    margin: 0;
    background: #fff;
    border: 1px solid #d0d4df;
    border-radius: 3px;}

.chk_box input[type="checkbox"] + label {position: absolute;
    top: 0;
    left: 0;
}

#sod_ws .wish_img img { width:100%; height:auto; border-radius: 10px 10px 0 0;}	

#sod_ws .wish_info { padding:20px 70px 20px 50px; min-height:0; position:relative;}

#sod_ws .wish_prd {    font-size: 18px;
    padding: 0px 0 10px;
    font-weight: 600;}
	
#sod_ws .info_price {    margin: 0px 0 0px;
    font-size: 18px;
    font-weight: 700;
	line-height:normal;}
#sod_ws .info_price .sold_out { font-size:14px; font-weight:600; padding:2px 5px;}

#sod_ws .wish_del { top:50%; transform:translateY(-50%); right:20px; width:40px; height:40px; background-color:#e9e9e9; border-radius:50%; text-align:center; font-size:16px;}	
#sod_ws .wish_del a {width:40px; height:40px; line-height:40px; text-align:center;}

</style>

<div id="sod_ws">

    <form name="fwishlist" method="post" action="./cartupdate.php">
    <input type="hidden" name="act"       value="multi">
    <input type="hidden" name="sw_direct" value="">
    <input type="hidden" name="prog"      value="wish">
    <ul id="wish_li">
    <?php
        $sql = " select a.wi_id, a.wi_time, b.*
                   from {$g5['g5_shop_wish_table']} a left join {$g5['g5_shop_item_table']} b on ( a.it_id = b.it_id )
                  where a.mb_id = '{$member['mb_id']}'
                  order by a.wi_id desc ";
        $result = sql_query($sql);
        for ($i=0; $row = sql_fetch_array($result); $i++) {

            $out_cd = '';
            $sql = " select count(*) as cnt from {$g5['g5_shop_item_option_table']} where it_id = '{$row['it_id']}' and io_type = '0' ";
            $tmp = sql_fetch($sql);
            if(isset($tmp['cnt']) && $tmp['cnt'])
                $out_cd = 'no';

            $it_price = get_price($row);

            if ($row['it_tel_inq']) $out_cd = 'tel_inq';

            $image = get_it_image($row['it_id'], 650, 300);
    ?>

        <li>
            <div class="wish_img">
            	
            	<a href="<?php echo shop_item_url($row['it_id']); ?>"><?php echo $image; ?></a>
            </div>
            <div class="wish_info">
            	<div class="wish_chk">
                    <?php if(is_soldout($row['it_id'])) { // 품절검사?>
                    <!--<span class="sold_out">품절</span>-->
                    <?php } else { //품절이 아니면 체크할수 있도록한다 ?>
					<div class="chk_box">
                    	<input type="checkbox" name="chk_it_id[<?php echo $i; ?>]" value="1" id="chk_it_id_<?php echo $i; ?>" onclick="out_cd_check(this, '<?php echo $out_cd; ?>');" class="selec_chk">
                    	<label for="chk_it_id_<?php echo $i; ?>"><span></span><b class="sound_only"><?php echo $row['it_name']; ?></b></label>
                    </div>
                    <?php } ?>
                    <input type="hidden" name="it_id[<?php echo $i; ?>]" value="<?php echo $row['it_id']; ?>">
                    <input type="hidden" name="io_type[<?php echo $row['it_id']; ?>][0]" value="0">
                    <input type="hidden" name="io_id[<?php echo $row['it_id']; ?>][0]" value="">
                    <input type="hidden" name="io_value[<?php echo $row['it_id']; ?>][0]" value="<?php echo $row['it_name']; ?>">
                    <input type="hidden" name="ct_qty[<?php echo $row['it_id']; ?>][0]" value="1">
                </div>
                
                <a href="<?php echo shop_item_url($row['it_id']); ?>">
					<ul class="wish_prd"><?php echo stripslashes($row['it_name']); ?></ul>
                
                	<span class="info_price">
						<?php if(is_soldout($row['it_id'])) { // 품절검사?>
		                    <span class="sold_out">품절</span>
        	            <?php } else { //품절이 아니면 체크할수 있도록한다 ?>

	                    <?php } ?>
						<?php echo display_price(get_price($row), $row['it_tel_inq'])."\n"; ?>
                    </span>
                <!--<span class="info_date"><?php echo substr($row['wi_time'], 2, 17); ?></span>-->
            	</a>
                
                <span class="wish_del"><a href="<?php echo G5_SHOP_URL; ?>/wishupdate.php?w=d&amp;wi_id=<?php echo $row['wi_id']; ?>"><i class="fa fa-trash" aria-hidden="true"></i><span class="sound_only">삭제</span></a></span>
            </div>

        </li>
        <?php
        }
        if ($i == 0)
            echo '<li class="empty_table">위시리스트가 비었습니다.</li>';
        ?>
    </ul>

    <div id="sod_ws_act">
        <button type="submit" class="btn02" onclick="return fwishlist_check(document.fwishlist,'direct_buy');">바로구매</button>
        <button type="submit" class="btn01" onclick="return fwishlist_check(document.fwishlist,'');">장바구니</button>
    </div>
    </form>
</div>

<script>
<!--
    function out_cd_check(fld, out_cd)
    {
        if (out_cd == 'no'){
            alert("옵션이 있는 상품입니다.\n\n상품을 클릭하여 상품페이지에서 옵션을 선택한 후 주문하십시오.");
            fld.checked = false;
            return;
        }

        if (out_cd == 'tel_inq'){
            alert("이 상품은 전화로 문의해 주십시오.\n\n장바구니에 담아 구입하실 수 없습니다.");
            fld.checked = false;
            return;
        }
    }

    function fwishlist_check(f, act)
    {
        var k = 0;
        var length = f.elements.length;

        for(i=0; i<length; i++) {
            if (f.elements[i].checked) {
                k++;
            }
        }

        if(k == 0)
        {
            alert("상품을 하나 이상 체크 하십시오");
            return false;
        }

        if (act == "direct_buy")
        {
            f.sw_direct.value = 1;
        }
        else
        {
            f.sw_direct.value = 0;
        }

        return true;
    }
//-->
</script>

<?php
include_once(G5_MSHOP_PATH.'/_tail.php');