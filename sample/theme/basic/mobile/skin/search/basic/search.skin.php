<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$search_skin_url.'/style.css">', 0);
?>


<form name="fsearch" onsubmit="return fsearch_submit(this);" method="get">
<input type="hidden" name="srows" value="<?php echo $srows ?>">

<input type="hidden" name="sfl" value="wr_subject||wr_content||ca_name||wr_9||wr_10">

<fieldset id="sch_res_detail">
    <legend>상세검색</legend>
    <div class="sch_wr">

		<?php //echo $group_select ?>
        <script>document.getElementById("gr_id").value = "<?php echo $gr_id ?>";</script>

        <!--<label for="sfl" class="sound_only">검색조건</label>
        <select name="sfl" id="sfl">
            <option value="wr_subject||wr_content"<?php echo get_selected($sfl, "wr_subject||wr_content") ?>>제목+내용</option>
            <option value="wr_subject"<?php echo get_selected($sfl, "wr_subject") ?>>제목</option>
            <option value="wr_content"<?php echo get_selected($sfl, "wr_content") ?>>내용</option>
            <option value="mb_id"<?php echo get_selected($sfl, "mb_id") ?>>회원아이디</option>
            <option value="wr_name"<?php echo get_selected($sfl, "wr_name") ?>>이름</option>
        </select>-->

        <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
        <input type="text" name="stx" id="stx" value="<?php echo $text_stx ?>" class="frm_input" required  maxlength="20">
        <button type="submit" class="btn_submit" value="검색"><i class="fa fa-search" aria-hidden="true"></i></button>

        <script>
        function fsearch_submit(f)
        {
            if (f.stx.value.length < 2) {
                alert("검색어는 두글자 이상 입력하십시오.");
                f.stx.select();
                f.stx.focus();
                return false;
            }

            // 검색에 많은 부하가 걸리는 경우 이 주석을 제거하세요.
            var cnt = 0;
            for (var i=0; i<f.stx.value.length; i++) {
                if (f.stx.value.charAt(i) == ' ')
                    cnt++;
            }

            if (cnt > 1) {
                alert("빠른 검색을 위하여 검색어에 공백은 한개만 입력할 수 있습니다.");
                f.stx.select();
                f.stx.focus();
                return false;
            }

            f.action = "";
            return true;
        }
        </script>
    </div>
    <!--
    <div class="switch_field chk_box">
        <input type="radio" value="or" <?php echo ($sop == "or") ? "checked" : ""; ?> id="sop_or" name="sop">
        <label for="sop_or"><span></span>OR</label>
        <input type="radio" value="and" <?php echo ($sop == "and") ? "checked" : ""; ?> id="sop_and" name="sop">
        <label for="sop_and"><span></span>AND</label>
    </div>
    -->
</fieldset>
</form>

<div id="sch_result">
    <?php
    if ($stx) {
        if ($board_count) {
     ?>
     <!--
    <ul id="sch_res_board">
        <li><a href="?<?php echo $search_query ?>&amp;gr_id=<?php echo $gr_id ?>" <?php echo $sch_all ?>>전체게시판</a></li>
        <?php echo $str_board_list; ?>
    </ul>
    -->
    <?php
        } else {
     ?>
    <div class="empty_list">검색결과가 없습니다.</div>
    <?php } }  ?>

    <!--<hr>-->
    <div class="list_01">
    
<div class="counselor_list_wrap">

	
 
    
    <?php if ($stx && $board_count) { ?><section class="sch_res_list"><?php }  ?>
    <?php
    $k=0;
    for ($idx=$table_index, $k=0; $idx<count($search_table) && $k<$rows; $idx++) {
     ?>
        <!--<h2><a href="<?php echo get_pretty_url($search_table[$idx], '', $search_query); ?>"><?php echo $bo_subject[$idx] ?> 게시판 내 결과</a></h2>-->
        <?php
        for ($i=0; $i<count($list[$idx]) && $k<$rows; $i++, $k++) {

			
			$cinfo = get_member($list[$idx][$i]["mb_id"]);  


            if ($list[$idx][$i]['wr_is_comment'])
            {
                $comment_def = '<span class="cmt_def"><i class="fa fa-commenting-o" aria-hidden="true"></i><span class="sound_only">댓글</span></span> ';
                $comment_href = '#c_'.$list[$idx][$i]['wr_id'];
            }
            else
            {
                $comment_def = '';
                $comment_href = '';
            }

		   $thumb = get_list_thumbnail('counselor', $list[$idx][$i]['wr_id'], '170', '116', false, true);

			$bimg = "";
			if($thumb['src']) {
				$bimg = $thumb['src'];
			} else {
				$bimg = '../img/common/noimage.png';
			}

         ?>
            
            <div class="counselor_list bo_none">
       
        	<div class="counselor_list">
        	    <div class="counselor_list_item">
                	<a href="<?php echo $list[$idx][$i]['href'] ?>">
						<ul class="counselor_img_wrap type_bg <?=$cate_bg[$list[$idx][$i]['ca_name']]?>">
							<span class="list_scrap" onclick="scrap_submit('<?=$list[$idx][$i]["wr_id"]?>')" style="cursor:pointer;">				
								<?
								$sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $list[$idx][$i]["wr_id"]);
								$scrap_img = "../../../img/common/list_icon_scrap.png";
								if($sflag==true){
									$scrap_img = "../../../img/common/list_icon_scrap_on.png";
								}
								?>
								<img src="<?=$scrap_img?>" id="scrap_icon_<?=$list[$idx][$i]["wr_id"]?>">					
							</span>       
							<span class="icon_cate <?=$cate_bg[$list[$idx][$i]['ca_name']]?>"><?php echo $list[$idx][$i]['ca_name'] ?></span>
							<li class="counselor_img" style=" background-image:url(<?=$bimg?>);"></li>                    
						</ul>
                    </a>
                    <ul class="counselor_con_wrap">   
						<div class="counselor_con_right">
							<a href="<?php echo $list[$idx][$i]['href'] ?>">
								<li>
									<div class="top">
										<div class="counselor_con_title">
											<?php echo $cinfo["mb_nick"]?>
											<!-- 상담사 고유번호 -->
											<?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>
										</div>
										<div class="counselor_con_text"><?php echo $list[$idx][$i]['wr_8'] ?></div>
									</div>
									<div class="counselor_con_price">
										<?=number_format($cinfo["mb_4"])?>원
										<span class="unit">(<?=$cinfo["mb_5"]?>초당)</span>
									</div>
                                    <?php if ($member['use_chat'] == 'Y'){ ?>
                                   <div class="counselor_con_price">
                                       <span>|
									<?=number_format($cinfo["mb_13"])?>원</span>
										<span class="unit">(<?=$cinfo["mb_12"]?>초당)</span>
									</div>
                                    <?php }?>
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
                      	  <span class="tag">#<?php echo $list[$idx][$i]['wr_9'] ?></span>
                      	  <span class="tag">#<?php echo $list[$idx][$i]['wr_10'] ?></span>
    	              </ul>
                      </a>
                      <a href="<?php echo $list[$i]['href'] ?>">
                  	  <ul class="right">
           	  		      <li class="right_item">최근 후기<span>(<?=get_counselor_afcnt($list[$idx][$i]["mb_id"])?>)</span></li>
                          <li class="right_item gray">|</li>
	                      <li class="right_item">문의<span>(<?=get_counselor_qa_new($list[$idx][$i]["mb_id"])?>)</span></li>           
            	      </ul>
                      </a>
                      
                  </summary>
    	      </details>
        	</div>

    </div>

        <?php }  ?>
        <div class="sch_more"><a href="<?php echo get_pretty_url($search_table[$idx], '', $search_query); ?>"><!--<strong><?php echo $bo_subject[$idx] ?></strong> -->검색결과 더보기</a></div>
    <?php }  ?>

    <?php if ($stx && $board_count) {  ?></section><?php }  ?>
    
            
		</div>       
    </div>
    
    
    <?php echo $write_pages ?>


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
</div>
