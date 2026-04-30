<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 선택옵션으로 인해 셀합치기가 가변적으로 변함
$colspan = 5;

if ($is_checkbox) $colspan++;
if ($is_good) $colspan++;
if ($is_nogood) $colspan++;

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

?>

<script>
$(window).on('load', function() {
    $('#bo_cate_on').css("background-color", "<?php echo $board['bo_1']; ?>");
    $('#bo_list .cnt_cmt').css("background-color", "<?php echo $board['bo_1']; ?>");
    $('#bo_list .btn_list_01 a').css("background-color", "<?php echo $board['bo_1']; ?>");
    $('#bo_list .td_num2 .fa-bell').css("color", "<?php echo $board['bo_1']; ?>");
    $('#bo_list .td_num2 .fa-lock').css("color", "<?php echo $board['bo_1']; ?>");
    $('#bo_list .comm_cnt').css("color", "<?php echo $board['bo_1']; ?>");
    $('.scrap_ico .fa-heart').css("color", "<?php echo $board['bo_1']; ?>");
    $('.re_cmt').css("color", "<?php echo $board['bo_1']; ?>");
    $('.re_cmt2').css("color", "<?php echo $board['bo_1']; ?>");
    $('.fa-bell').css("color", "<?php echo $board['bo_1']; ?>");
    
    //진행중 아이콘 백그라운드 색상 처리
    $('.status_b1').css("background-color", "<?php echo $board['bo_1']; ?>");
});
</script>



<!-- 게시판 목록 시작 { -->
<div id="bo_list" style="width:<?php echo $width; ?>">
            <?php if ($is_category) { ?>
            <div class="mo_view bo_mo_cate">
                <form name="fcategory" method="get">
                    <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
                    <select name="sca" onchange="this.form.submit()" class="bo_cate_sel">
                        <option value=''>전체</option>
                        <?php echo get_category_option($bo_table, $sca); // SELECT OPTION 태그로 넘겨받음 ?>
                    </select>
                </form>
            </div>
            <?php } ?>
    
    <form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
    
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
    <input type="hidden" name="stx" value="<?php echo $stx ?>">
    <input type="hidden" name="spt" value="<?php echo $spt ?>">
    <input type="hidden" name="sca" value="<?php echo $sca ?>">
    <input type="hidden" name="sst" value="<?php echo $sst ?>">
    <input type="hidden" name="sod" value="<?php echo $sod ?>">
    <input type="hidden" name="page" value="<?php echo $page ?>">
    <input type="hidden" name="sw" value="">

    <!-- 게시판 페이지 정보 및 버튼 시작 { -->
    <div id="bo_btn_top">
        <div id="bo_list_total">
            
            
            
            <!-- 게시판 카테고리 시작 { -->
            <?php if ($is_category) { ?>
            <div id="bo_cate" class="pc_view">
                <h2><?php echo $board['bo_subject'] ?> 카테고리</h2>
                <ul id="bo_cate_ul">
                    <?php echo $category_option ?>
                </ul>
            </div>
            <?php } ?>
            <!-- } 게시판 카테고리 끝 -->
            
            <!--
            <span><?php echo number_format($total_count) ?> 건의 게시물이 있습니다.</span>
            <?php echo $page ?> 페이지
            -->
        </div>

        <ul class="btn_bo_user">
        	<?php if ($admin_href) { ?>
            <li class="pc_view">
                <a href="<?php echo $admin_href ?>" class="btn_b01 btn" title="관리자">
                    <i class="fa fa-cog"></i><span class="sound_only">관리자</span>
                </a>
            </li>
            <?php } ?>
            
            <?php if ($rss_href) { ?>
            <li class="pc_view">
                <a href="<?php echo $rss_href ?>" class="btn_b01 btn" title="RSS">
                    <i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span>
                </a>
            </li>
            <?php } ?>
            
            <li>
            	<button type="button" class="btn_bo_sch btn_b01 btn" title="게시판 검색">
                    <i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">게시판 검색</span>
                </button>
            </li>
            
            <?php if ($write_href) { ?>
            <li class="pc_view">
                <a href="<?php echo $write_href ?>" class="btn_b01 btn" title="등록">
                    <i class="fa fa-pencil" aria-hidden="true"></i><span class="sound_only">등록</span>
                </a>
            </li>
            <?php } ?>
            
        	<?php if ($is_admin == 'super' || $is_auth) {  ?>
        	<li>
        		<button type="button" class="btn_more_opt is_list_btn btn_b01 btn top_op_btn" title="게시판 리스트 옵션">
                    <i class="fa fa-ellipsis-v" aria-hidden="true" style="font-size:18px;"></i><span class="sound_only">게시판 리스트 옵션</span>
                </button>
                
        		<?php if ($is_checkbox) { ?>	
		        <ul class="more_opt is_list_btn">  
		            <li><button type="submit" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button></li>
		            <li><button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value"><i class="fa fa-files-o" aria-hidden="true"></i> 선택복사</button></li>
		            <li><button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value"><i class="fa fa-arrows" aria-hidden="true"></i> 선택이동</button></li>
		        </ul>
		        <?php } ?>
                
        	</li>
            
            <?php if ($is_checkbox) { ?>
            <li class="all_chk chk_box top_chk_all">
                <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
                <label for="chkall">
                	<span></span>
                	<b class="sound_only">현재 페이지 게시물  전체선택</b>
				</label>
            </li>
            <?php } ?>
            
        	<?php }  ?>
        </ul>
    </div>
    <!-- } 게시판 페이지 정보 및 버튼 끝 -->
        	
    <div class="tbl_head01 tbl_wrap">
        <table>
        <caption><?php echo $board['bo_subject'] ?> 목록</caption>

        <tbody>
            
        <?php
        for ($i=0; $i<count($list); $i++) {
            
            $t_day = date("Y-m-d H:i:s", time());  // 오늘
            $start_day = $list[$i]['wr_1']." 00:00:00"; // 시작일
            $end_day = $list[$i]['wr_2']." 23:59:59"; // 종료일
 
            //$thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], "50", "40");
            $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);

                if($thumb['src']) {
                    $img_content = $thumb['src'];
                } else {
                    $img_content = '';
                }
            
		?>
        
            <tr class="<?php echo $lt_class ?>" style="background-color:#fff;">
            
            <?php if($img_content) { ?>
                
            <td class="td_datetime pc_view">
                <?php if ($is_checkbox) { ?>
                    <div class="td_chk chk_box">
                        <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                        <label for="chk_wr_id_<?php echo $i ?>">
                            <span></span>
                            <b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                        </label>

                    </div>
                <?php } ?>
                
                <div class="img_v_pc pc_view">
                    <a href="<?php echo $list[$i]['href'] ?>"><img src="<?php echo $img_content; ?>"></a>
                </div>
            </td>
            <?php } ?>
                
                
            <td class="td_subject" <?php if(!$img_content) { ?>colspan="2"<?php } ?>>
                <div class="bo_tit">
                    
                    <ul class="bo_tit_ul5">
                        이벤트 기간 : <?php echo $list[$i]['wr_1'] ?> ~ <?php echo $list[$i]['wr_2'] ?>
                    </ul>
                    
                    <ul class="bo_tit_ul2">
                        
                        <?php if($list[$i]['icon_secret']) { ?><i class="fa fa-lock" aria-hidden="true"></i> <?php } ?>
                        <?php if($list[$i]['is_notice']) { ?><i class="fa fa-bell" aria-hidden="true"></i> <?php } ?>
                        <a href="<?php echo $list[$i]['href'] ?>" class="sub_j">
                            <?php echo $list[$i]['subject'] ?> <?php if ($list[$i]['wr_comment']) { ?><span class="re_cmt2">+<?php echo $list[$i]['wr_comment']; ?></span><?php } ?>
                        </a> 
                        
                        <?php if ($list[$i]['icon_new']) echo "<span class=\"new_icon\">N<span class=\"sound_only\">새글</span></span>";?>
                        
                        <?php if($img_content) { ?>
                        <div class="img_v_mo mo_view">
                            <a href="<?php echo $list[$i]['href'] ?>"><img src="<?php echo $img_content; ?>"></a>
                        </div>
                        <?php } ?>

                        
                    </ul>
                    

                    <ul class="bo_tit_ul3">
                        <?php echo $list[$i]['wr_3'] ?>
                    </ul>
                    
                    
                    

                    <ul class="bo_tit_ul4">
                        <li class="fl">
                            
                            <?php if($t_day >= $start_day && $t_day <= $end_day) { ?>
                                <a href="javascript:void(0);" class="status_b1">진행중</a>
                            <?php } else if($t_day < $start_day) { ?>
                                <a href="javascript:void(0);" class="status_b3">진행예정</a>
                            <?php } else if($t_day > $end_day) { ?>
                                <a href="javascript:void(0);" class="status_b2">종료</a>
                            <?php } else { ?>
                            <?php } ?>
                            
                        </li>
                        <li class="fl">
                            <span class="bo_names"><?php echo $list[$i]['name'] ?></span>　
                            <?php if ($is_category && $list[$i]['ca_name']) { ?>
                            <?php echo $list[$i]['ca_name'] ?>　
                            <?php } ?>
                            <!--
                            <i class="fa fa-clock-o" aria-hidden="true"></i> <?php echo $list[$i]['datetime'] ?>　
                            -->
                            <i class="fa fa-eye" aria-hidden="true"></i> <?php echo $list[$i]['wr_hit'] ?>　
                        </li>
                        <div class="cb"></div>
                    </ul>
                    
                    


                </div>

            </td>
            

        </tr>
            
               
        <?php } ?>
        <?php if (count($list) == 0) { echo '<tr><td colspan="'.$colspan.'" class="empty_table">등록된 이벤트가 없습니다.</td></tr>'; } ?>
        </tbody>
        </table>
    </div>
        
	<!-- 페이지 -->
	<?php echo $write_pages; ?>
	<!-- 페이지 -->
        
	
    <?php if ($list_href || $is_checkbox || $write_href) { ?>
    <div class="bo_fx">
        <?php if ($list_href || $write_href) { ?>
        <ul class="btn_bo_user_btm">

            <?php if ($write_href) { ?>
            <li class="btn_list_01">
                <a href="<?php echo $write_href ?>" class="btn_b01 btn" title="등록">
                    <i class="fa fa-pencil mo_view" aria-hidden="true"></i>
                    <span class="pc_view">등록하기</span>
                </a>
            </li>
            <?php } ?>

            
        </ul>	
        <?php } ?>
    </div>
    <?php } ?>   
    </form>

    <!-- 게시판 검색 시작 { -->
    <div class="bo_sch_wrap">
        <fieldset class="bo_sch">
            <h3>검색</h3>
            <form name="fsearch" method="get">
            <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
            <input type="hidden" name="sca" value="<?php echo $sca ?>">
            <input type="hidden" name="sop" value="and">
            <label for="sfl" class="sound_only">검색대상</label>
            <select name="sfl" id="sfl">
                <?php echo get_board_sfl_select_options($sfl); ?>
            </select>
            <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
            <div class="sch_bar">
                <input type="text" name="stx" value="<?php echo stripslashes($stx) ?>" required id="stx" class="sch_input" size="25" maxlength="20" placeholder=" 검색어를 입력해주세요">
                <button type="submit" value="검색" class="sch_btn"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">검색</span></button>
            </div>
            <button type="button" class="bo_sch_cls" title="닫기"><i class="fa fa-times" aria-hidden="true"></i><span class="sound_only">닫기</span></button>
            </form>
        </fieldset>
        <div class="bo_sch_bg"></div>
    </div>
    
    <script>
    jQuery(function($){
        // 게시판 검색
        $(".btn_bo_sch").on("click", function() {
            $(".bo_sch_wrap").toggle();
        })
        $('.bo_sch_bg, .bo_sch_cls').click(function(){
            $('.bo_sch_wrap').hide();
        });
    });
    </script>
    <!-- } 게시판 검색 끝 --> 
</div>
    


<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

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

    if (sw == "copy")
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
<!-- } 게시판 목록 끝 -->
