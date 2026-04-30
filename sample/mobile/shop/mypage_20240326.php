<?php
include_once('./_common.php');

// 테마에 mypage.php 있으면 include
if(defined('G5_THEME_SHOP_PATH')) {
    $theme_mypage_file = G5_THEME_MSHOP_PATH.'/mypage.php';
    if(is_file($theme_mypage_file)) {
        include_once($theme_mypage_file);
        return;
        unset($theme_mypage_file);
    }
}

$g5['title'] = '마이페이지';
include_once(G5_MSHOP_PATH.'/_head.php');

// 쿠폰
$cp_count = get_shop_member_coupon_count($member['mb_id'], true);
?>

<style>
body { background-color:#f5f5f5;}
#container { padding:0;}
</style>




<div id="smb_my">

    <section id="smb_my_ov">
        <h2>회원정보 개요</h2>

        <div class="my_name <?php if($member['mb_level']>2){ ?>bg_gray manager<?php } ?>" style="">
        	
            <?php //echo get_member_profile_img($member['mb_id']); ?>
			<p> 
            	<a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">      
            	<strong class="mint">				
					<?php echo $member['mb_id'] ? $member['mb_name'] : '비회원'; ?>
                </strong>
                
				<?php if($member['mb_level']>2){ ?>
                	<strong><span>매니저님</span></strong>
				<? } else { ?>
                	님
                <?php } ?>
                <i class="xi-cog"></i>
                </a>
                <!--<i class="fa fa-caret-down" aria-hidden="true"></i><span class="sound_only">내정보 보기</span>-->
                
                <!--<a href="<?php echo G5_BBS_URL; ?>/point.php" style=" float:right; font-weight:600; padding:6px 10px 6px 16px; background-color:#000; color:#fff; border-radius:50px; font-size:16px; line-height: 1;"><?php echo number_format($member['mb_point']); ?>P <i class="xi-angle-right-min" style="display:inline-block; margin-left:6px;"></i></a>-->
            </p>
            
			<a href="<?php echo G5_BBS_URL; ?>/point.php">
            <ul class="my_point">
                	<dl>
                    	<dt>보유포인트 
                        <dd>
                        	<span class="point_unit"><?php echo number_format($member['mb_point']); ?></span>
                            <i class="xi-angle-right-min"></i></dt>
                        </dd>
                    </dl>

                </ul>
            </a>

        </div>
        
        <!-- 매니저 이상(권한 3 이상) -->
		<?php if($member['mb_level']>2){ ?>

		<!-- 고객(권한 2) -->
    	<? } else { ?>


        <div class="my_name" style="">
                <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=service">
                <ul class="my_service">
                	<dl>
                    	<dt>이용서비스 <i class="xi-angle-right-min"></i></dt>
                        <dd>
                        	티구안 1234 
                            <span>프리미엄패키지</span>
                        </dd>
                        <dd>
                        	아반떼 5678 
                            <span>라이트패키지</span>
                        </dd>
                    </dl>
                </ul>
                </a>
        </div>
        <?php } ?>
    	<!--권한별 메뉴 끝-->
    </section>


    
	<!--
    <section id="smb_my_od">
        <h2><a href="<?php echo G5_SHOP_URL; ?>/orderinquiry.php">최근 주문내역</a></h2>
        <?php
        // 최근 주문내역
        define("_ORDERINQUIRY_", true);

        $limit = " limit 0, 5 ";
        include G5_MSHOP_PATH.'/orderinquiry.sub.php';
        ?>
        <a href="<?php echo G5_SHOP_URL; ?>/orderinquiry.php" class="btn_more">더보기</a>
    </section>

    <section id="smb_my_wish" class="wishlist">
        <h2><a href="<?php echo G5_SHOP_URL; ?>/wishlist.php">최근 위시리스트</a></h2>

        <ul>
            <?php
            $sql = " select *
                       from {$g5['g5_shop_wish_table']} a,
                            {$g5['g5_shop_item_table']} b
                      where a.mb_id = '{$member['mb_id']}'
                        and a.it_id  = b.it_id
                      order by a.wi_id desc
                      limit 0, 6 ";
            $result = sql_query($sql);
            for ($i=0; $row = sql_fetch_array($result); $i++)
            {
                $image_w = 250;
                $image_h = 250;
                $image = get_it_image($row['it_id'], $image_w, $image_h, true);
                $list_left_pad = $image_w + 10;
            ?>

            <li>
                <div class="wish_img"><?php echo $image; ?></div>
                <div class="wish_info">
                    <a href="<?php echo get_shop_item($row['it_id'], true); ?>" class="info_link"><?php echo stripslashes($row['it_name']); ?></a>
                     <span class="info_date"><?php echo substr($row['wi_time'], 2, 8); ?></span>
                </div>
            </li>

            <?php
            }

            if ($i == 0)
                echo '<li class="empty_list">보관 내역이 없습니다.</li>';
            ?>
        </ul>
         <a href="<?php echo G5_SHOP_URL; ?>/wishlist.php" class="btn_more">더보기</a>
    </section>
    -->
    
    <!-- 매니저 이상(권한 3 이상) -->
	<?php if($member['mb_level']>2){ ?>
    
    <ul class="my_menu manager">

        <li class="my_menu_item">
       	    <a href="<?php echo G5_URL; ?>/my/car_list.php">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_01_w.png"></p>
            <p class="my_menu_text">담당차량</p>
            </a>
        </li>

        <li class="my_menu_item">
       	 	<a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=history">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_04_w.png"></p>
            <p class="my_menu_text">세차내역</p>
            </a>
        </li>
                
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/work_list.php">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_09_w.png"></p>
            <p class="my_menu_text">업무기록</p>
            </a>
        </li>

        <li class="my_menu_item">
        	<!--<a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">-->
            <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=store">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_15_w.png"></p>
            <p class="my_menu_text">아파트 도면</p>
            </a>
        </li>

    </ul>
    
    <!-- 고객(권한 2) -->
    <? } else { ?>

    <ul class="my_menu">

        <li class="my_menu_item">
       	    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=service">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_01.png"></p>
            <p class="my_menu_text">세차정보</p>
            </a>
        </li>

        <li class="my_menu_item">
       	 	<a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=history">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_04.png"></p>
            <p class="my_menu_text">세차내역</p>
            </a>
        </li>
                
        <li class="my_menu_item">
       	  	<!--<a href="<?php echo G5_URL; ?>/my/pay_list.php">-->
            <a href="<?php echo G5_SHOP_URL; ?>/orderinquiry.php">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_12.png"></p>
            <p class="my_menu_text">결제내역</p>
            </a>
        </li>

        <li class="my_menu_item">
        	<!--<a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">-->
            <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=store">
   	    	<p class="my_menu_icon"><img src="<?php echo G5_IMG_URL ?>/mobile/my/my_menu_08.png"></p>
            <p class="my_menu_text">방문예약</p>
            </a>
        </li>

    </ul>
    
    <?php } ?>
    <!--권한별 메뉴 끝-->
</div>

<div class="my_wrap">



<div class="con_section con_section_b_bot_02">
    <div class="my_menu_02">
    	
        
        <ul>
        	<h4>고객센터</h4>
            
            <a href="<?php echo G5_BBS_URL; ?>/faq.php?fm_id=1">
            <li>자주 묻는 질문</li>
            </a>
            
            <a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=notice">
            <li>공지사항</li>
            </a>
            
            <a href="<?php echo G5_URL; ?>/bbs/qalist.php">
            <li>고객문의</li>
            </a>
            
            
            <a href="<?php echo G5_URL; ?>/sub/set.php">
            <li>앱 설정</li>
            </a>
            
        </ul>
        
        <ul>
        	<h4>정책</h4>
            
            <a href="<?php echo G5_URL; ?>/sub/provision.php">
            <li>이용약관</li>
            </a>
            
            
            <a href="<?php echo G5_URL; ?>/sub/privacy.php">
            <li>개인정보방침</li>
            </a>
        </ul>
    </div>
</div>

<div class="" style=" width:100%; float:left; padding:15px; margin-top:15px;">
	<a href="<?php echo G5_URL; ?>/<?php echo G5_URL; ?>/bbs/logout.php">
    <div class="my_logout">로그아웃</div>
    </a>
</div>

</div>



    

<script>
function member_leave()
{
    return confirm('정말 회원에서 탈퇴 하시겠습니까?')
}
</script>

<?php
include_once(G5_MSHOP_PATH.'/_tail.php');