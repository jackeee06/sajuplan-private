<?
include_once('./_common.php');
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
// exit;
// 추천 멤버 추출
$sql_common = " from {$g5['member_table']} where mb_sort>=1 and mb_sort <= 20  and state != 'ABSE' ";
$sql_order = " order by IF(state IN ('IDLE', 'CONN', 'RDCH', 'RDVC','CNCH', 'ABSE'), 0, 1), FIELD (state, 'IDLE', 'CONN', 'RDCH', 'RDVC','CNCH', 'ABSE',''), mb_sort asc ";

$sql = " select count(*) as cnt $sql_common ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1;
$from_record = ($page - 1) * $rows;

$list = array();

$sql = " select * $sql_common $sql_order limit $from_record, $rows ";
$result = sql_query($sql);

for ($i=0; $row=sql_fetch_array($result); $i++) {
    $list[$i] = $row;  // 멤버 정보

    // 상담사 대표글(최신글) 추출
    $sql2 = "select * from g5_write_counselor where mb_id = '{$row['mb_id']}' order by wr_datetime desc limit 1";
    $row2 = sql_fetch($sql2);
    if ($row2) {
        $list[$i]['wr_id'] = $row2['wr_id'];
        $list[$i]['ca_name'] = $row2['ca_name'];
        $list[$i]['wr_subject'] = $row2['wr_subject'];
        $list[$i]['wr_8'] = $row2['wr_8'];
        $list[$i]['wr_9'] = $row2['wr_9'];
        $list[$i]['wr_10'] = $row2['wr_10'];
        $list[$i]['subject'] = get_text(cut_str($row2['wr_subject'], 100));
    } else {
        $list[$i]['wr_id'] = '';
        $list[$i]['ca_name'] = '';
        $list[$i]['wr_subject'] = '[글 없음]';
        $list[$i]['wr_8'] = '';
        $list[$i]['wr_9'] = '';
        $list[$i]['wr_10'] = '';
        $list[$i]['subject'] = '[글 없음]';
    }

    // 후기/문의 개수
    $list[$i]['review_count'] = get_counselor_afcnt($row['mb_id']);
    $list[$i]['qa_count'] = get_counselor_qa_new($row['mb_id']);

    // 링크 등
    $list[$i]['opener_href'] = get_pretty_url('counselor');
    $list[$i]['opener_href_wr_id'] = get_pretty_url('counselor', $list[$i]['wr_id']);
}
ob_start();
?>
    <ul id="" class="">
        <?php for ($i=0; $i<count($list); $i++) { 
		$cinfo = get_member($list[$i]["mb_id"]);
				
		?>
        
        <div class="counselor_list_wrap">
        	<div class="counselor_list">
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
											<?php include(G5_PATH.'/include/counselor_num_list.php'); ?>
										</div>
										<div class="counselor_con_text line2_text"><?php echo $list[$i]['wr_8'] ?></div>
									</div>
									<div class="counselor_con_price">
										<!-- <img src="../../../img/common/icon_price.png" alt="금액 아이콘"> -->
										<?=number_format($list[$i]["mb_4"])?>원
										<span class="unit"><?=$list[$i]["mb_5"]?>초당</span>
									</div>
								</li>
							</a>
							<!--상담상태 버튼 Wrap Start -->
							
							<!--상담상태 버튼 Wrap End -->
						</div>
                  	</ul>
                    
    	          </div>

                  <?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>

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
                                <li class="right_item" style="margin-right:5px;">
                                <i class="fa fa-star list_bottom_ic"></i>
                                <span class="list_bottom_font"><?=get_dangol_cnt($list[$i]["wr_id"])?>
                                <li class="right_item">
                                <i class="fa fa-comment list_bottom_ic"></i>
                                <span class="list_bottom_font"><?=get_counselor_afcnt($list[$i]["mb_id"])?></span></li>
                                <!-- <li class="right_item gray">|</li> -->
                                <!-- 
                                <li class="right_item">문의<span> (<?=get_counselor_qa_new($list[$i]["mb_id"])?>)
                                <li class="right_item gray">|</li> 
                                -->
                               </span></li>
                                
                            </ul>
                      </a>
                      <!-- <a href="<?php echo $list[$i]['href'] ?>">
                  	  <ul class="right">
           	  		      <li class="right_item">최근 후기<span> (<?=get_counselor_afcnt($list[$i]["mb_id"])?>)</span></li>
                          <li class="right_item gray">|</li>
	                      <li class="right_item">문의<span> (<?=get_counselor_qa_new($list[$i]["mb_id"])?>)</span></li>
                          <li class="right_item gray">|</li>
                          <li class="right_item">단골<span>(<?=get_dangol_cnt($list[$i]['wr_id'])?>)</span></li>
            	      </ul>
                      </a> -->
                  </summary>
                  
                  <div class="counselor_review">
                    <?
					  //// 상담 후기 리스트 가져오기 ///

					$rsql = "select * from g5_write_review where wr_1='".$list[$i]["mb_id"]."' order by wr_datetime desc limit 0,3";
					//echo $rsql;

					$rst = sql_query($rsql);
					if($rst){
						while($res=sql_fetch_array($rst)){
							$minfo = get_member($res["mb_id"]);
						?>
                        <ul class="counselor_review_item">
                            <li class="counselor_review_con"><?=$res['wr_subject']?></li>
                            <li class="counselor_review_name point"><?=$minfo["mb_name"]?></li>ㄱ
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
        <?php if ($i == 0) echo "<li class=\"empty_list\">사주문 추천 상담사가 없습니다.</li>"; ?>
    </ul>


  <?php echo get_paging($config['cf_mobile_pages'], $page, $total_page, "?$qstr&amp;page="); ?>
    
<?
$html = ob_get_clean();
echo json_encode(['html'=>$html]);
?>