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
    //$img_content = '<img src="'.$img.'" alt="'.$thumb['alt'].'" >';
	//$img_content = ''.$img.'';
	$img_content = '<li class="counselor_img" style=" background-image:url('.$thumb['src'].');"></li>';
    $wr_href = get_pretty_url($bo_table, $list[$i]['wr_id']);
    ?>
    	<div class="counselor_list">
        	    <div class="counselor_list_item">
                	<a href="<?php echo $wr_href; ?>">
            		<ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$i]['ca_name']]?>">
                    
                    	<span class="list_scrap">
                        	<img src="../../../img/common/list_icon_scrap.png">
                            
                        </span>
                        
                        <span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?php echo $list[$i]['ca_name']; ?></span>

                                          

                        <?php echo run_replace('thumb_image_tag', $img_content, $thumb); ?>
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
                
                    	<a href="<?php echo $list[$i]['href'] ?>">
               	    	<li class="counselor_con_title">
							<?php echo $list[$i]['subject'] ?>
                            <!-- 상담사 고유번호 -->
                    		<?php //include(G5_PATH.'/include/counselor_num.php'); ?>
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
        	</div>
  
            
        </li>
    <?php }  ?>
    <?php if ($list_count == 0) { //게시물이 없을 때  ?>
    <li class="empty_li">등록된 상담사가 없습니다.</li>
    <?php }  ?>
    </ul>
    
    <!--
    <a href="<?php echo get_pretty_url($bo_table); ?>" class="lt_more"><span class="sound_only"><?php echo $bo_subject ?></span>더보기</a>
    -->

</div>
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