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

<div class="pic_lt">
	<!--
    <h2 class="lat_title"><a href="<?php echo get_pretty_url($bo_table); ?>"><?php echo $bo_subject ?></a></h2>
    -->
    <ul>
    <?php
    for ($i=0; $i<$list_count; $i++) {


    $thumb = get_list_thumbnail($bo_table, $list[$i]['wr_id'], $thumb_width, $thumb_height, false, true);

    if($thumb['src']) {
        $img = $thumb['src'];
    } else {
        $img = G5_IMG_URL.'/no_img.png';
        $thumb['alt'] = '이미지가 없습니다.';
    }
	$img_content = '<li class="counselor_img" style=" background-image:url('.$thumb['src'].');"></li>';
    $wr_href = get_pretty_url($bo_table, $list[$i]['wr_id']);
    ?>
    	<div class="counselor_list">
        	    <div class="counselor_list_item">
                	
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

						<a href="<?php echo $wr_href; ?>">
                        <span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?php echo $list[$i]['ca_name']; ?></span>
                        <?php echo run_replace('thumb_image_tag', $img_content, $thumb); ?>
						 </a>
                    </ul>
                   
                    
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
                
                    	<a href="<?php echo $list[$i]['href'] ?>">
               	    	<li class="counselor_con_title">
							<?php echo $list[$i]['subject'] ?>
                            <!-- 상담사 고유번호 -->
                    		<?php include(G5_PATH.'/include/counselor_num_list.php'); ?>

                        </li>
                        <li class="counselor_con_text"><?php echo $list[$i]['wr_8'] ?></li>
                      	<li class="counselor_con_price">
                   	      	<img src="../../../img/common/icon_price.png">
                      	  	<?=number_format($list[$i]["mb_4"])?>원
                            <span class="unit">(<?=$list[$i]["mb_5"]?>초당)</span>
                      	</li>
                        </a>

                      	<!--상담상태 버튼 Wrap Start -->
    					<?php include(G5_PATH.'/include/counselor_state_btn.php'); ?>
						<!--상담상태 버튼 Wrap End -->
                  	</ul>
    	          </div>
                
        	      <details class="counselor_list_info">
              	  <summary>
	           		  <ul class="left">
                      	  <span class="tag">#<?php echo $list[$i]['wr_9'] ?></span>
                      	  <span class="tag">#<?php echo $list[$i]['wr_10'] ?></span>
        	              <!--
                          <span class="tag">#신묘한해석</span>
            	          <span class="tag">#재회운전문</span>
                          -->
    	              </ul>
                    
                  	  <ul class="right">
           	  		      <li class="right_item">최근 3개월(<?=get_counselor_counter($list[$i]["mb_id"])?>)</li>
                          <li class="right_item gray">|</li>
	                      <li class="right_item">후기<span><img src="../../../img/common/icon_review.png">(<?=get_counselor_afcnt($list[$i]["mb_id"])?>)</span></li>
    	                  <!--<li class="right_item"><img src="../../../img/common/icon_star.png">0.0<span>(00)</span></li>-->
        	              <li class="right_item"><img src="../../../img/common/select_02.png"></li>                     
            	      </ul>
                  </summary>
                  
                  <div class="counselor_review">

					<?
					///// 상담 후기 리스트 가져오기 ///

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


                      <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$list[$i]["wr_id"]?>"><ul class="counselor_review_more">더보기 <i class="xi-angle-down"></i></ul></a>
                  </div>
    	          </details>
                
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
            -->
            
        </li>
    <?php }  ?>
    <?php if ($list_count == 0) { //게시물이 없을 때  ?>
    <li class="empty_li">등록된 상담사가 없습니다.</li>
    <?php }  ?>
    </ul>
    
    <!--
    <a href="<?php echo get_pretty_url($bo_table); ?>" class="lt_more"><span class="sound_only"><?php echo $bo_subject ?></span>더보기</a>
    -->

<script type="text/javascript">
function scrap_submit(wr_id) {
//var param = $("form[name=f_scrap_popin]").serialize();
$.ajax({
    url: g5_bbs_url+"/scrap_popin_update.php",
    type: "POST",
    data: {bo_table:'counselor', wr_id:wr_id},
    success:function(data){
        //alert("성공");
        console.log(data);
        var a_comment = /<noscript>(([\s\S]+?[\s\S]))<\/p>/.exec(data);
            if (a_comment != null)
            {
                var content = String(a_comment[1].trim());
                content = content.substring(3,content.length);
                alert(content);

				$('#scrap_icon_'+wr_id).attr("src","/img/common/list_icon_scrap_on.png");
            }
    },
    error:function(data){
        alert("error");
    }
});
}
</script>
<!--팝업창없이 바로 스크랩하기 : END -->


</div>
