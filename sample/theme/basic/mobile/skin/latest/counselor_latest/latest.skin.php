<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$latest_skin_url.'/style.css?v=2">', 0);
$thumb_width = 210;
$thumb_height = 150;
$list_count = (is_array($list) && $list) ? count($list) : 0;



// 카테고리별 배경이미지 Class
$cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');
?>

<div class="pic_lt">
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
                <!--                20250728 eun 메인 상담사 수정 시작-->
                <!--        		<div class="counselor_list_item">	-->
                <div class="counselor_list_item" data-mb_id="<?=$list[$i]['mb_id']?>" data-state="<?=$list[$i]['state']?>">
                    <!--                20250728 eun 메인 상담사 수정 마감-->
                    <ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$i]['ca_name']]?>">
						<span class="list_scrap" onclick="scrap_submit('<?=$list[$i]["wr_id"]?>')" style="cursor:pointer;">
							<?
                            $sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $list[$i]["wr_id"]);
                            $scrap_img = "/img/common/list_icon_scrap.png";
                            if($sflag==true){
                                $scrap_img = "/img/common/list_icon_scrap_on.png";
                            }
                            ?>
                        	<img src="<?=$scrap_img?>" id="scrap_icon_<?=$list[$i]["wr_id"]?>" alt="스크랩 아이콘" >
                        </span>

                        <a href="<?php echo $wr_href; ?>">
                            
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


                                    <!-- 
                                    <li class="right_item" style="margin-right:5px;">
                                    <i class="fa fa-star list_bottom_ic"></i>
                                    <span class="list_bottom_font"><?=get_dangol_cnt($list[$i]["wr_id"])?> 
                                    -->

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
                                               <?php include(G5_PATH.'/include/counselor_num_list.php'); ?>

                                                <i class="fa fa-star list_bottom_ic"></i>
                                                <span class="list_bottom_font"><?=get_dangol_cnt($list[$i]["wr_id"])?></span>

                                                <i class="fa fa-comment list_bottom_ic"></i>
                                                <span class="list_bottom_font"><?=get_counselor_afcnt($list[$i]["mb_id"])?></span>

                                        </div>
                                        


                                        

                                    
                                        <div class="counselor_con_text line2_text"><?php echo $list[$i]['wr_8'] ?></div>
                                    </div>
                                    <div class="counselor_con_price">
                                        <!-- <img src="../../../img/common/icon_price.png" alt="금액 아이콘"> -->
                                        <?=number_format($list[$i]["mb_4"])?>원
                                        <span class="unit"><?=$list[$i]["mb_5"]?>초당</span>
                                    </div>

                                    <div style="margin-top:2px;">
                                        <details class="counselor_list_info">
                                            <summary style="display:flex; justify-content:space-between; align-items:center;">
                                                <span class="icon_cate <?=$cate_bg[$list[$i]['ca_name']]?>"><?php echo $list[$i]['ca_name']; ?></span>
                                                <a href="<?php echo $list[$i]['href'] ?>">
                                                    <ul class="left">
                                                        <span class="tag"><?php echo $list[$i]['wr_9'] ?></span>,
                                                        <span class="tag"><?php echo $list[$i]['wr_10'] ?></span>
                                                    </ul>
                                                </a>
                                            </summary>
                                        </details>
                                    </div>


                                </li>
                            </a>
                            <!--상담상태 버튼 Wrap Start -->
                            
                            <!--상담상태 버튼 Wrap End -->
                        </div>
                    </ul>
                </div>
                <!-- 수정 1 -->
                <!-- 밑으로 살짝 뺴주니까 됨 -->

                 
                <?php 
                include(G5_PATH.'/include/counselor_state_btn.php'); 
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
