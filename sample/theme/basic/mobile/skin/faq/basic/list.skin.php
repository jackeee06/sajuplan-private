<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$faq_skin_url.'/style.css">', 0);
?>

<?php
if( count($faq_master_list) ){
?>

<!-- FAQ 시작 { -->

<div class="con_section con_section_b_bot_02">

<div class="list_title">자주 묻는 질문</div>

<div id="faq_sch">
    <form name="faq_search_form" method="get">
    <input type="hidden" name="fm_id" value="<?php echo $fm_id;?>">
    <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
    <input type="text" name="stx" value="<?php echo $stx;?>" required id="stx" class="frm_input" size="15" maxlength="15">
    <button type="submit" value="검색" class="btn_submit"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">검색</span></button>
    </form>
</div>

<nav id="bo_cate">
    <h2>자주하시는질문 분류</h2>
    <ul id="bo_cate_ul">
        <?php
        foreach( $faq_master_list as $v ){
            $category_msg = '';
            $category_option = '';
            if($v['fm_id'] == $fm_id){ // 현재 선택된 카테고리라면
                $category_option = ' id="bo_cate_on"';
                $category_msg = '<span class="sound_only">열린 분류 </span>';
            }
        ?>
        <li><a href="<?php echo $category_href;?>?fm_id=<?php echo $v['fm_id']?>" <?php echo $category_option;?> ><?php echo $category_msg.$v['fm_subject'];?></a></li>
        <?php
        }
        ?>
        <li><a href="../bbs/board.php?bo_table=notice">공지사항</a></li>
    </ul>
</nav>
<?php } ?>

<?php
// 상단 HTML
//echo '<div id="faq_hhtml" class="faq_head">'.conv_content($fm['fm_mobile_head_html'], 1).'</div>';
?>


<style>
#main_bn { width: 100%; float: left; margin-top:20px;}
</style>
    	


<?php echo display_banner('일반-이용안내', 'mainbanner.10.skin.php'); ?>



<div id="faq_wrap" class="faq_<?php echo $fm_id; ?>">
    <?php // FAQ 내용
    if( count($faq_list) ){
    ?>
    <section id="faq_con">
        <h2><?php echo $g5['title']; ?> 목록</h2>
        <ol>
            <?php
            foreach($faq_list as $key=>$v){
                if(empty($v))
                    continue;
            ?>
            <li>
                <h3>
                	<span class="tit_bg">Q</span><a href="#none" onclick="return faq_open(this);"><?php echo conv_content($v['fa_subject'], 1); ?></a>
                	<button class="tit_btn" onclick="return faq_open(this);"><i class="fa fa-plus" aria-hidden="true"></i><span class="sound_only">열기</span></button>
                </h3>
                <div class="con_inner">
                    <?php echo conv_content($v['fa_content'], 1); ?>
                    <button type="button" class="closer_btn"><i class="fa fa-minus" aria-hidden="true"></i><span class="sound_only">닫기</span></button>
                </div>
            </li>
            <?php
            }
            ?>
        </ol>
    </section>
    <?php

    } else {
        if($stx){
            echo '<p class="empty_list">검색된 게시물이 없습니다.</p>';
        } else {
            echo '<div class="empty_table">등록된 FAQ가 없습니다.';
            if($is_admin)
                echo '<br><a href="'.G5_ADMIN_URL.'/faqmasterlist.php">FAQ를 새로 등록하시려면 FAQ관리</a> 메뉴를 이용하십시오.';
            echo '</div>';
        }
    }
    ?>
</div>

<?php echo get_paging($page_rows, $page, $total_page, $_SERVER['SCRIPT_NAME'].'?'.$qstr.'&amp;page='); ?>



</div>
<!-- } FAQ 끝 -->




<!-- 고객센터 시작 { -->
<div class="con_section">


<div class="list_title">고객센터</div>

<div style=" font-size:16px;">
	
    <ul style="line-height:1.6; font-size:14px; margin:20px 0;">
    	<li>· 운영시간: 9시~18시 (주말 및 공휴일 휴무)</li>
        <li>· 점심시간: 12시~13시</li>
        <li>· 고객센터 운영시간에 순차적으로 답변드리겠습니다.</li>
    </ul>
    
    <a href="http://pf.kakao.com/_gLTVX" target="_blank">
    <ul class="point_bg white" style=" display: block; width: 100%; text-align: center; padding: 0 20px; line-height: 50px; border: 1px solid #eee; border-bottom: none; margin-bottom: 20px; border-radius:4px;">1:1 문의</ul>
    </a>
</div>


<!-- } 고객센터 끝 -->

</div>

	<?php
		// 하단 HTML
		echo '<div id="faq_thtml" class="faq_tail">'.conv_content($fm['fm_mobile_tail_html'], 1).'</div>';
	?>

<script src="<?php echo G5_JS_URL; ?>/viewimageresize.js"></script>
<script>
jQuery(function() {
    $(".closer_btn").on("click", function() {
        $(this).closest(".con_inner").slideToggle('slow', function() {
			var $h3 = $(this).closest("li").find("h3");

			$("#faq_con li h3").removeClass("faq_li_open");
			if($(this).is(":visible")) {
				$h3.addClass("faq_li_open");
			}
		});
    });
});

function faq_open(el)
{	
    var $con = $(el).closest("li").find(".con_inner"),
		$h3 = $(el).closest("li").find("h3");

    if($con.is(":visible")) {
        $con.slideUp();
		$h3.removeClass("faq_li_open");
    } else {
        $("#faq_con .con_inner:visible").css("display", "none");

        $con.slideDown(
            function() {
                // 이미지 리사이즈
                $con.viewimageresize2();
				$("#faq_con li h3").removeClass("faq_li_open");

				$h3.addClass("faq_li_open");
            }
        );
    }

    return false;
}
</script>