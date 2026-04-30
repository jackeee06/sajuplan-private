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


<?php if ($write_href) { ?>
	<div class="fix_btn write_btn">
    	<a href="<?php echo $write_href ?>" title="소원다락방 이벤트 등록"><?php echo $board['bo_subject']; ?> 등록</a>
    </div>
<?php } ?>







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
    
<ul id="gall_ul">
        <?php 
		
		
		for ($i=0; $i<count($list); $i++) { 
		

		$wish_ing = $list[$i]["wr_1"];

		if(!$wish_ing){
			$wish_ing = "1";
		}

		if(!$wish_point){
			$wish_point = "100";
		}
		
		?>
        
        <li class="gall_li ">
            <div class="gall_li_wr">
            	<?php if ($is_checkbox) { ?>
                <span class="gall_li_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                	<label for="chk_wr_id_<?php echo $i ?>">
                		<span></span>
                		<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                	</label>
                </span>
                <?php } ?>
				

                <a href="<?php echo $list[$i]['href'] ?>" class="gall_img">
                <!--<div class="gall_img" style=" background-image:url(../data/file/wish/1935571771_ebyR0IfD_6cdf94da9991da5873c20ba601291a75dc6fadb3.JPG);">                	
                </div>-->
<?php
                if ($list[$i]['is_notice']) { // 공지사항 
				$thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);

                		            if($thumb['src']) {
                        		        //$img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" >';
										$img_content = '<div class="gall_img" style=" background-image:url('.$thumb['ori'].');"></div>';
		                            } else {
        		                        //$img_content = '<span class="no_image" style="'.$line_height_style.'">no image</span>';
										$img_content = '<div class="gall_img" style=" background-image:url(../img/common/noimage.png);"></div>';
                		            }

                        		    echo run_replace('thumb_image_tag', $img_content, $thumb);
									?>
                    <strong class="gall_notice">공지</strong>
                <?php
                } else {
                    $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);

                		            if($thumb['src']) {
                        		        //$img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" >';
										$img_content = '<div class="gall_img" style=" background-image:url('.$thumb['ori'].');"></div>';
		                            } else {
        		                        //$img_content = '<span class="no_image" style="'.$line_height_style.'">no image</span>';
										$img_content = '<div class="gall_img" style=" background-image:url(../img/common/noimage.png);"></div>';
                		            }

                        		    echo run_replace('thumb_image_tag', $img_content, $thumb);
		                        
                }
                ?>
                </a>
                <div class="gall_text_href">
                    
                    <ul class="gall_li_tit">
                        
                        <p style="font-size:12px; color:#999; font-weight:400; margin-bottom:6px;">
                        	<a href="<?php echo $list[$i]['href'] ?>">
							<span style=" display:inline-block; line-height:20px;">
                            	<?php echo $list[$i]['datetime2'] ?>~
                                
                                · 
                                <span class="black">
                                	<?php echo $list[$i]['ca_name'] ?>
                                </span>
                                
                            </span>
                            </a>
							
                            <span style=" display:inline-block; float:right; text-align:right; color:#000; font-weight:600;">
                            	<span class="pink">
									<?php if ($list[$i]['comment_cnt']) { ?>
										<?php echo $list[$i]['comment_cnt']; ?>
                                    <? }else{?>
                                    	0
									<? }?>
                                </span>
                                명 참여 중
                            </span>
                        </p>
                        
						<a href="<?php echo $list[$i]['href'] ?>">
                        <p style=" padding-right:60px; word-break:keep-all;">
                            <?php echo strip_tags($list[$i][wr_content], "<p>"); ?>                          
                            
                            <button type="button" class="black_bg white" style=" position:absolute; top:22px; right:0; width:50px; text-align:center; display:inline-block;padding:6px 8px; border-radius:8px; font-size:14px;">참여<br /> 하기</button>                           				
                        </p>
                        </a>
                    </ul>                 

                </div>
                
            
            </div>
        </li>

        
        <?php } ?>
        <?php if (count($list) == 0) { echo "<li class=\"empty_list\">등록된 소원이 없습니다.</li>"; } ?>
    </ul>
    
    
    
    
    
</div>

</form>


<script>
function iwish(wr_id, wish_ing, wish_point){
	if(!wr_id)return;


	$.ajax({
		url: "/bbs/ajax.wish_update.php",
		type:"POST",
		data:{wr_id:wr_id},
		timeout: 1000 * 120,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		success: function(data) {
			alert(data);
			window.location.reload();

		},
		error: function(e) {
			alert("수정 중 오류가 발생했습니다.");
		},
		timeout: 5000
	});


}
</script>



<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>



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
