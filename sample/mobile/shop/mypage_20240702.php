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
include_once(G5_THEME_PATH.'/mobile/head.php');

// 쿠폰
$cp_count = get_shop_member_coupon_count($member['mb_id'], true);
?>


<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_my.css" type="text/css">


<style>
body { background-color:#f5f5f5;}
#container { padding:0;}
</style>



<div class="my_wrap">


<div class="con_section con_section_b_bot_02">
	<?php if($is_member){ ?>
            
	<ul class="my_profile">
    	<li class="my_img"><img src="../img/common/level_1.png"/></li>
        <li class="my_info">
        	<a href="<?php echo G5_BBS_URL; ?>/login.php">
            <ul class="my_name">
              	<?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>
                <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '비회원'; ?></p>
            </ul>
    		</a>
    		
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">
            <span class="my_edit"><img src="../img/head/edit.png"></span>
            </a>
        </li>
    </ul>
    
    <ul class="level_info">
    	<li class="my_levelup">
        	다음 SILVER등급까지 충전금액<br />
        	<span><strong>40,000</strong>원</span> 남음
            
            <p>
            	내 알약
	        	<img src="../img/left/quick_02.png">
    	        <span>360</span>
	        </p>
        </li>
        
        <a href="<?php echo G5_URL; ?>/my/../my/grade.php">
        <li class="levle_banner">사주플랜 등급보기</li>
        </a>
    </ul>
    
                	 
	<? } else { ?>
    
	<ul class="my_profile">
    	<a href="<?php echo G5_BBS_URL; ?>/login.php">
    	<li class="my_img"><img src="../img/common/level_1.png"/></li>
        </a>
        <li class="my_info">
        	<a href="<?php echo G5_BBS_URL; ?>/login.php">
        	<ul class="my_name">
              	<?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>
                <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '로그인이 필요합니다.'; ?></p>
            </ul>
            </a>
            
            <a href="<?php echo G5_BBS_URL; ?>/register.php">
            <span class="my_edit point_bg white" style=" display: inline-block; padding: 6px 20px; border-radius: 50px; margin-left: 10px; position: absolute; top: 50%; right: 0px; font-size: 16px; transform: translateY(-50%);">회원가입</span>
            </a>
        </li>
    </ul>
    
    
    <ul class="level_info">
    	<li class="my_levelup">
        	다음 SILVER등급까지 충전금액<br />
        	<span><strong>40,000</strong>원</span> 남음
            
            <p>
            	내 알약
	        	<img src="../img/left/quick_02.png">
    	        <span>360</span>
	        </p>
        </li>
        
        <a href="<?php echo G5_URL; ?>/my/../my/grade.php">
        <li class="levle_banner">사주플랜 등급보기</li>
        </a>
    </ul>
    
	<?php } ?>
</div>


<div class="con_section con_section_b_bot_02">
  <h3 class="con_title">자주찾는 메뉴</h3>
    <ul class="my_menu">

        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/history.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">상담내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/review.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">상담후기</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/my/coin.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">알약 이용내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/store.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">스토어</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/my/wish.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_05.png"/></p>
            <p class="my_menu_text">나의 소원함</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/my/coupon.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_06.png"/></p>
            <p class="my_menu_text">쿠폰/이벤트</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/my/charm.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_07.png"/></p>
            <p class="my_menu_text">사주플랜 부적</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/etc/qa_list.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_08.png"/></p>
            <p class="my_menu_text">문의 게시판</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/etc/set.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_11.png"/></p>
            <p class="my_menu_text">앱 설정</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        </li>
   		
    </ul>

<!------ 공통내용 : 롤링배너  ------>
<?php include_once("../etc/rolling_banner.php"); ?>    
</div>

<div class="con_section">
	<a href="<?php echo G5_URL; ?>/bbs/logout.php">
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