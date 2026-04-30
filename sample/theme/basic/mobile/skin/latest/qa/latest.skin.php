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

$rct = sql_fetch("select count(*) as ct from g5_write_qa where wr_1='".$csr_id."' and wr_is_comment='0'");

?>

            <div class="review_sort" style="">
		    	<ul class="review_sort_item">
    		    	 <h2 class="bo_vc_tit">문의 <span class="point"><?=$rct["ct"]?></span>건</h2>
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
    
	<div class="review_wrap qa">	

           	  <ul class="review_user">
				  <li class="review_user_score">
                   	  <p class="review_user_id">
					      <?php echo $list[$i]['name'] ?>
                          <span class="date" style=" font-size:13px; color:#999; display:inline-block; margin-left:4px;"><?php echo $list[$i]['datetime'] ?></span>                          
                      </p>
                  </li>
                    
                  <!-- 신고/차단 -->
                		<?php include(G5_PATH.'/include/singo_wrap.php'); ?>
              </ul>
                
                                
              <!-- 후기 내용 -->
              <ul class="review_con">
               	  <a href="<?php echo $list[$i]['href'] ?>">
                  <li class="review_con_text">
                  		
                		<p class="review_text">
                        	<span class="review_title">
							<?if (isset($list[$i]['icon_secret'])) echo rtrim($list[$i]['icon_secret'])."&nbsp;";?>
								<?php 
								
						
									if(!$list[$i]['icon_secret']){
									echo $list[$i]['subject'];
									}else{
											if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
												echo $list[$i]['subject'];
											}else{
												echo "비밀글 입니다.";
											}									
									}
							
								?>
							</span>
	                        <span class="review_txt">	
                            	
	                            
                                 <?php 
								if(!$list[$i]['icon_secret']){
									echo strip_tags($list[$i]['wr_content']);
								}else{
									if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
								
										echo strip_tags($list[$i]['wr_content']);
									}else{
										echo "비밀글 입니다.";
									}
									

								}
								?>
                                
                            </span>
                        </p>
                    </li>
                  	</a>
                </ul>
                
                <ul class="review_user counsel review_re_state_wait "> 
					<li class="review_re_name"><?=$mb["mb_nick"]?><span class="review_re_state white">답변 대기</span></li>
				</ul>
                
                
                
                <?
               $sql1 = " select * from g5_write_qa where wr_parent = '".$list[$i]["wr_id"]."' and wr_is_comment = 1 order by wr_comment, wr_comment_reply ";
				
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
                
                <style>
				.review_re_state_wait { display:none;}
				</style>
                
				 <a href="<?php echo $list[$i]['href'] ?>">
				<ul class="review_user counsel"> 
					<li class="review_re_name"><?=$wwmb["mb_nick"]?><span class="re_date" style=""><?=substr($row1["wr_datetime"],0,10);?></span></li>
                    <li class="review_re_con">
                   <?
					if(!$list[$i]['icon_secret']){
									echo nl2br($row1['content']);
						}else{
								if($list[$i]['mb_id']==$member["mb_id"] || $is_admin || $list[$i]["wr_1"]==$member["mb_id"]){
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
                ?>
                
			</div>    	

    <?php }  ?>
    <?php if ($list_count == 0) { //게시물이 없을 때  ?>
    <li class="empty_li">게시물이 없습니다.</li>
    <?php }  ?>
    </ul>
    
    <!--
    <a href="<?php echo get_pretty_url($bo_table); ?>" class="lt_more"><span class="sound_only"><?php echo $bo_subject ?></span>더보기</a>
    -->

</div>
