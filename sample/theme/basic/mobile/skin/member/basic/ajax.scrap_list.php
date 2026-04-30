    <?ob_start();?>
    <ul id="" class="">
        <?php for ($i=0; $i<count($list); $i++) { 
        
		$cinfo = get_member($list[$i]["mb_id"]);
        
        
		?>
        
        <div class="counselor_list_wrap">
        	<div class="counselor_list">
            	<a href="<?php echo $list[$i]['del_href'];  ?>" onclick="del(this.href); return false;" class="scrap_del"><i class="xi-close"></i><span class="sound_only">삭제</span></a>
                
                
        	    <div class="counselor_list_item">
                	
                    <!--<ul class="counselor_img_wrap">-->
                    <ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$i]['ca_name']]?>">
                    	<a href="<?php echo $list[$i]['opener_href_wr_id'] ?>" onclick="opener.document.location.href='<?php echo $list[$i]['opener_href_wr_id'] ?>'; return false;">
                    	
						<?
						$thumb = get_list_thumbnail('counselor', $list[$i]['wr_id'], '170', '116', false, true);
						$bimg = "";
                		            if($thumb['src']) {
										$bimg = $thumb['src'];
		                            } else {
										$bimg = '../img/common/noimage.png';
                		            }

						?>
						<li class="counselor_img" style=" background-image:url(<?=$bimg?>);"></li>


                    	<span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?=$list[$i]['ca_name']?></span>


		
							<span class="list_scrap" onclick="scrap_submit('<?=$list[$i]["wr_id"]?>')" style="cursor:pointer;">				
							<?
							$sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $list[$i]["wr_id"]);
							$scrap_img = "../../../img/common/list_icon_scrap.png";
							if($sflag==true){
								$scrap_img = "../../../img/common/list_icon_scrap_on.png";
							}
							?>
                        	<img src="<?=$scrap_img?>" id="scrap_icon_<?=$list[$i]["wr_id"]?>">					
                        </span>


                        </a>
                    </ul>
                    
                    <ul class="counselor_con_wrap">
						<div class="counselor_con_right">
							<a href="<?php echo $list[$i]['opener_href_wr_id'] ?>" onclick="opener.document.location.href='<?php echo $list[$i]['opener_href_wr_id'] ?>'; return false;">
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
										<?=number_format($cinfo["mb_4"])?>원
										<span class="unit"><?=$cinfo["mb_5"]?>초당</span>
									</div>
								</li>
							</a>
							<!--상담상태 버튼 Wrap Start -->
							<?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>
							<!--상담상태 버튼 Wrap End -->
						</div>
                  	</ul>
                    
    	          </div>
                  
                
        	      <details class="counselor_list_info">
              	  <summary>
                   	  <a href="<?php echo $list[$i]['href'] ?>">
	           		  <ul class="left">
                      	  <span class="tag">#<?php echo $list[$i]['wr_9'] ?></span>
                      	  <span class="tag">#<?php echo $list[$i]['wr_10'] ?></span>
    	              </ul>
                      </a>
                    	
                      <a href="<?php echo $list[$i]['href'] ?>">
                  	  <ul class="right">
           	  		      <li class="right_item">최근 후기<span> (<?=get_counselor_afcnt($list[$i]["mb_id"])?>)</span></li>
                          <li class="right_item gray">|</li>
	                      <li class="right_item">문의<span> (<?=get_counselor_qa_new($list[$i]["mb_id"])?>)</span></li>
            	      </ul>
                      </a>
                  </summary>
                  
                  <div class="counselor_review">
                    <?php
					//// 상담 후기 리스트 가져오기 ///
					$rsql = "select * from g5_write_review where wr_1='".$list[$i]["mb_id"]."' order by wr_datetime desc limit 0,3";

					$rst = sql_query($rsql);
					if($rst){
						while($res=sql_fetch_array($rst)){
							$minfo = get_member($res["mb_id"]);
						?>
                        <ul class="counselor_review_item">
                            <li class="counselor_review_con"><?=$res['wr_subject']?></li>
                            <li class="counselor_review_name point"><?=$minfo["mb_name"]?></li>
                        </ul>
					    <?
						
						}
					}
					?>					  
			
    	          </details>

				  <!--<a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$list[$i]["wr_id"]?>"><ul class="counselor_review_more">더보기 <i class="xi-angle-down"></i></ul></a>-->
                
        	</div>
        </div>
       
        
        

        
        <?php } ?>
        <?php if ($i == 0) echo "<li class=\"empty_list\">단골상담사가 없습니다.</li>"; ?>
    </ul>



    <?php echo get_paging($config['cf_mobile_pages'], $page, $total_page, "?$qstr&amp;page="); ?>

<?$html = ob_get_clean();
echo json_encode(['html' => $html]);
?>