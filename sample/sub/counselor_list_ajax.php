<?php
include_once('../common.php');
include_once($_SERVER["DOCUMENT_ROOT"].'/lib/latest.lib.php');

$itab = "every";
include_once ('../bbs/list.php')
?>
    <div class="counselor_list_item">
                	<a href="<?php echo $list[$i]['href'] ?>">
						<ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$i]['ca_name']]?>">
							<span class="list_scrap" onclick="scrap_submit('<?=$list[$i]["wr_id"]?>')" style="cursor:pointer;">
								<?
								$sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $list[$i]["wr_id"]);
								$scrap_img = "/img/common/list_icon_scrap.png";
								if($sflag==true){
									$scrap_img = "/img/common/list_icon_scrap_on.png";
								}
								?>
								<img src="<?=$scrap_img?>" id="scrap_icon_<?=$list[$i]["wr_id"]?>">
							</span>
							<?php if ($is_category && $list[$i]['ca_name']) { ?>
								<span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?php echo $list[$i]['ca_name']; ?></span>
							<?php } ?>
							<?php if ($list[$i]['is_notice']) { // 공지사항  ?>
								<span class="is_notice" style="<?php echo $line_height_style; ?>">공지</span>
							<?php } else {


								$thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);


								if($thumb['src']) {
									//$img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" >';
									$img_content = '<li class="counselor_img" style=" background-image:url('.$thumb['src'].');">';
								} else {
									//$img_content = '<span class="no_image" style="'.$line_height_style.'">no image</span>';
									$img_content = '<li class="counselor_img" style=" background-image:url(../img/common/noimage.png);">';
								}

								echo run_replace('thumb_image_tag', $img_content, $thumb);
								}
							?>

						</ul>
                    </a>
					<ul class="counselor_con_wrap">
						<?php if ($is_checkbox) { ?>
							<div class="bo_chk chk_box">
								<input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
								<label for="chk_wr_id_<?php echo $i ?>">
									<span></span>
									<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
								</label>
							</div>
						<?php } ?>
						<div class="counselor_con_right">
							<a href="<?php echo $list[$i]['href'] ?>">
								<li>
									<div class="top">
										<div class="counselor_con_title">
											<?php echo $list[$i]['subject'] ?>
											<!-- 상담사 고유번호 -->
											<?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>
										</div>
										<div class="counselor_con_text line2_text"><?php echo $list[$i]['wr_8'] ?></div>
									</div>
									<div class="counselor_con_price">
										<!-- <img src="../../../img/common/icon_price.png" alt="금액 아이콘"> -->
                                         <!-- 20250717 eun 상담사 리스트 카테고리 있을 때 가격과 시간, 상태 버튼 작업 시작-->
										<?=number_format($cinfo["mb_4"])?>원
										<span class="unit"><?=$cinfo["mb_5"]?>초당</span>
									</div>
								</li>
							</a>
							<!--상담상태 버튼 Wrap Start -->
							<?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>
							<!--상담상태 버튼 Wrap End -->
                            <!-- 20250717 eun 상담사 리스트 카테고리 있을 때 상담사 가격과 시간, 상태 버튼 작업 마감-->
						</div>
					</ul>
    	        </div>
        	    <details class="counselor_list_info">
					<summary>
						  <a href="<?php echo $list[$i]['href'] ?>">
						  <ul class="left">
							  <span class="tag">#<?php echo $list[$i]['wr_9'] ?></span>
							  <span class="tag">#<?php echo $list[$i]['wr_10'] ?></span>
							  <!--
							  <span class="tag">#신묘한해석</span>
							  <span class="tag">#재회운전문</span>
							  -->
						  </ul>
						  </a>

						  <a href="<?php echo $list[$i]['href'] ?>">
						  <ul class="right">
							  <li class="right_item">최근 후기<span> (<?=get_counselor_afcnt($list[$i]["mb_id"])?>)</span></li>
							  <li class="right_item gray">|</li>
							  <li class="right_item">문의<span> (<?=get_counselor_qa_new($list[$i]["mb_id"])?>)</span></li>
							  <!--<li class="right_item"><img src="../../../img/common/select_02.png"></li>-->
						  </ul>
						  </a>
					</summary>
    	        </details>
