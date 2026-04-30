<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    define('G5_IS_COMMUNITY_PAGE', true);
    include_once(G5_THEME_SHOP_PATH.'/shop.head.php');
    return;
}

include_once(G5_THEME_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');
?>

<header id="hd">
    <h1 id="hd_h1"><?php echo $g5['title'] ?></h1>

    <div class="to_content"><a href="#container">본문 바로가기</a></div>

    <?php
    if(defined('_INDEX_')) { // index에서만 실행
        include G5_MOBILE_PATH.'/newwin.inc.php'; // 팝업레이어
    } ?>

    <div id="hd_wrapper">

        
		<h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();">
            	<img src="<?php echo G5_IMG_URL ?>/head/icon_back.png" style="width:24px;"/>
                <span class="sound_only">뒤로가기</span>
            </a> 

			
            <a href="<?php echo G5_URL ?>/sub/push_list.php">
				<div style="position: absolute; top: 10px; right: 55px; text-align:center; height: 40px; width: 40px; border: 0; color: #fff; font-size: 1.8em; background: none; letter-spacing: -0.1em;">
        			<img src="<?php echo G5_IMG_URL ?>/head/icon_push.png" style="padding-top:6px;">
        		</div>
        	</a>
            
            <!--
            <a href="<?php echo G5_URL; ?>/sub/wash_info_package.php">
            	<div style="position: absolute; top: 10px; right: 105px; text-align:center; height: 40px; width: 40px; border: 0; color: #fff; font-size: 1.8em; background: none; letter-spacing: -0.1em;">
        			<img src="<?php echo G5_IMG_URL ?>/head/icon_guide.png" style="padding-top:6px;">
        		</div>
            </a>
            -->
			
            <!----
            <?php if (defined('_SHOP_')) { ?>
            
            	<a href="<?php echo G5_URL ?>">
				<div style="position: absolute; top: 6px; right: 60px; padding: 0 10px; height: 40px; width: 40px; border: 0; color: #fff; font-size: 1.8em; background: none; letter-spacing: -0.1em;">
        			<img src="<?php echo G5_IMG_URL ?>/head/icon_home.png" style="padding-top:6px;">
        		</div>
        		</a>
            
            
             <?php } else { ?>
             
             <a href="<?php echo G5_SHOP_URL ?>/list.php?ca_id=40">
				<div style="position: absolute; top: 6px; right: 60px; padding: 0 10px; height: 40px; width: 40px;  border: 0; color: #fff; font-size: 1.8em; background: none; letter-spacing: -0.1em;">
        			<img src="<?php echo G5_IMG_URL ?>/head/icon_shop.png" style="padding-top:6px;">
        		</div>
        	</a>
            
              <?php }?>
        <!--
        <div style="z-index:2; width:30px; height:40px; text-align:center; position:absolute; top:10px; right:60px;">
        	<img src="<?php echo G5_IMG_URL ?>/head/icon_push.png" style="padding-top:6px;">
        </div>
        
        -->
         <span class="page_title"><?php echo get_head_title($g5['title']); ?></span>
		
	  <button type="button" id="gnb_open" class="hd_opener" style="z-index:2;">
      		<img src="<?php echo G5_IMG_URL ?>/head/icon_menu.png">
        	<span class="sound_only"> 메뉴열기</span>
      	</button>
		
        <!--  -->
        <?php include_once(G5_PATH.'/include/slide_left.php'); ?>
                    
    	</h2>

        

        <!-- 검색
        <button type="button" id="user_btn" class="hd_opener"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">사용자메뉴</span></button>-->
        <div class="hd_div" id="user_menu">
            <button type="button" id="user_close" class="hd_closer"><span class="sound_only">메뉴 닫기</span><i class="fa fa-times" aria-hidden="true"></i></button>
            <div id="hd_sch">
                <h2>사이트 내 전체검색</h2>
                <form name="fsearchbox" action="<?php echo G5_BBS_URL ?>/search.php" onsubmit="return fsearchbox_submit(this);" method="get">
                <input type="hidden" name="sfl" value="wr_subject||wr_content">
                <input type="hidden" name="sop" value="and">
                <input type="text" name="stx" id="sch_stx" placeholder="검색어를 입력해주세요" required maxlength="20">
                <button type="submit" value="검색" id="sch_submit"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">검색</span></button>
                </form>

                <script>
                function fsearchbox_submit(f)
                {
                    if (f.stx.value.length < 2) {
                        alert("검색어는 두글자 이상 입력하십시오.");
                        f.stx.select();
                        f.stx.focus();
                        return false;
                    }

                    // 검색에 많은 부하가 걸리는 경우 이 주석을 제거하세요.
                    var cnt = 0;
                    for (var i=0; i<f.stx.value.length; i++) {
                        if (f.stx.value.charAt(i) == ' ')
                            cnt++;
                    }

                    if (cnt > 1) {
                        alert("빠른 검색을 위하여 검색어에 공백은 한개만 입력할 수 있습니다.");
                        f.stx.select();
                        f.stx.focus();
                        return false;
                    }

                    return true;
                }
                </script>
            </div>
            <?php echo popular('theme/basic'); // 인기검색어 ?>
            <div id="text_size">
            <!-- font_resize('엘리먼트id', '제거할 class', '추가할 class'); -->
                <button id="size_down" onclick="font_resize('container', 'ts_up ts_up2', '', this);" class="select"><img src="<?php echo G5_URL; ?>/img/ts01.png" width="20" alt="기본"></button>
                <button id="size_def" onclick="font_resize('container', 'ts_up ts_up2', 'ts_up', this);"><img src="<?php echo G5_URL; ?>/img/ts02.png" width="20" alt="크게"></button>
                <button id="size_up" onclick="font_resize('container', 'ts_up ts_up2', 'ts_up2', this);"><img src="<?php echo G5_URL; ?>/img/ts03.png" width="20" alt="더크게"></button>
            </div>
        </div>


        
    </div>
</header>



<div id="wrapper">

    <div id="container">
    
    <?php if (!defined("_INDEX_")) { ?>
    	<!--
    	<h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();"><i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sound_only">뒤로가기</span></a> <?php echo get_head_title($g5['title']); ?>
    	</h2>
        -->
    <?php }
	