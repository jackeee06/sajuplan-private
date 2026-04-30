<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');
						
// 선택옵션으로 인해 셀합치기가 가변적으로 변함
$colspan = 2;

if ($is_checkbox) $colspan++;

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

global $board, $group;

?>


<form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
<input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="spt" value="<?php echo $spt ?>">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="sw" value="">

<!--
<?php if ($write_href) { ?>
	<div class="fix_btn write_btn ">
    	<a href="<?php echo $write_href ?>" class="point_bg white" title="작성"><?php echo $board['bo_subject']; ?> 작성</a>
    </div>
<?php } ?>
-->

<div class="con_section_03" >

	<?php //include_once(G5_PATH.'/include/qa_title.php'); ?>
    

    <?php if ($is_checkbox) { ?>
        <div class="all_chk chk_box">
            <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
            <label for="chkall">
            	<span></span>
            	<b class="sound_only">현재 페이지 게시물 </b> 전체선택
            </label>
            
            <button type="submit" name="btn_submit" value="선택삭제" class="btn black_bg white" onclick="document.pressed=this.value" style="    float: right;"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button>
            
            <?php if ($rss_href || $write_href) { ?>
				<ul class="<?php echo isset($view) ? 'view_is_list btn_top' : 'btn_top top btn_bo_user';?>" style="display:none;">
					<!--
					<?php if ($admin_href) { ?><li><a href="<?php echo $admin_href ?>" class="btn_admin btn" title="관리자"><i class="fa fa-cog fa-spin fa-fw"></i><span class="sound_only">관리자</span></a></li><?php } ?>
    				<?php if ($rss_href) { ?><li><a href="<?php echo $rss_href ?>" class="btn_b03 btn" title="RSS"><i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span></a></li><?php } ?>
                    -->
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
				</ul>
			<?php } ?>
        </div>
    <?php } ?>
        
    <?php 
		$update_href = $delete_href = '';
			set_session('ss_delete_token', $token = uniqid(time()));

		for ($i=0; $i<count($list); $i++) { 
		
		// 로그인중이고 자신의 글이라면 또는 관리자라면 비밀번호를 묻지 않고 바로 수정, 삭제 가능

//		echo $list[$i]["wr_1"];
//		echo "/";
//		echo $list[$i]["mb_id"];
//		echo "<br>";

		if (($member['mb_id'] && ($member['mb_id'] === $list[$i]['mb_id'])) || $is_admin) {

		    $update_href = './write.php?w=u&amp;bo_table='.$bo_table.'&amp;wr_id='.$list[$i]['wr_id'].'&amp;page='.$page.$qstr;

			if($list[$i]['wr_id'])$delete_href ='./delete.php?bo_table='.$bo_table.'&amp;wr_id='.$list[$i]['wr_id'].'&amp;token='.$token.'&amp;page='.$page.urldecode($qstr);
		
		}
		else{ // 회원이 쓴 글이 아니라면
		    //$update_href = './password.php?w=u&amp;bo_table='.$bo_table.'&amp;wr_id='.$list[$i]['wr_id'].'&amp;page='.$page.$qstr;
		    //$delete_href = './password.php?w=d&amp;bo_table='.$bo_table.'&amp;wr_id='.$list[$i]['wr_id'].'&amp;page='.$page.$qstr;

			$update_href = '';
		    $delete_href = '';
		}

		
		// 글쓴이 정보 가져오기
		$wmb = get_member($list[$i]["mb_id"]);

		//상담사 정보 가져오기 //
		$mb = get_member($list[$i]["wr_1"]);

		if($list[$i]["wr_10"]){
		// 상담정보 있으면 가져오기
			$sql = "select * from platform_consulting where no='".$list[$i]["wr_10"]."'";
			$rst = sql_query($sql);
			if($rst){
				$sa_info = sql_fetch_array($rst);
			}
		}


		/// 상담사 정보 있으면 상담사 프로필 가져오기
		$sql = "select * from g5_write_counselor where mb_id='".$mb["mb_id"]."'";
		$crow = sql_fetch($sql);	
		/// 상담사 정보 있으면 상담사 프로필 가져오기 끝.



		$thumb1 = get_list_thumbnail('counselor', $crow['wr_id'], '48', '48', false, true);
		$img = "";

		if($thumb1['src']) {
			$img = $thumb1["src"];
		} else {
			  $img = G5_IMG_URL.'/no_img.png';
		}
	
	?>    


    <div class="review_wrap qa">	
    	
		
		
		
		<? if(!$list[$i]['reply']){ ?>
			
              <!-- 작성자 정보 -->
           	  <ul class="review_user">
                  
				  <li class="review_user_score">
                  	  <?php if ($is_checkbox) { ?>
	                  <div class="bo_chk chk_box">
    	                  <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                          <label for="chk_wr_id_<?php echo $i ?>">
	                      	  <span></span>
    	                	  <b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                          </label>   	
        		       </div>
                       <?php } ?>
                
                
                   	  <p class="review_user_id"><?php echo $list[$i]['name'] ?><span class="date" style=" font-size:13px; color:#999; display:inline-block; margin-left:4px;"><?php echo $list[$i]['datetime'] ?></span></p>
                      
                      <!-- 신고/차단 -->
                		<?php include(G5_PATH.'/include/singo_wrap.php'); ?>
                  </li>
              </ul>                              
              <!-- 문의 내용 -->
              <ul class="review_con">
			  
  				  <?php if ($is_admin) { ?>
                        <span class="point" style=" display:inline-block; margin-bottom:10px;">상담사: <?php echo $list[$i]['wr_1'] ?></span>
                  <?php } ?>					
               	  <a href="<?php echo $list[$i]['href'] ?>">
                  <li class="review_con_text">
                  		
                		<div class="review_text">
                        	<?php 
							
							if (!$is_admin && isset($list[$i]['icon_secret']) && $update_href=="" && ($list[$i]["wr_1"]!=$member["mb_id"])){  /// 비밀글일때
							
									echo $list[$i]['icon_secret']; ?>
							
                        		<ul class="review_title">비밀글입니다.</ul>
								<ul class="review_txt">비밀글 입니다. 당사자와 관리자만 확인가능</ul>
                            <?}else{?>
								<ul class="review_title"><?php echo $list[$i]['subject'] ?></ul>
								<ul class="review_txt"><?php echo strip_tags($list[$i]['wr_content']) ?></ul>
							<?}?>

                            <ul>
                                <span class="review_list_btn_wrap">

                                	<?php if ($update_href) { ?><a class=" black_bo black review_list_btn" href="<?php echo $update_href ?>&csr_id=<?=$mb["mb_id"]?>">수정</a><?php } ?>
                                	<?php if ($delete_href) { ?><a class=" point_bo point review_list_btn" href="<?php echo $delete_href ?>" onclick="del(this.href); return false;">삭제</a><?php } ?>                                    
                                </span>
                            </ul>
                        </div>
                    </li>
                  </a>
                </ul>

		                
                <? }?>  
        
				
				   <style>
				.review_re_state_wait { display:none;}
				</style>
				
				<?
               $sql1 = " select * from g5_write_qa where wr_parent = '".$list[$i]["wr_id"]."' and wr_is_comment = 1 order by wr_comment, wr_comment_reply ";
								
				$result1 = sql_query($sql1);
				if($result1){
				for ($j=0; $row1=sql_fetch_array($result1); $j++)
				{

						$wwmb = get_member($row1["mb_id"]);
					
						$row1['datetime'] = substr($row1['wr_datetime'],2,14);

						$row1['content'] = conv_content($row1['wr_content'], 0, 'wr_content');

						// 관리자가 아니라면 중간 IP 주소를 감춘후 보여줍니다.
						if (!$is_admin)
							$row1['ip'] = preg_replace("/([0-9]+).([0-9]+).([0-9]+).([0-9]+)/", G5_IP_DISPLAY, $row1['wr_ip']);

				?>
				 <a href="<?php echo $list[$i]['href'] ?>">
				<ul class="review_user counsel point_02_bo"> 
					<li class="review_re_name"><?=$wwmb["mb_nick"]?><span class="re_date" style=""><?=substr($row1["wr_datetime"],0,10);?></span></li>
                    <li class="review_re_con">
                    
					<?
					if(!$list[$i]['icon_secret']){
									echo nl2br($row1['content']);
						}else{
								if($is_admin || $list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
									echo nl2br($row1['content']);
								}else{
									echo "비밀글 입니다.";
								}									
						}	
					?>
                    </li>
                </ul>
				</a>
				<?
				}
				}else{
					?>
						<ul class="review_user counsel review_re_state_wait"> 
								<li class="review_re_name"><?=$mb["mb_nick"]?> <span class="review_re_state white">답변 대기</span></li>
							</ul>
					<?
					}
                ?>
				
		                
                          
                
			</div>
        <?php } ?>
        <?php if (count($list) == 0) { echo '<li class="empty_table">게시물이 없습니다.</li>'; } ?>
	</div>
    
<!-- 게시판 목록 시작 -->
<div id="bo_list">

<!--
    <?php if ($is_category) { ?>
    <nav id="bo_cate">
        <h2><?php echo ($board['bo_mobile_subject'] ? $board['bo_mobile_subject'] : $board['bo_subject']) ?> 카테고리</h2>
        <ul id="bo_cate_ul">
            <?php echo $category_option ?>
        </ul>
    </nav>
    <?php } ?>
	

<div id="bo_list_total">
    <span>전체 <?php echo number_format($total_count) ?>건</span>
    <?php echo $page ?> 페이지
</div>
-->
</div>

</form>

<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>

<!--
<fieldset id="bo_sch">
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
-->

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
