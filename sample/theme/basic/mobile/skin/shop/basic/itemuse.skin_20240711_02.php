<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.G5_MSHOP_SKIN_URL.'/style.css">', 0);
?>

<script src="<?php echo G5_JS_URL; ?>/viewimageresize.js"></script>

<div class="con_section_03" >

	<div class="review_top" style="">
    	<ul class="review_top_img"><img src="../img/sample/review_top.png" style=""/></ul>
        <ul class="review_top_noti" style="">
        	<i class="xi-check point" style=""></i> 본인인증 완료 및 5분 이상 상담한 고객님에 한하여 후기 작성이 가능합니다.
        </ul>

        <ul class="review_write_btn">
        	<a href="<?php echo $itemuse_form; ?>" class="itemuse_form " onclick="return false;">후기 작성하기 <i class="xi-angle-right"></i></a>
        </ul>
        
        <ul class="review_write_noti">
        	후기 작성시, 코인 지급!
            <p class="review_guide">서비스후기 운영정책 <i class="xi-help-o"></i></p>
        </ul>
    </div>
    
    <div class="review_wrap_title">
    	서비스 후기 00건
        <a href="<?php echo $itemuse_list; ?>" id="itemuse_list" class="review_more">더보기 <i class="xi-angle-right"></i></a>
    </div>
        
    <div class="review_sort" style="">
    	<ul class="review_sort_item" style="">
        	<span class="review_sort_btn">베스트순</span>
        	<span class="review_sort_btn on">최신순</span>
        </ul>
        <ul class="review_sort_photo">
        	<input type="checkbox" id="ing_counsel" />
	        <label for="ing_counsel">사진후기만 보기</label>
        </ul>
    </div>

    
  	
</div>

<!--
<div id="sit_use_wbtn">
    <a href="<?php echo $itemuse_form; ?>" class="qa_wr itemuse_form " onclick="return false;">서비스후기 쓰기<span class="sound_only"> 새 창</span></a>
    <a href="<?php echo $itemuse_list; ?>" id="itemuse_list" class="btn01">더보기</a>
</div>
-->

<!-- 상품 사용후기 시작 { -->
<div id="sit_use_list">

    <?php
    $thumbnail_width = 500;

    for ($i=0; $row=sql_fetch_array($result); $i++)
    {
        $is_num     = $total_count - ($page - 1) * $rows - $i;
        $is_star    = get_star($row['is_score']);
        $is_name    = get_text($row['is_name']);
        $is_subject = conv_subject($row['is_subject'],50,"…");
        //$is_content = ($row['wr_content']);
        $is_content = get_view_thumbnail(conv_content($row['is_content'], 1), $thumbnail_width);
        $is_reply_name = !empty($row['is_reply_name']) ? get_text($row['is_reply_name']) : '';
        $is_reply_subject = !empty($row['is_reply_subject']) ? conv_subject($row['is_reply_subject'],50,"…") : '';
        $is_reply_content = !empty($row['is_reply_content']) ? get_view_thumbnail(conv_content($row['is_reply_content'], 1), $thumbnail_width) : '';
        $is_time    = substr($row['is_time'], 2, 8);

        $hash = md5($row['is_id'].$row['is_time'].$row['is_ip']);

        if ($i == 0) echo '<ol id="sit_use_ol">';
    ?>
			<div class="review_wrap">

              <!-- 작성자 정보 -->
           	  <ul class="review_user">
				  <li class="review_user_score">
                   	  <p class="review_user_id"><?php echo $is_name; ?> <img src="../img/common/icon_mem_ok.png" /></p>
                      <p class="singo_btn">신고</p>
                  </li>
                    
                  <!-- 작성자 이메일, 평점 -->
                  <li class="review_user_score">
                      <span class="review_info"><?php echo $is_time; ?></span>
                  </li>
              </ul>
                
                                
              <!-- 후기 내용 -->
              <ul class="review_con">
                	<!-- 사진후기일 경우 Class : photo_review -->
               	  <li class="review_con_text">
                		<div class="review_text">
	                        <button type="button" class="sit_use_li_title"><?php echo $is_subject; ?></button>
                            <div id="sit_use_con_<?php echo $i; ?>" class="sit_use_con">        
				                <div class="sit_use_p">
				                    <?php echo $is_content; // 사용후기 내용 ?>
				                </div>

				                <?php if ($is_admin || $row['mb_id'] == $member['mb_id']) { ?>
                				<div class="sit_use_cmd">
				                    <a href="<?php echo $itemuse_form."&amp;is_id={$row['is_id']}&amp;w=u"; ?>" class="itemuse_form btn01" onclick="return false;">수정</a>
                				    <a href="<?php echo $itemuse_formupdate."&amp;is_id={$row['is_id']}&amp;w=d&amp;hash={$hash}"; ?>" class="itemuse_delete btn01">삭제</a>
				                </div>
				                <?php } ?>

				                
				            </div>
                            
                            <span class="review_topic">상담주제: OOO</span>
                            
                        </div>
                        <!-- 후기사진: Background-image처리 -->
                        <p class="review_photo"><img src="../img/sample/view_01.jpg"/></p>
                    </li>
                  
                </ul>
                
                <?php if( $is_reply_subject ){  //  사용후기 답변 내용이 있다면 ?>
                <ul class="review_user counsel point_02_bo"> 
					<li class="review_re_name"><?php echo $is_reply_name; // 답변자 이름 ?></li>
                    <li class="review_re_con">
                                    
					                <div class="use_reply_tit">
                    					<?php echo $is_reply_subject; // 답변 제목 ?>
					                </div>
                                        
					                <div class="use_reply_p">
                    					<?php echo $is_reply_content; // 답변 내용 ?>
					                </div>
				            
                    </li>
                </ul>
                <?php } //end if ?>
                
                
  			</div>		
        <li class="sit_use_li">
            <button type="button" class="sit_use_li_title"><?php echo $is_subject; ?></button>
            <dl class="sit_use_dl">
                <dt>작성자</dt>
                <dd><?php echo $is_name; ?></dd>
                <dt>작성일</dt>
                <dd><i class="fa fa-clock-o" aria-hidden="true"></i> <?php echo $is_time; ?></dd>
                <dt>선호도<dt>
                <dd class="sit_use_star"><img src="<?php echo G5_SHOP_URL; ?>/img/s_star<?php echo $is_star; ?>.png" alt="별<?php echo $is_star; ?>개"></dd>
            </dl>

            <div id="sit_use_con_<?php echo $i; ?>" class="sit_use_con">
                <div class="sit_use_p">
                    <?php echo $is_content; // 사용후기 내용 ?>
                </div>

                <?php if ($is_admin || $row['mb_id'] == $member['mb_id']) { ?>
                <div class="sit_use_cmd">
                    <a href="<?php echo $itemuse_form."&amp;is_id={$row['is_id']}&amp;w=u"; ?>" class="itemuse_form btn01" onclick="return false;">수정</a>
                    <a href="<?php echo $itemuse_formupdate."&amp;is_id={$row['is_id']}&amp;w=d&amp;hash={$hash}"; ?>" class="itemuse_delete btn01">삭제</a>
                </div>
                <?php } ?>

                <?php if( $is_reply_subject ){  //  사용후기 답변 내용이 있다면 ?>
                <div class="sit_use_reply">
                    <div class="use_reply_icon">답변</div>
                    <div class="use_reply_tit">
                        <?php echo $is_reply_subject; // 답변 제목 ?>
                    </div>
                    <div class="use_reply_name">
                        <?php echo $is_reply_name; // 답변자 이름 ?>
                    </div>
                    <div class="use_reply_p">
                        <?php echo $is_reply_content; // 답변 내용 ?>
                    </div>
                </div>
                <?php } //end if ?>
            </div>
        </li>

    <?php }

    if ($i > 0) echo '</ol>';

    if (!$i) echo '<p class="sit_empty">서비스후기가 없습니다.</p>';
    ?>
</div>

<?php
echo itemuse_page($config['cf_mobile_pages'], $page, $total_page, G5_SHOP_URL."/itemuse.php?it_id=$it_id&amp;page=", "");
?>

<script>
$(function(){
    $(".itemuse_form").click(function(){
        window.open(this.href, "itemuse_form", "width=810,height=680,scrollbars=1");
        return false;
    });

    $(".itemuse_delete").click(function(){
        if (confirm("정말 삭제 하시겠습니까?\n\n삭제후에는 되돌릴수 없습니다.")) {
            return true;
        } else {
            return false;
        }
    });

    $(".sit_use_li_title").click(function(){
        var $con = $(this).siblings(".sit_use_con");
        if($con.is(":visible")) {
            $con.slideUp();
        } else {
            $(".sit_use_con:visible").hide();
            $con.slideDown(
                function() {
                    // 이미지 리사이즈
                    $con.viewimageresize2();
                }
            );
        }
    });

    $(".pg_page").click(function(){
        $("#itemuse").load($(this).attr("href"));
        return false;
    });

    $("a#itemuse_list").on("click", function() {
        window.opener.location.href = this.href;
        self.close();
        return false;
    });
});
</script>
<!-- } 상품 사용후기 끝 -->