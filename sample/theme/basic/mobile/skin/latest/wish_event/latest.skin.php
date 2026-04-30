<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

add_javascript('<script src="'.G5_JS_URL.'/owlcarousel/owl.carousel.min.js"></script>', 10);
add_stylesheet('<link rel="stylesheet" href="'.G5_JS_URL.'/owlcarousel/owl.carousel.min.css">', 10);

add_javascript('<script src="'.G5_JS_URL.'/tooltipster/tooltipster.bundle.min.js"></script>', 11);
add_stylesheet('<link rel="stylesheet" href="'.G5_JS_URL.'/tooltipster/tooltipster.bundle.min.css">', 11);
add_javascript('<script src="'.$latest_skin_url.'/latest.carousel.js?v2"></script>', 12);

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$latest_skin_url.'/style.css?v2">', 1);
$thumb_width = 138;
$thumb_height = 80;
$list_count = (is_array($list) && $list) ? count($list) : 0;
$divisor_count = 4;
$start_page_num = $list_count ? '1' : '0';
$is_show_next_prev = ($list_count > 4) ? 1 : 0;
?>

<div class="lt owl-carousel-wrap">
    <div id="bo_gall">
        	<ul id="gall_ul">
            
            <h3 style="font-size:18px; margin-bottom:10px; font-weight:800; padding:20px 20px 0; "><?php echo $bo_subject; ?></h3>
            
            <?php
            for ($i=0; $i<$list_count; $i++) {
            $thumb = get_list_thumbnail($bo_table, $list[$i]['wr_id'], $thumb_width, $thumb_height, false, true);
            $img = $thumb['src'] ? $thumb['src'] : '';
            $img_content = $img ? '<img src="'.$img.'" alt="'.$thumb['alt'].'" >' : '';
            $wr_href = get_pretty_url($bo_table, $list[$i]['wr_id']);

            $echo_ul = ( $i && (($i % $divisor_count) === 0) ) ? '</ul><ul class="item">'.PHP_EOL : '';

            echo $echo_ul;
            ?>

            <li class="gall_li ">
            <div class="gall_li_wr">

				

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
                                
                                <!--· 
                                <span class="black">
                                	<?php echo $list[$i]['ca_name'] ?>
                                </span>
                                -->
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
        
        
            
            <li style="display:none;">
                <?php
                //echo $list[$i]['icon_reply']." ";
                
                if( $img_content ){
                    echo "<a href=\"".$wr_href."\" class=\"lt_thumb\">".run_replace('thumb_image_tag', $img_content, $thumb)."</a> ";
                }
                
                echo "<a href=\"".$wr_href."\" class=\"lt_tit\">";
                if ($list[$i]['icon_secret']) echo "<i class=\"fa fa-lock\" aria-hidden=\"true\"></i> ";
                if ($list[$i]['is_notice'])
                    echo "<strong>".$list[$i]['subject']."</strong>";
                else
                    echo $list[$i]['subject'];

                    // if ($list[$i]['link']['count']) { echo "[{$list[$i]['link']['count']}]"; }
                    // if ($list[$i]['file']['count']) { echo "<{$list[$i]['file']['count']}>"; }

                if ($list[$i]['icon_new']) echo " <span class=\"new_icon\">N</span>";
                if ($list[$i]['icon_file']) echo " <i class=\"fa fa-download\" aria-hidden=\"true\"></i>" ;
                if ($list[$i]['icon_link']) echo " <i class=\"fa fa-link\" aria-hidden=\"true\"></i>" ;
                if ($list[$i]['icon_hot']) echo " <i class=\"fa fa-heart\" aria-hidden=\"true\"></i>";
                
                if ($list[$i]['comment_cnt'])  echo "
                <span class=\"lt_cmt\"><span class=\"sound_only\">댓글</span>".$list[$i]['comment_cnt']."</span>";
                echo "</a>";
                ?>
               
                <div class="lt_info">
                    <?php echo $list[$i]['name'] ?>
                    <span class="lt_date">
                        <?php echo $list[$i]['datetime'] ?>
                    </span>
                </div>
            </li>
            <?php }     //end for ?>
            <?php if ($list_count == 0) { //게시물이 없을 때 ?>
            <li class="empty_li">진행중인 이벤트가 없습니다.</li>
            <?php }     //end if ?>
            </ul>
    </div>
    <?php if ($is_show_next_prev){  // $divisor_count 이상의 값이 있을경우에만 출력 ?>
	<div class="lt_page">
		<button class="lt_page_prev"><span class="sound_only">이전페이지</span><i class="fa fa-caret-left" aria-hidden="true"></i></button>
		<span class="page_print"><b><?php echo $start_page_num; ?></b>/<?php echo $start_page_num; ?></span>
		<button class="lt_page_next"><span class="sound_only">다음페이지</span><i class="fa fa-caret-right" aria-hidden="true"></i></button>
	</div>
    <?php } ?>
</div>