<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');
// 선택옵션으로 인해 셀합치기가 가변적으로 변함
$colspan = 2;

if ($is_checkbox) $colspan++;

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
?>

<style>
/** button **/
.btn-gradient.mini{
  padding: 4px 12px;
  font-size: 12px;
}
/* Gradient buttons */
.btn-gradient {
text-decoration: none;
color: white;
padding: 10px 30px;
display: inline-block;
position: relative;
border: 1px solid rgba(0,0,0,0.21);
border-bottom: 4px solid rgba(0,0,0,0.21);
border-radius: 4px;
text-shadow: 0 1px 0 rgba(0,0,0,0.15);
}
/* Gradient - ugly css is ugly */
.btn-gradient.red{
background: rgba(250,90,90,1);
background: -webkit-gradient(linear, 0 0, 0 100%, from(rgba(250,90,90,1)), to(rgba(232,81,81,1)));
background: -webkit-linear-gradient(rgba(250,90,90,1) 0%, rgba(232,81,81,1) 100%);
background: -moz-linear-gradient(rgba(250,90,90,1) 0%, rgba(232,81,81,1) 100%);
background: -o-linear-gradient(rgba(250,90,90,1) 0%, rgba(232,81,81,1) 100%);
background: linear-gradient(rgba(250,90,90,1) 0%, rgba(232,81,81,1) 100%);
filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#fa5a5a', endColorstr='#e85151', GradientType=0 );
}
.btn-gradient.orange {
background: rgba(255,105,30,1);
background: -webkit-gradient(linear, 0 0, 0 100%, from(rgba(255,105,30,1)), to(rgba(230,95,28,1)));
background: -webkit-linear-gradient(rgba(255,105,30,1) 0%, rgba(230,95,28,1) 100%);
background: -moz-linear-gradient(rgba(255,105,30,1) 0%, rgba(230,95,28,1) 100%);
background: -o-linear-gradient(rgba(255,105,30,1) 0%, rgba(230,95,28,1) 100%);
background: linear-gradient(rgba(255,105,30,1) 0%, rgba(230,95,28,1) 100%);
}
.btn-gradient.green {
background: rgba(130,200,160,1);
background: -moz-linear-gradient(top, rgba(130,200,160,1) 0%, rgba(130,199,158,1) 100%);
background: -webkit-gradient(left top, left bottom, color-stop(0%, rgba(130,200,160,1)), color-stop(100%, rgba(130,199,158,1)));
background: -webkit-linear-gradient(top, rgba(130,200,160,1) 0%, rgba(130,199,158,1) 100%);
background: -o-linear-gradient(top, rgba(130,200,160,1) 0%, rgba(130,199,158,1) 100%);
background: -ms-linear-gradient(top, rgba(130,200,160,1) 0%, rgba(130,199,158,1) 100%);
background: linear-gradient(to bottom, rgba(130,200,160,1) 0%, rgba(124, 185, 149, 1) 100%);
filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#82c8a0', endColorstr='#82c79e', GradientType=0 );
}

.btn-gradient.red:active 	  {background: #E35252;}
.btn-gradient.orange:active {background: #E8601B;}
.btn-gradient.green:active  {background: #72B08E;}

</style>


<div id="bo_sch_wrap">
<fieldset id="bo_sch">
    <legend>게시물 검색</legend>
    <form name="fsearch" method="get">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="sca" value="<?php echo $sca ?>">
    <input type="hidden" name="sop" value="and">
    <label for="sfl" class="sound_only">검색대상</label>
    <!-- 검색대상 숨김 -->
    <input type="hidden" ​name="sfl" id="sfl" value="wr_subject||wr_content​">
    <!--
    <select name="sfl" id="sfl">
    	<option value="wr_subject||wr_content">제목+내용</option>
        <?php //echo get_board_sfl_select_options($sfl); ?>
    </select>
    -->
    	<div id="bo_sch_item">
		    <input name="stx" value="<?php echo stripslashes($stx) ?>" placeholder="검색어를 입력하세요" required id="stx" class="sch_input" size="15" maxlength="20">
		    <button type="submit" value="검색" class="sch_btn"><i class="fa fa-search" aria-hidden="true"></i> <span class="sound_only">검색</span></button>
    	</div>
    </form>
</fieldset>
</div>


<form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
<input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="spt" value="<?php echo $spt ?>">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="sw" value="">

<?php if ($rss_href || $write_href) { ?>
<ul class="<?php echo isset($view) ? 'view_is_list btn_top' : 'btn_top top btn_bo_user';?>" style="display:none;">
	<?php if ($admin_href) { ?><li><a href="<?php echo $admin_href ?>" class="btn_admin btn" title="관리자"><i class="fa fa-cog fa-spin fa-fw"></i><span class="sound_only">관리자</span></a></li><?php } ?>
    <?php if ($rss_href) { ?><li><a href="<?php echo $rss_href ?>" class="btn_b03 btn" title="RSS"><i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span></a></li><?php } ?>
    <?php if ($is_admin == 'super' || $is_auth) {  ?>
	<li>
		<button type="button" class="btn_more_opt btn_b03 btn is_list_btn" title="게시판 리스트 옵션"><i class="fa fa-ellipsis-v" aria-hidden="true"></i><span class="sound_only">게시판 리스트 옵션</span></button>
		<?php if ($is_checkbox) { ?>
        <ul class="more_opt is_list_btn">
            <li><button type="submit" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button></li>
            <li><button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value"><i class="fa fa-files-o" aria-hidden="true"></i> 선택복사</button></li>
            <li><button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value"><i class="fa fa-arrows" aria-hidden="true"></i> 선택이동</button></li>
        </ul>
        <?php } ?>
	</li>
    <?php } ?>
	<?php if ($write_href) { ?><li><a href="<?php echo $write_href ?>" class="fix_btn write_btn" title="글쓰기"><i class="fa fa-pencil" aria-hidden="true"></i><span class="sound_only">글쓰기</span></a></li><?php } ?>
</ul>
<?php } ?>
<!-- 게시판 목록 시작 -->
<div id="bo_list">

    <?php if ($is_category) { ?>
    <nav id="bo_cate">
        <h2><?php echo ($board['bo_mobile_subject'] ? $board['bo_mobile_subject'] : $board['bo_subject']) ?> 카테고리</h2>
        <ul id="bo_cate_ul">
            <?php echo $category_option ?>
        </ul>
    </nav>
    <?php } ?>

    <div class="list_01">
        <?php if ($is_checkbox) { ?>
        <div class="all_chk chk_box">
            <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
            <label for="chkall">
            	<span></span>
            	<b class="sound_only">현재 페이지 게시물 </b> 전체선택
            </label>
            
            <?php if ($admin_href) { ?>
            <div class="edit_btn" style="float:right; text-align:right;">
            	<button type="submit" class="btn" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value">선택삭제</button>

				<?php if ($write_href) { ?>
                <a href="<?php echo $write_href ?>" class="btn point_04_bg white" title="글쓰기">FAQ 등록</a>
				<?php } ?>
            </div>
            <?php } ?>
        </div>
        <?php } ?>
        <ul>
            <?php for ($i=0; $i<count($list); $i++) { ?>
            <li class="<?php if ($list[$i]['is_notice']) echo "bo_notice"; ?>">
                <?php if ($is_checkbox) { ?>
                <div class="bo_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                    <label for="chk_wr_id_<?php echo $i ?>">
                    	<span></span>
                    	<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                    </label>
                </div>
                <?php } ?>

                <details class="details-view">
                	

					<summary>
						<span class="point_02">Q.</span> 
						
						<?php if ($is_category && $list[$i]['ca_name']) { ?>
                		<div class="bo_cate_ico">
	    	                <a href="<?php echo $list[$i]['ca_name_href'] ?>" class="bo_cate_link">[<?php echo $list[$i]['ca_name']; ?>]</a>
    	                </div>
	                    <?php } ?>
                        
						<?php echo $list[$i]['subject'] ?> 
                        
                        <!--
                    	<?php if($is_admin == 'super'){?>
                            <a class="btn-gradient red mini" href="<?php echo $list[$i]['href'] ?>">
                        		수정
                      		</a>
	                    <?php }?>
                        -->
                        
                        
                        <?php  set_session('ss_delete_token', $token = uniqid(time()));
    						$delete_href ='./delete.php?bo_table='.$bo_table.'&wr_id='.$list[$i]['wr_id'];
  							if($member['mb_id']==$list[$i]['mb_id']){

	  					?>
							
							<a class="btn-gradient green mini" href="write.php?w=u&bo_table=comm_faq&wr_id=<?=$list[$i]['wr_id']?>">수정</a>
                            <!--<a class="btn-gradient red mini" href="<?=$delete_href?>">삭제</a>-->

						<? }?>
                      
                        
	                </summary>
                    
                    <div class="answer_wrap">
	                    <span id="hashLink<?php echo $i;?>">A.</span>
                        <?=conv_content($list[$i]['wr_content'], 2);?>
                    </div>
                </details>
            </li>
            <?php } ?>
            <?php if (count($list) == 0) { echo '<li class="empty_table">등록된 FAQ가 없습니다.</li>'; } ?>
        </ul>
    </div>
</div>

<script>
	const detailsElement = document.querySelector('.details-view');

	detailsElement.addEventListener('toggle', event => {
			if (event.target.open) {
					console.log('open');
			} else {
					console.log('closed');
			}
	});
</script>
</form>

<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>

<div id="bo_list_total" style="display:none;">
    <span>전체 <?php echo number_format($total_count) ?>건</span>
    <?php echo $page ?> 페이지
</div>


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
