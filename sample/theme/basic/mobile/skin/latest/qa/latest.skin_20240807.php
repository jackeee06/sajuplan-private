<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$latest_skin_url.'/style.css">', 0);
$thumb_width = 210;
$thumb_height = 150;
$list_count = (is_array($list) && $list) ? count($list) : 0;


// 카테고리별 배경이미지 Class
$cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');
?>

            <div class="review_sort" style="">
		    	<ul class="review_sort_item">
    		    	 <h2 class="bo_vc_tit">상담 후기 <span class="point">00</span>건</h2>
	    	    </ul>
    	    	<ul class="review_sort_photo">
	        		<input type="checkbox" id="ing_review">
		        	<label for="ing_review">사진후기만 보기</label>
	    	    </ul>
	    	</div>
	

<div class="pic_lt">
	<!--
    <h2 class="lat_title"><a href="<?php echo get_pretty_url($bo_table); ?>"><?php echo $bo_subject ?></a></h2>
    -->
    <ul>
    <?php
    for ($i=0; $i<$list_count; $i++) {

    
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

	/// 만약 상담사 정보있으면 상담사 프로필 가져오기
	if($mb["mb_id"]){
		$sql = "select * from g5_write_counselor where mb_id='".$mb["mb_id"]."'";
		$crow = sql_fetch($sql);	
	}


	$thumb = get_list_thumbnail('counselor', $crow['wr_id'], '48', '48', false, true);
    if($thumb['ori']) {
        $img = $thumb['ori'];
    } else {
		$img = '';
    }



    $wr_href = get_pretty_url($bo_table, $list[$i]['wr_id']);

	

    ?>
    
	<div class="review_wrap">	
    	<ul class="review_user counsel_info"> 
        	<?php if ($is_checkbox) { ?>
                <div class="bo_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                    <label for="chk_wr_id_<?php echo $i ?>">
                    	<span></span>
                    	<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                    </label>   	
                </div>
                <?php } ?>        
                    
                    <li class="review_user_img type_bg tarot">
                    	<p class="review_user_img_item" style=" background-image:url(<?=$img?>);"></p>
                    </li>
         
                    
                    <li class="review_user_score">
                    	<a href="../bbs/board.php?bo_table=counselor&wr_id=2">
                        <p class="review_user_id">
                       	  <span class="cate point"><?=$crow["ca_name"]?></span>
                            <?=$mb["mb_nick"]?>
                        </p>
                        </a>
                        
                        <!-- 신고/차단 -->
		                <?php include(G5_PATH.'/include/singo_wrap.php'); ?>
                        
                    </li>
                </ul>
                
              <!-- 작성자 정보 -->
           	  <ul class="review_user">
				  <li class="review_user_score">
                   	  <p class="review_user_id"><?php echo $list[$i]['name'] ?> <img src="../img/common/icon_mem_ok.png" /></p>
                  </li>
                    
                  <!-- 작성자 이메일, 평점 -->
                  <li class="review_user_score">
                      <span class="review_info">OO상담</span>
                      <span class="review_info">상담시간 00~00분</span>
                      <span class="review_info"><?php echo $list[$i]['datetime'] ?></span>
                  </li>
              </ul>
                
                                
              <!-- 후기 내용 -->
              <ul class="review_con">
                	<!-- 사진후기일 경우 Class : photo_review -->
               	  <a href="<?php echo $list[$i]['href'] ?>">
                  <li class="review_con_text">
                  		
                		<p class="review_text">
                        	<span class="review_title"><?php echo $list[$i]['subject'] ?></span>
	                        <span class="review_txt">	
                            	
	                            
                                <?php echo strip_tags($list[$i]['wr_content']) ?>
                                
                            </span>
                            <span class="review_topic">상담주제: <?php echo $list[$i]['wr_1'] ?></span>
                        </p>
                        <!-- 후기사진: Background-image처리 -->
						<?php //echo run_replace('thumb_image_tag', $img_content, $thumb); ?>                        
                       
                        <!-- 후기사진: Background-image처리 -->
							<?php 
								$thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);
								if($thumb['src']) {
								    $img_content = '<p class="review_photo"><img src="'.$thumb['ori'].'" alt="'.$thumb['alt'].'" ></p>';
								} else {
								    //$img_content = '<span class="no_image" style="'.$line_height_style.'">no image</span>';
									$img_content = '';
								}
								echo run_replace('thumb_image_tag', $img_content, $thumb);
							?>
                    </li>
                  	</a>
                </ul>
                
                
                <?
               $sql1 = " select * from g5_write_review where wr_parent = '".$list[$i]["wr_id"]."' and wr_is_comment = 1 order by wr_comment, wr_comment_reply ";
				
				//echo $sql1;
				//echo "<br>";
				
				$result1 = sql_query($sql1);
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
					<li class="review_re_name"><?=$wwmb["mb_nick"]?></li>
                    <li class="review_re_con">
                    <?=nl2br($row1['content'])?>
                    </li>
                </ul>
				</a>
				<?
					}
                ?>
                
			</div>    	
    	
        <!--    
        <li class="galley_li" style="display:none;">
            <a href="<?php echo $wr_href; ?>" class="lt_img"><?php echo run_replace('thumb_image_tag', $img_content, $thumb); ?></a>
            <?php
            if ($list[$i]['icon_secret']) echo "<i class=\"fa fa-lock\" aria-hidden=\"true\"></i><span class=\"sound_only\">비밀글</span> ";

            echo "<a href=\"".$wr_href."\"> ";
            if ($list[$i]['is_notice'])
                echo "<strong>".$list[$i]['subject']."</strong>";
            else
                echo $list[$i]['subject'];
            echo "</a>";
			
			if ($list[$i]['icon_new']) echo "<span class=\"new_icon\">N<span class=\"sound_only\">새글</span></span>";
            if ($list[$i]['icon_hot']) echo "<span class=\"hot_icon\">H<span class=\"sound_only\">인기글</span></span>";

            // if ($list[$i]['link']['count']) { echo "[{$list[$i]['link']['count']}]"; }
            // if ($list[$i]['file']['count']) { echo "<{$list[$i]['file']['count']}>"; }

			// echo $list[$i]['icon_reply']." ";
			// if ($list[$i]['icon_file']) echo " <i class=\"fa fa-download\" aria-hidden=\"true\"></i>" ;
            // if ($list[$i]['icon_link']) echo " <i class=\"fa fa-link\" aria-hidden=\"true\"></i>" ;

            if ($list[$i]['comment_cnt'])  echo "
            <span class=\"lt_cmt\">".$list[$i]['wr_comment']."</span>";

            ?>
			<!--
            <div class="lt_info">
				<span class="lt_nick"><?php echo $list[$i]['name'] ?></span>
            	<span class="lt_date"><?php echo $list[$i]['datetime2'] ?></span>              
            </div>
           
            
        </li>
         -->
    <?php }  ?>
    <?php if ($list_count == 0) { //게시물이 없을 때  ?>
    <li class="empty_li">게시물이 없습니다.</li>
    <?php }  ?>
    </ul>
    
    <!--
    <a href="<?php echo get_pretty_url($bo_table); ?>" class="lt_more"><span class="sound_only"><?php echo $bo_subject ?></span>더보기</a>
    -->

</div>
