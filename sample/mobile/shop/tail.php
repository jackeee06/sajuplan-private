<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    include_once(G5_THEME_SHOP_PATH.'/shop.tail.php');
    return;
}

?>
    </div>
</div>

<?php if (defined('_SHOP_')) { ?>
            
     
<?php } else { ?>
             
            
<?php }?>


<style>
.tail {width:100%; position:fixed; bottom:0; left:0; height:60px; background-color:#fff; text-align:center; color:#000; font-size:10px; z-index:9; box-shadow:-0px -5px 15px rgba(0,0,0,.1); border-radius:20px 20px 0 0; }

.tail ul {width:20%; float:left; padding-top:10px; color:#000; border-radius:20px 20px 0 0;}
.tail ul img {width:36px;}
.tail ul p {padding-top:3px;}
</style>


<?php //echo poll('theme/basic'); // 설문조사 ?>
<?php //echo visit('theme/basic'); // 방문자수 ?>


<div class="tail_wrap">
<div style="width:100%; height:60px; float:left; background-color:transparent !important;">
</div>
<div class="tail" style="">
	
	


    <a href="<?php echo G5_URL; ?>/sub/wash_info.php">
    <ul>
   		<img src="../../../img/mobile/tail/icon_shop.png"/>
        <p>안내</p>
    </ul>
    </a>

    
    <a href="<?php echo G5_URL; ?>/bbs/write.php?bo_table=service">
    <ul>
   		<img src="../../../img/mobile/tail/icon_reserve.png"/>
        <p>정기세차</p>
    </ul>
    </a>
    

    <a href="<?php echo G5_URL; ?>/index.php?device=mobile">
    <ul>
   		<img src="../../../img/mobile/tail/icon_home.png"/>
        <p style="color:#2b3990;">홈</p>
    </ul>
    </a>
    
    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=history">
    <ul>
   		<img src="../../../img/mobile/tail/icon_history.png"/>
        <p>내역</p>
    </ul>
    </a>
    
    
    <!--<a href="<?php echo G5_URL; ?>/sub/history.php">
    <a href="<?php echo G5_URL; ?>/bbs/write.php?bo_table=store">
    <ul>
   		<img src="../../../img/mobile/tail/icon_history.png"/>
        <p>방문예약</p>
    </ul>
    </a>
    -->
    
    <!--
	<a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=pr">
    <ul>
   		<img src="../../../img/mobile/tail/icon_shop.png"/>
        <p>제휴업체</p>
    </ul>
    -->
    </a>
    
    
    <a href="<?php echo G5_SHOP_URL; ?>/mypage.php">
    <ul>
   		<img src="../../../img/mobile/tail/icon_my.png"/>
        <p>내 정보</p>
	</ul>
	</a>
    
</div>

</div>

<!--
<div id="ft">
    <div id="ft_copy">
        <div id="ft_company">
            <a href="<?php echo get_pretty_url('content', 'company'); ?>">회사소개</a>
            <a href="<?php echo get_pretty_url('content', 'privacy'); ?>">개인정보처리방침</a>
            <a href="<?php echo get_pretty_url('content', 'provision'); ?>">서비스이용약관</a>
        </div>
        Copyright &copy; <b>소유하신 도메인.</b> All rights reserved.<br>
    </div>
    <div class="ft_cnt">
    	<h2>사이트 정보</h2>
        <p class="ft_info">
        	회사명 : 회사명 / 대표 : 대표자명<br>
			주소  : OO도 OO시 OO구 OO동 123-45<br>
			사업자 등록번호  : 123-45-67890<br>
			전화 :  02-123-4567  팩스  : 02-123-4568<br>
			통신판매업신고번호 :  제 OO구 - 123호<br>
			개인정보관리책임자 :  정보책임자명<br>
		</p>

    </div>
    <button type="button" id="top_btn"><i class="fa fa-arrow-up" aria-hidden="true"></i><span class="sound_only">상단으로</span></button>
    <?php
    if(G5_DEVICE_BUTTON_DISPLAY && G5_IS_MOBILE) { ?>
    <a href="<?php echo get_device_change_url(); ?>" id="device_change">PC 버전으로 보기</a>
    <?php
    }

    if ($config['cf_analytics']) {
        echo $config['cf_analytics'];
    }
    ?>
</div>
-->
<script>
jQuery(function($) {

    $( document ).ready( function() {

        // 폰트 리사이즈 쿠키있으면 실행
        font_resize("container", get_cookie("ck_font_resize_rmv_class"), get_cookie("ck_font_resize_add_class"));
        
        //상단고정
        if( $(".top").length ){
            var jbOffset = $(".top").offset();
            $( window ).scroll( function() {
                if ( $( document ).scrollTop() > jbOffset.top ) {
                    $( '.top' ).addClass( 'fixed' );
                }
                else {
                    $( '.top' ).removeClass( 'fixed' );
                }
            });
        }

        //상단으로
        $("#top_btn").on("click", function() {
            $("html, body").animate({scrollTop:0}, '500');
            return false;
        });

    });
});
</script>

<?php
include_once(G5_THEME_PATH."/tail.sub.php");