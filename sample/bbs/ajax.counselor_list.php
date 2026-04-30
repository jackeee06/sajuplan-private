  

<?
include_once('./_common.php');
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
include_once('./list.php');
// exit;
ob_start();
?>
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
  -->

<?php include_once(G5_PATH.'/include/counsel_navi.php'); ?>
    
<div class="list_sort_wrap">
  <div class="list_sort">
      <!--<img src="../../../img/common/icon_sort.png">-->
      <select name="s_desc" id="s_desc" onchange="search_enable_idle()">
      <option value="" <?php if($s_desc==""){echo "selected";}?>>기본</option>
          <option value="wr_datetime" <?php if($s_desc=="wr_datetime"){echo "selected";}?>>최신순</option>
            <option value="aft" <?php if($s_desc=="aft"){echo "selected";}?>>후기많은 순</option>
            <option value="fat" <?php if($s_desc=="fat"){echo "selected";}?>>단골많은 순</option>
            <option value="amt" <?php if($s_desc=="amt"){echo "selected";}?>>가격 낮은순</option>
            <option value="damt" <?php if($s_desc=="damt"){echo "selected";}?>>가격 높은순</option>
        </select>
    </div>
    
    <div class="list_sort">
      <select name="s_wr_5" id="s_wr_5" onchange="search_enable_idle()">
          <option value="">전체분야</option>
      <?foreach($s_wr_5_array as $key=>$value){?>
        <option value="<?=$value?>" <?if($s_wr_5==$value){echo "selected";}?>><?=$value?></option>
            <?}?>
        </select>
    </div>
    
    <div class="list_sort">
      <select name="s_wr_6" id="s_wr_6" onchange="search_enable_idle()">
          <option value="">전체스타일</option>
            <option value="경청하는" <?if($s_wr_6=="경청하는"){echo "selected";}?>>경청하는</option>
            <option value="소통하는" <?if($s_wr_6=="소통하는"){echo "selected";}?>>소통하는</option>
            <option value="깊이있는" <?if($s_wr_6=="깊이있는"){echo "selected";}?>>깊이있는</option>
            <option value="공감하는" <?if($s_wr_6=="공감하는"){echo "selected";}?>>공감하는</option>
            <option value="긍정적인" <?if($s_wr_6=="긍정적인"){echo "selected";}?>>긍정적인</option>
            <option value="현실조언" <?if($s_wr_6=="현실조언"){echo "selected";}?>>현실조언</option>
            <option value="카리스마" <?if($s_wr_6=="카리스마"){echo "selected";}?>>카리스마</option>
            <option value="솔직담백" <?if($s_wr_6=="솔직담백"){echo "selected";}?>>솔직담백</option>
            <option value="부드러운" <?if($s_wr_6=="부드러운"){echo "selected";}?>>부드러운</option>
            <option value="친근한" <?if($s_wr_6=="친근한"){echo "selected";}?>>친근한</option>
            <option value="차분한" <?if($s_wr_6=="차분한"){echo "selected";}?>>차분한</option>
            <option value="편안한" <?if($s_wr_6=="편안한"){echo "selected";}?>>편안한</option>
            <option value="조곤조곤" <?if($s_wr_6=="조곤조곤"){echo "selected";}?>>조곤조곤</option>
            <option value="또박또박" <?if($s_wr_6=="또박또박"){echo "selected";}?>>또박또박</option>
        </select>
    </div>
    
    <div class="list_sort">
      <select name="s_mb_10" id="s_mb_10" onchange="search_enable_idle();">
            <!--    20250715 eun 성별 값 '여' '남' 작업 시작 (db에 여, 남이라고 저장되어있음)-->
          <option>성별</option>
            <option value="여" <?if($s_mb_10=="여"){echo "selected";}?>>여성</option>
            <option value="남" <?if($s_mb_10=="남"){echo "selected";}?>>남성</option>
            <!--    20250715 eun 성별 값 '여' '남' 작업 마감-->

        </select>
    </div>
</div>

<div class="list_filter_wrap">
  <div class="list_title"><span class="point"><?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?></span>님을 위한 추천</div>
  <div class="list_filter">
      <input type="checkbox" id="ing_counsel" <?php if($state=="IDLE"){?>checked="checked"<?}?> onclick="search_enable_idle();">
        <label for="ing_counsel">상담가능만 보기</label>
    </div>
</div>    


<?
//$qstr1 =  str_replace ( '&amp;', '&', $qstr );
?>

<script>
function search_enable_idle(){
  var qstr = "<?=$qstr?>";
  var sca = '<?=$sca?>';
  var s_desc = $("#s_desc").val();
  var s_wr_5 = $("#s_wr_5").val();
  var s_wr_6 = $("#s_wr_6").val();

  var s_mb_10 = $("#s_mb_10").val();

  if($('#ing_counsel').is(':checked')==true){
    location.href='?bo_table=counselor&state=IDLE<?=$qstr?>&s_desc='+s_desc+"&s_wr_5="+s_wr_5+"&s_wr_6="+s_wr_6+'&s_mb_10='+s_mb_10+'&sca='+sca;
  }else{
    location.href='?bo_table=counselor&s_desc='+s_desc+'&s_wr_5='+s_wr_5+'&s_wr_6='+s_wr_6+'&s_mb_10='+s_mb_10+'<?=$qstr?>'+'&sca='+sca;
  }
}
</script>

<div id="bo_list_total" style=" display:none;">
    <!--<span>전체 <?php echo number_format($total_count) ?>건</span>
    <?php echo $page ?> 페이지
    -->
</div>

    <div class="list_01">
        <?php if ($is_checkbox) { ?>
        <div class="all_chk chk_box">
            <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
            <label for="chkall">
              <span></span>
              <b class="sound_only">현재 페이지 게시물 </b> 전체선택
            </label>
            
            <?php if ($rss_href || $write_href) { ?>
        <ul class="<?php echo isset($view) ? 'view_is_list btn_top' : 'btn_top top btn_bo_user';?>">
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
                                <!--
                      <li><button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value"><i class="fa fa-files-o" aria-hidden="true"></i> 선택복사</button></li>
                      <li><button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value"><i class="fa fa-arrows" aria-hidden="true"></i> 선택이동</button></li>
                                -->
                  </ul>
                  <?php } ?>
            </li>
            <?php } ?>
        </ul>
      <?php } ?>
        </div>
        <?php } ?>
<!--20250714 eun 부재중 맨 뒤로 정렬 시작-->
        <?
        if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
            //var_dump($board);
            //echo "리스트";
        }

        ?>
        <ul>
            <?php for ($i=0; $i<count($list); $i++) { 
      
      $cinfo = get_member($list[$i]["mb_id"]);
            // echo $cinfo;
      ?>
            
            <div class="counselor_list" id="list_area">
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
          </div>
            <!--20250801 eun 리스트 ajax 추가 시작-->
            <!--    <script>
                    // 15초마다 polling
                    setInterval(function() {
                        console.log("상담사 목록 갱신 중...");

                        $.post('/sub/counselor_list_ajax.php', {
                            'act': 'every'
                        }, function (data) {
                            if (data.trim()) {
                                $("#list_area").html(data);
                            }
                        });
                    }, 5000); // 15초=15000ms

                </script>-->
                <!--20250801 eun 리스트 ajax 추가 마감-->

            <!--  리스트 원본  -->
            <li class="<?php if ($list[$i]['is_notice']) echo "bo_notice"; ?>" style="display:none;">
                
                <div class="gall_img" style="<?php if ($board['bo_gallery_height'] > 0) echo 'height:'.$board['bo_gallery_height'].'px;max-height:'.$board['bo_gallery_height'].'px'; ?>">
                        <a href="<?php echo $list[$i]['href'] ?>">
                        <?php
                        if ($list[$i]['is_notice']) { // 공지사항  ?>
                            <span class="is_notice" style="<?php echo $line_height_style; ?>">공지</span>
                        <?php } else {
                            $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);

                            if($thumb['src']) {
                                $img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" >';
                            } else {
                                $img_content = '<span class="no_image" style="'.$line_height_style.'">no image</span>';
                            }

                            echo run_replace('thumb_image_tag', $img_content, $thumb);
                        }
                        ?>
                        </a>
                    </div>

                <div class="bo_cnt">
                  <?php if ($list[$i]['is_notice'] || ($is_category && $list[$i]['ca_name'])) { ?>
                  <div class="bo_cate_ico">
                    <?php if ($list[$i]['is_notice']) { ?><strong class="notice_icon">공지</strong><?php } ?>
                      <?php if ($is_category && $list[$i]['ca_name']) { ?>       
                      <a href="<?php echo $list[$i]['ca_name_href'] ?>" class="bo_cate_link"><?php echo $list[$i]['ca_name']; ?></a>
                      <?php } ?>
                    </div>
                    <?php } ?> 
                    
                    <a href="<?php echo $list[$i]['href'] ?>" class="bo_subject">
                        <?php echo $list[$i]['icon_reply']; ?>
                        <?php if (isset($list[$i]['icon_secret'])) echo $list[$i]['icon_secret']; ?>
                        <?php echo $list[$i]['subject'] ?>
                        <?php
                        // if ($list[$i]['file']['count']) { echo '<'.$list[$i]['file']['count'].'>'; }
                        if ($list[$i]['icon_new']) echo "<span class=\"new_icon\">N<span class=\"sound_only\">새글</span></span>";
                        //if (isset($list[$i]['icon_hot'])) echo $list[$i]['icon_hot'];
                        //if (isset($list[$i]['icon_file'])) echo $list[$i]['icon_file'];
                        //if (isset($list[$i]['icon_link'])) echo $list[$i]['icon_link'];
                        ?>
                        
                        <?php if ($list[$i]['comment_cnt']) { ?>
                        <span class="bo_cmt">
              <span class="sound_only">댓글</span>
              <?php echo $list[$i]['comment_cnt']; ?>
              <span class="sound_only">개</span>
                        </span>
                        <?php } ?>
                    </a>
                </div>
        <div class="bo_info">
                    <!--<span class="sound_only">작성자</span><?php echo $list[$i]['name'] ?>-->
                    <span class="bo_date"><i class="fa fa-clock-o" aria-hidden="true"></i> <?php echo $list[$i]['datetime'] ?></span>
                    <!--
                  <span class="bo_view"><i class="fa fa-eye" aria-hidden="true"></i> <?php echo number_format($list[$i]['wr_hit']) ?><span class="sound_only">회</span></span>
                  <?php if ($is_good) { ?><span class="sound_only">추천</span><i class="fa fa-thumbs-o-up" aria-hidden="true"></i> <?php echo $list[$i]['wr_good'] ?><?php } ?>
                    <?php if ($is_nogood) { ?><span class="sound_only">비추천</span><i class="fa fa-thumbs-o-down" aria-hidden="true"></i> <?php echo $list[$i]['wr_nogood'] ?><?php } ?>
                    -->
                </div>
                
                <?php if ($is_checkbox) { ?>
                <div class="bo_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                    <label for="chk_wr_id_<?php echo $i ?>">
                      <span></span>
                      <b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                    </label>   	
                </div>
                <?php } ?>
                        
            </li>
            <?php } ?>
            <?php if (count($list) == 0) { echo '<li class="empty_table">등록된 상담사가 없습니다.</li>'; } ?>
        </ul>
    </div>
</div>

</form>

<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>

<?
$html = ob_get_clean();
echo json_encode(['html'=>$html]);
?>