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

        <div class="my_name">
        	
            <?php //echo get_member_profile_img($member['mb_id']); ?>
           
            	<strong>
				<?php echo $member['mb_id'] ? $member['mb_name'] : '비회원'; ?>
            	</strong>님
                <!--<i class="fa fa-caret-down" aria-hidden="true"></i><span class="sound_only">내정보 보기</span>-->
                <a href="../my/service_list.php">
                <ul class="my_service">
                	<dl style="">
                    	<dt style="">현재 이용서비스 <i class="xi-angle-right-min"></i></dt>
                        <dd style="">
                        	티구안 1234 
                            <span>프리미엄패키지</span>
                        </dd>
                        <dd style="">
                        	아반떼 5678 
                            <span>라이트패키지</span>
                        </dd>
                    </dl>
                    <!-- 현재 <span style=" font-weight:600; color:#3b56a6;">프리미엄패키지</span>를 이용중이십니다. -->
                </ul>
                </a>
            <!--<button type="button" class="btn_op_area"></button>-->
           	
            <ul class="smb_my_act">
                
                <!--
				<?php if ($is_admin == 'super') { ?><li><a href="<?php echo G5_ADMIN_URL; ?>/" class="btn_admin" style="color:#fff; font-size:14px;">관리자</a></li><?php } ?>
                -->
                

            </ul>
        </div>

  
        
        <div class="my_state" style="">
        	<a href="../my/service_list.php">
            <p class="my_state_line"></p>
            <ul style="">
            	<i class="xi-document" style=""></i>
                <p style="">예약정보</p>
            </ul>
            </a>
            
            <a href="../my/pay_list.php">
            <p class="my_state_line"></p>
            <ul>
            	<i class="xi-credit-card" style=""></i>
                <p style="">결제내역</p>
            </ul>
            </a>
            
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">
            <ul>
            	<i class="xi-user-o" ></i>
                <p>내 정보</p>
            </ul>
            </a>
        </div>
       
        <!--
        <div class="my_ov_btn"><button type="button" class="btn_op_area"><i class="fa fa-caret-down" aria-hidden="true"></i><span class="sound_only">내정보 보기</span></button></div>-->

    </section>

    
    <div class="my_menu" style="">
    	
        <ul style="">
        	<h4 style="">서비스 관리</h4>
            
            <a href="../bbs/board.php?bo_table=history">
            <li style="">서비스내역</li>
            </a>

        </ul>
        
        <ul>
        	<h4>고객센터</h4>
            
            <a href="<?php echo G5_BBS_URL; ?>/faq.php?fm_id=1">
            <li>자주 묻는 질문</li>
            </a>
            
            <a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=notice">
            <li>공지사항</li>
            </a>
            
            <a href="<?php echo G5_URL; ?>/sub/contact.php">
            <li>고객문의</li>
            </a>
            
            
            <a href="../sub/about.php">
            <li>이용안내</li>
            </a>
            
            <a href="../sub/app_info.php">
            <li>앱 정보</li>
            </a>
            
        </ul>
        
        <ul>
        	<h4>정책</h4>
            
            <a href="../sub/provision.php">
            <li>이용약관</li>
            </a>
            
            
            <a href="../sub/privacy.php">
            <li>개인정보방침</li>
            </a>
        </ul>
        
        <ul>
        	<h4>알림</h4>
            
            <li class="w_100">
            	알림 수신동의
                
                <label class="switch">
  					<input type="checkbox" checked="checked" name="push_all" id="push_all" value="Y" onclick="set_push_mb('push_all')">
  					<span class="slider round" id="push_all_c"></span>
				</label>            
            </li>
        </ul>
    </div>
    
    <div class="my_menu" style="">
        <ul>
        	<h4>계정관리</h4>
            
            <a href="<?php echo G5_BBS_URL ?>/logout.php">
            <li>로그아웃</li>
            </a>
            
            
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=member_leave.php" onclick="return member_leave();">
            <li>탈퇴</li>
            </a>
        </ul>
        
        
    </div>
    
    
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
    

</div>

<script>
function member_leave()
{
    return confirm('정말 회원에서 탈퇴 하시겠습니까?')
}
</script>

<?php
include_once(G5_MSHOP_PATH.'/_tail.php');