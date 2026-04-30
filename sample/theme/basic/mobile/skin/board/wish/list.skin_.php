<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
?>

<script src="<?php echo G5_JS_URL; ?>/jquery.fancylist.js"></script>

<form name="fboardlist"  id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
<input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="spt" value="<?php echo $spt ?>">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="sw" value="">


<style>
#main_bn { width:100%; float:left; }
#main_bn img { border-radius:20px;}

</style>

<!--
<?php if ($write_href) { ?>
	<div class="fix_btn write_btn">
    	<a href="<?php echo $write_href ?>" title="상담사 등록"><?php echo $board['bo_subject']; ?> 등록</a>
    </div>
<?php } ?>
-->



<div style=" width:100%; float:left; padding:20px 0; text-align:center; font-size:16px; background-color:#f5f5f5;">
	<i class="xi-warning" style="font-size:24px;"></i>
    <br />
    현재 개발중인 서비스입니다.
</div>


<?php if ($write_href) { ?>
<a href="<?php echo $write_href ?>">
<? } else { 
	alert('로그인후 이용해주십시요.', G5_BBS_URL.'/login.php?url='.$urlencode);
?>
<?php } ?>
<div style="width:100%; float:left; padding:20px 20px 0;">
	<?php echo display_banner('소원다락방-상단', 'mainbanner.10.skin.php'); ?>
</div>
</a>


<style>

</style>



<!-- 게시판 목록 시작 -->
<div id="bo_gall">

    <?php if ($is_category) { ?>
    <nav id="bo_cate">
        <h2><?php echo ($board['bo_mobile_subject'] ? $board['bo_mobile_subject'] : $board['bo_subject']) ?> 카테고리</h2>
        <ul id="bo_cate_ul">
            <?php echo $category_option ?>
        </ul>
    </nav>
    <?php } ?>


<ul id="gall_ul">
    	<h3 style="font-size:18px; margin-bottom:10px; font-weight:800; padding:20px 20px 0; ">내 소원</h3>
                <li class="gall_li ">
            <div class="gall_li_wr">

                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=3" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_ebyR0IfD_6cdf94da9991da5873c20ba601291a75dc6fadb3.JPG);"></div>
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
                        	<a href="../bbs/board.php?bo_table=wish&amp;wr_id=3">
							<span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">3</span>/100일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#000; font-weight:600;">기도중</span>
                        </p>
                        

                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=3">
                            특별히 좋은 일이나 새로운 사건이 없어도 지금처럼 무난하게 흘러가게 해주세요. 
                            </a>                           
                            <button type="button" class="point_bg white" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                    </ul>                 

                </div>
            </div>
        </li>
            <li class="gall_li ">
            <div class="gall_li_wr">
                
                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=2" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_FlXjBCfQ_23da6db9613d64370f7f590e4555dd6ac9154b7d.jpg);"></div>
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=2">
                            <span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">3</span>/30일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#000; font-weight:600;">기도중</span>
                        </p>
                        
                        
                                                
                        
                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=2">로또 1등 되게 해주세요!   </a>                         
                            <button type="button" class="point_bg white" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                    </ul>                

                </div>
            </div>
        </li>
            <li class="gall_li ">
            <div class="gall_li_wr">
                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=1" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_nDWa4ufl_efa4ffbe4345bda17a1bb887809f63a878c39c24.jpg);"></div>                
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
                        	<a href="../bbs/board.php?bo_table=wish&amp;wr_id=1">
							<span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">7</span>/7일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#999; font-weight:600;">완료</span>
                        </p>
                        
                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=1">내가 사랑하는 모두가 아프지 않고 건강하게 해주세요!</a>                            
                            <button type="button" class="gray_bg gray" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                        
                    </ul>                 
                </div>
            </div>
        </li>
    </ul>

<div id="bo_list_total" style="display:none;">
    <span>전체 <?php echo number_format($total_count) ?>건</span>
    <?php echo $page ?> 페이지
</div>


    <h2>이미지 목록</h2>

        <?php if ($is_checkbox) { ?>
        <div class="all_chk chk_box">
            <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
            <label for="chkall">
            	<span></span>
            	<b class="sound_only">현재 페이지 게시물 </b> 전체선택
            </label>
            
            <button type="submit" name="btn_submit" value="선택삭제" class="btn black_bg white" onclick="document.pressed=this.value" style="    float: right;"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button>
            
        </div>
        <?php } ?>
    


<style>
#bo_gall #list_ul .gall_li_chk { top:0; left:0; position:relative;}
</style>
    
    <ul id="list_ul" style="border-top:1px solid #ddd;">
    	<h3 style="font-size:18px; margin-bottom:10px; font-weight:800; padding:20px 20px 0; ">실시간 소원</h3>
        <?php for ($i=0; $i<count($list); $i++) { ?>
        <li class="gall_li <?php if ($wr_id == $list[$i]['wr_id']) { ?>gall_now<?php } ?>" style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<?php if ($is_checkbox) { ?>
                <span class="gall_li_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                	<label for="chk_wr_id_<?php echo $i ?>">
                		<span></span>
                		<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                	</label>
                </span>
                <?php } ?>
				
                <a href="<?php echo $list[$i]['href'] ?>">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>
					<?php echo $list[$i]['name'] ?>님 소원 접수 완료 (기도올림 진행)
                </ul>
                </a>
            </div>
            <div class="gall_li_wr" style="display:none;">
                
                
                
                
                <span class="sound_only">
                    <?php
                    if ($wr_id == $list[$i]['wr_id'])
                        echo "<span class=\"bo_current\">열람중</span>";
                    else
                        echo $list[$i]['num'];
                    ?>
                </span>
                
                
                
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        

                        <a href="<?php echo $list[$i]['href'] ?>">
                        <p style=" padding-right:60px; word-break:keep-all;">
							<?php echo strip_tags($list[$i][wr_content], "<p>"); ?>
                            <button type="button" class="point_bg white" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br />하기</button>
                        </p>
                        </a>
                        
                        <!--
                        <?php if ($list[$i]['comment_cnt']) { ?>
	                    <span class="bo_cmt">
							<span class="sound_only">댓글</span>
							<?php echo $list[$i]['comment_cnt']; ?>
							<span class="sound_only">개</span>
	                    </span>
	                    <?php } ?>
                        -->
						<?php
	                    // if ($list[$i]['file']['count']) { echo '<'.$list[$i]['file']['count'].'>'; }	
	                    //if ($list[$i]['icon_new']) echo "<span class=\"new_icon\">N<span class=\"sound_only\">새글</span></span>";
	                    //if (isset($list[$i]['icon_hot'])) echo $list[$i]['icon_hot'];
	                    //if (isset($list[$i]['icon_file'])) echo $list[$i]['icon_file'];
	                    //if (isset($list[$i]['icon_link'])) echo $list[$i]['icon_link'];
	                    ?>
					</ul>                 
                    <div class="gall_info" style="display:none;">
                    	<?php if ($is_category && $list[$i]['ca_name']) { ?>
	                    <a href="<?php echo $list[$i]['ca_name_href'] ?>" class="bo_cate_link"><?php echo $list[$i]['ca_name'] ?></a>
    	                <?php } ?>
                        
                        ·
                                            
                    	<!--<span class="sound_only">작성자 </span><?php echo $list[$i]['name'] ?>-->
                        <span class="sound_only">작성일 </span><span class="date"><!--<i class="fa fa-clock-o" aria-hidden="true"></i> --></span>
                        <!--
                        <span class="sound_only">조회 </span><strong><i class="fa fa-eye" aria-hidden="true"></i> <?php echo $list[$i]['wr_hit'] ?></strong>
                        <?php if ($is_good) { ?><span class="sound_only">추천</span><strong><i class="fa fa-thumbs-o-up" aria-hidden="true"></i> <?php echo $list[$i]['wr_good'] ?></strong><?php } ?>
                        <?php if ($is_nogood) { ?><span class="sound_only">비추천</span><strong><i class="fa fa-thumbs-o-down" aria-hidden="true"></i> <?php echo $list[$i]['wr_nogood'] ?></strong><?php } ?>
                        -->
                    </div>
                </div>
            </div>
        </li>
        <?php } ?>
        <?php if (count($list) == 0) { echo "<li class=\"empty_list\">게시물이 없습니다.</li>"; } ?>
    </ul>
</div>


<div id="bo_gall">

    

<ul id="gall_ul">
    	<h3 style="font-size:18px; margin-bottom:10px; font-weight:800; padding:20px 20px 0; ">내 소원</h3>
                <li class="gall_li ">
            <div class="gall_li_wr">

                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=3" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_ebyR0IfD_6cdf94da9991da5873c20ba601291a75dc6fadb3.JPG);"></div>
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
                        	<a href="../bbs/board.php?bo_table=wish&amp;wr_id=3">
							<span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">3</span>/100일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#000; font-weight:600;">기도중</span>
                        </p>
                        

                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=3">
                            특별히 좋은 일이나 새로운 사건이 없어도 지금처럼 무난하게 흘러가게 해주세요. 
                            </a>                           
                            <button type="button" class="point_bg white" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                    </ul>                 

                </div>
            </div>
        </li>
            <li class="gall_li ">
            <div class="gall_li_wr">
                
                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=2" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_FlXjBCfQ_23da6db9613d64370f7f590e4555dd6ac9154b7d.jpg);"></div>
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=2">
                            <span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">3</span>/30일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#000; font-weight:600;">기도중</span>
                        </p>
                        
                        
                                                
                        
                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=2">로또 1등 되게 해주세요!   </a>                         
                            <button type="button" class="point_bg white" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                    </ul>                

                </div>
            </div>
        </li>
            <li class="gall_li ">
            <div class="gall_li_wr">
                <a href="../bbs/board.php?bo_table=wish&amp;wr_id=1" class="gall_img">
                <div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_nDWa4ufl_efa4ffbe4345bda17a1bb887809f63a878c39c24.jpg);"></div>                
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
                        	<a href="../bbs/board.php?bo_table=wish&amp;wr_id=1">
							<span style=" display:inline-block; line-height:20px;">2024-08-09 · <span class="black"><span class="point f_600">7</span>/7일</span></span>
                            </a>
                            <span style=" display:inline-block; float:right; width:50px; text-align:center; color:#999; font-weight:600;">완료</span>
                        </p>
                        
                        <p style=" padding-right:60px; word-break:keep-all;">
							<a href="../bbs/board.php?bo_table=wish&amp;wr_id=1">내가 사랑하는 모두가 아프지 않고 건강하게 해주세요!</a>                            
                            <button type="button" class="gray_bg gray" style=" position:absolute; top:28px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">기도<br>하기</button>
                        </p>
                        
                    </ul>                 
                </div>
            </div>
        </li>
    </ul>




<style>
#bo_gall #list_ul .gall_li_chk { top:0; left:0; position:relative;}
</style>
    
    <ul id="list_ul" style="border-top:1px solid #ddd;">
    	<h3 style="font-size:18px; margin-bottom:10px; font-weight:800; padding:20px 20px 0; ">실시간 소원</h3>
                <li class="gall_li " style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>
					<span class="sv_member">뚜**</span>님 소원 접수 완료 (기도올림 진행)
                </ul>
            </div>
            
        </li>
                <li class="gall_li " style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>도**님 소원 접수 완료 (기도올림 진행)
                </ul>

            </div>
            
        </li>
                <li class="gall_li " style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>도**님 소원 접수 완료 (기도올림 진행)
                </ul>
            </div>
            
        </li>
                <li class="gall_li " style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>
					<span class="sv_member">박**</span>님 소원 접수 완료 (기도올림 진행)
                </ul>
            </div>
            
        </li>
                <li class="gall_li " style="padding-bottom:10px;">
            
            <div style="position:relative;">
				<ul style=" position:relative;">
					<span class="" style=" display:inline-block; width:4px; height:4px; border-radius:50px; margin-right:6px; vertical-align: 4px; background-color:#000;"></span>
					<span class="sv_member">정**</span>님 소원 접수 완료 (기도올림 진행)
                </ul>
            </div>
            
        </li>
                    </ul>
</div>

</form>

<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>


<div style="width:100%; float:left; padding:20px;">
	<?php echo display_banner('소원다락방-하단', 'mainbanner.10.skin.php'); ?>
</div>

<fieldset id="bo_sch" style=" display:none;">
    <legend>게시물 검색</legend>
    <form name="fsearch" method="get">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="sca" value="<?php echo $sca ?>">
    <input type="hidden" name="sop" value="and">
    <label for="sfl" class="sound_only">검색대상</label>
    <select name="sfl" id="sfl">
        <?php echo get_board_sfl_select_options($sfl); ?>
    </select>
    <input name="stx" value="<?php echo stripslashes($stx) ?>" placeholder="검색어를 입력하세요" required id="stx" class="sch_input" size="15" maxlength="20">
    <button type="submit" value="검색" class="sch_btn"><i class="fa fa-search" aria-hidden="true"></i> <span class="sound_only">검색</span></button>
    </form>
</fieldset>

<?php if ($is_checkbox) { ?>
<script>
function all_checked(sw) {
    var f = document.fboardlist;

    for (var i=0; i<f.length; i++) {
        if (f.elements[i].name == "chk_wr_id[]")
            f.elements[i].checked = sw;
    }
}

function fboardlist_submit(f) {
    var chk_count = 0;

    for (var i=0; i<f.length; i++) {
        if (f.elements[i].name == "chk_wr_id[]" && f.elements[i].checked)
            chk_count++;
    }

    if (!chk_count) {
        alert(document.pressed + "할 게시물을 하나 이상 선택하세요.");
        return false;
    }

    if(document.pressed == "선택복사") {
        select_copy("copy");
        return;
    }

    if(document.pressed == "선택이동") {
        select_copy("move");
        return;
    }

    if(document.pressed == "선택삭제") {
        if (!confirm("선택한 게시물을 정말 삭제하시겠습니까?\n\n한번 삭제한 자료는 복구할 수 없습니다\n\n답변글이 있는 게시글을 선택하신 경우\n답변글도 선택하셔야 게시글이 삭제됩니다."))
            return false;

        f.removeAttribute("target");
        f.action = g5_bbs_url+"/board_list_update.php";
    }

    return true;
}

// 선택한 게시물 복사 및 이동
function select_copy(sw) {
    var f = document.fboardlist;

    if (sw == 'copy')
        str = "복사";
    else
        str = "이동";

    var sub_win = window.open("", "move", "left=50, top=50, width=500, height=550, scrollbars=1");

    f.sw.value = sw;
    f.target = "move";
    f.action = g5_bbs_url+"/move.php";
    f.submit();
}

// 게시판 리스트 관리자 옵션
jQuery(function($){
    $(".btn_more_opt.is_list_btn").on("click", function(e) {
        e.stopPropagation();
        $(".more_opt.is_list_btn").toggle();
    });
    $(document).on("click", function (e) {
        if(!$(e.target).closest('.is_list_btn').length) {
            $(".more_opt.is_list_btn").hide();
        }
    });
});
</script>
<?php } ?>
<!-- 게시판 목록 끝 -->
