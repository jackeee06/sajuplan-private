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


// 쿠폰
$cp_count = get_shop_member_coupon_count($member['mb_id'], true);
?>

<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
	<?php include_once(G5_THEME_PATH.'/mobile/head_point.php'); ?> 
<? } else { ?>
	<?php include_once(G5_THEME_PATH.'/mobile/head.php'); ?> 
<?php } ?>

<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_my.css" type="text/css">


<style>
body { background-color:#f5f5f5;}
#container { padding:0;}

.sticky {position: sticky; top: 70px;}
.con_section.my_state { border-top:1px solid rgba(255,255,255,.2);}

.my_c_state_wrap {width: 100%; float: left;}
.my_c_state_wrap .my_c_state_title { font-size: 14px; margin-bottom: 4px; font-weight: 300; text-align: left; color:#fff;}
.my_c_state_wrap .my_c_state {display:flex; justify-content: space-between; margin-bottom:10px; padding:0;}
.my_c_state_wrap .my_c_state .c_state { width:calc(50% - 5px); height:45px; border-radius:3px; text-align:center; font-size:16px; font-weight:600;}
.my_c_state_wrap .my_c_state .c_state i { font-size:20px; vertical-align:-3px;}
.my_c_state_wrap .my_c_state .c_state.go { background-color:#000; color:#fff;}
.my_c_state_wrap .my_c_state .c_state.stop { background-color:#d9d9d9; color:#999;}
.my_c_state_wrap .my_c_state .c_state.on { background-color:#fff; color:#000;}
.my_c_state_wrap .my_c_state .c_state.on i { color:#000;}
.my_c_state_wrap .my_c_state .c_state.off {background-color:#d3d3d3; color:#999;}
.my_c_state_wrap .my_c_state .c_state.off i { color:#999;}

.my_c_state_wrap .my_c_state_noti { font-size:14px; color:#fff; text-align:left; padding:0px;}
.my_c_state_wrap .my_c_state_noti .my_c_state_noti_item { line-height:1.4; position:relative; padding-left:10px;}
.my_c_state_wrap .my_c_state_noti .my_c_state_noti_item:before { content:''; position:absolute; top:8px; left:0; width:2px; height:2px; border-radius:50%; display:inline-block; background-color:#fff;}
</style>


<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
<style>
.con_section.c_profile { background-color:#e84263; color:#fff;}
.my_profile .my_info .my_name,
.my_profile .my_info .my_name i,
.my_profile .my_info .my_name .my_id,
.my_profile .my_info .my_edit {color:#fff;}

.my_profile .my_info .my_name i { opacity:.5;}
</style>
<?php } ?>


<div class="my_wrap ">


<div class="con_section c_profile">
	<?php if($is_member){ ?>
            
	<ul class="my_profile">
    	<li class="my_img"><img src="../img/common/logo3.png"/></li>
        <li class="my_info">
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">
            <ul class="my_name">
              	<?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?> <i class="xi-angle-right-min"></i>
                <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '비회원'; ?></p>
            </ul>
    		</a>
    		
            <a href="../etc/set.php">
            <span class="my_edit">
            	<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?><img src="../img/head/edit_w.png"><? } else { ?><img src="../img/head/edit.png"><?php } ?>
                앱설정
            </span>
            </a>
        </li>
    </ul>
    
                	 
	<? } else { ?>
    
	<ul class="my_profile">
    	<a href="<?php echo G5_BBS_URL; ?>/login.php">
    	<li class="my_img"><img src="../img/common/logo3.png"/></li>
        </a>
        <li class="my_info">
        	<a href="<?php echo G5_BBS_URL; ?>/login.php">
        	<ul class="my_name">
              	<?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>
                <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '로그인이 필요합니다.'; ?></p>
            </ul>
            </a>
            
            <!--
            <a href="../etc/set.php">
            <span class="my_edit">
            	<img src="../img/head/edit.png">
                앱설정
            </span>
            </a>
            -->
            <a href="<?php echo G5_BBS_URL; ?>/login.php">
            <span class="pink pink_bo" style=" display: inline-block; padding: 6px 20px; border-radius: 50px; margin-left: 10px; position: absolute; top: 50%; right: 0px; font-size: 14px; transform: translateY(-50%); width:auto; border:1px solid #000; color:#000;">로그인</span>
            </a>
            
        </li>
    </ul>
    
    <?php } ?>
</div>

<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
<div class="con_section c_profile my_state">

	<div class="my_c_state_wrap">
    	<!--<p class="my_c_state_title">상담 상태</p>-->
    	<ul class="my_c_state">
        	<button class="c_state go">상담가능</button>
        	<button class="c_state stop">부재중</button>
        </ul>
    	<ul class="my_c_state">
        	<button class="c_state on"><i class="xi-call"></i> 전화</button>
        	<button class="c_state on"><i class="xi-forum-o"></i> 채팅</button>
        </ul>
        <ul class="my_c_state_noti">
        	<li class="my_c_state_noti_item">상담이 들어오면 3분 이내에 응대해 주세요.</li>
        	<li class="my_c_state_noti_item">허위로 상담을 켜두시는 경우 서비스 이용이 제한됩니다.</li>
        </ul>
    </div> 
</div>
<?php } ?> 


<div class="con_section">
        
    <ul class="level_info">
    	<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
    	<p class="level_info_title">보유금액</p>
    	<!--<li class="my_levelup counselor">-->
        <li class="my_levelup">
        	<p>
				<span class="point">10,000,000</span>원
            </p>
            <a href="#" class="point_bg white btn">정산</a>
        </li>       
        
		<? } else { ?>
        <p class="level_info_title">보유코인</p>
    	<li class="my_levelup">        	
        	<p>
				<span class="point"><?php echo number_format($member['mb_point']); ?></span>코인
            </p>            
            <a href="../coin/coin_fill.php" class="point_bg white btn">충전</a>
        </li>
        <?php } ?>
                
                

    </ul>
    
    
    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
	<ul class="mem_state counselor">
    	<li class="mem_state_title">전월</li>
    	<li class="mem_state_con">000,000원</li>
    	<li class="mem_state_title">당월</li>
    	<li class="mem_state_con">0,000,000원</li>
    </ul> 
    <? } else { ?>
    <ul class="mem_state">
    	<li class="mem_state_title"><img src="../../img/common/icon_date.png" />오늘의 운세 </li>
    	<li class="mem_state_con">82年生 주의 사람과 상의하여 함께 도모해야 한다.</li>
    	<a href="../today/my_today.php"><li class="mem_state_more point">상세보기<i class="xi-angle-right"></i></li></a>
    </ul>       
    <?php } ?>
    
   	
</div>

<div class="con_section con_section_b_bot_02">
  	<h3 class="con_title">
    	<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
			상담사 전용
		<? } else { ?>
	        마이페이지
		<?php } ?>
    
    </h3>
    
    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
    
    <ul class="my_menu">
    
    	<li class="my_menu_item" style=" width:calc(100% - 20px); margin-left:10px; border-radius: 10px; border:1px solid #ddd; padding:10px; margin-top:10px;">
        <img src="../img/sample/my_chat_btn.png" style="width:100%;" />
		</li>

        
        
        <li class="my_menu_item">
        	<a href="../my/counselor_history.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">상담내역</p>
            </a>
        </li>

        <li class="my_menu_item">
        	<a href="../my/counselor_settlement.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">정산내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  	<a href="../my/counselor_review.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">후기관리</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  	<a href="../my/counselor_qa.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">1:1문의 관리</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../shop/list.php?ca_id=10">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">서비스상품</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="../bbs/board.php?bo_table=c_notice">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">공지사항</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../bbs/board.php?bo_table=c_tip">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">꿀팁</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../bbs/board.php?bo_table=c_benefits">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_05.png"/></p>
            <p class="my_menu_text">선생님 혜택</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="../bbs/qalist.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">문의하기</p>
            </a>
        </li>
        
    </ul>
    
    <? } else { ?>
    
    <ul class="my_menu">

        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/coupon.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">쿠폰함</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/bbs/point.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">코인내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/my/history.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">상담내역</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=review">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">나의 상담후기</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/my/qa_history.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">나의 상담문의</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/shop/orderinquiry.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_05.png"/></p>
            <p class="my_menu_text">상품구매내역</p>
            </a>
        </li>
        
    </ul>
    
    <?php } ?>

</div>

    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

    
    <? } else { ?>
<div class="con_section con_section_b_bot_02">
  	
    

    <h3 class="con_title">추가메뉴</h3>
    
    <ul class="my_menu">

        <li class="my_menu_item">
       	    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=event">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_01.png"/></p>
            <p class="my_menu_text">이벤트</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/today/wish.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_03.png"/></p>
            <p class="my_menu_text">소원다락방</p>
            </a>
        </li>
        
        
        <li class="my_menu_item">
       	    <a href="<?php echo G5_URL; ?>/shop/list.php?ca_id=10">
            <!--<a href="javascript:alert('준비중입니다.');" onfocus="this.blur()">-->
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_02.png"/></p>
            <p class="my_menu_text">부가서비스</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/bbs/faq.php">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_08.png"/></p>
            <p class="my_menu_text">이용안내</p>
            </a>
        </li>
        
        <li class="my_menu_item">
       	  <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=column">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_04.png"/></p>
            <p class="my_menu_text">사주문 칼럼</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=charm">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_07.png"/></p>
            <p class="my_menu_text">내맘대로 부적</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=way">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_05.png"/></p>
            <p class="my_menu_text">사주문의 길</p>
            </a>
        </li>
        
        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=new">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_08.png"/></p>
            <p class="my_menu_text">신규상담사</p>
            </a>
        </li>

        <li class="my_menu_item">
        	<a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=apply">
   	    	<p class="my_menu_icon"><img src="../img/my/my_menu_08.png"/></p>
            <p class="my_menu_text">상담사 신청</p>
            </a>
        </li>

    </ul>
    
	<!------ 공통내용 : 롤링배너  ------>
	<?php include_once("../etc/rolling_banner.php"); ?>  
  
</div>
<?php } ?>
    
<?php if($is_member){ ?>
<div class="con_section">
	<a href="<?php echo G5_URL; ?>/bbs/logout.php">
    <div class="my_logout">로그아웃</div>
    </a>
</div>
<?php } ?>

</div>





    

<script>
function member_leave()
{
    return confirm('정말 회원에서 탈퇴 하시겠습니까?')
}
</script>

<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
	<?php include_once(G5_PATH.'/tail.sub.php'); ?>
<? } else { ?>
	<?php include_once(G5_MSHOP_PATH.'/_tail.php'); ?>
<?php } ?>


