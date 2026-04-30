<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);



?>

<script src="<?php echo G5_JS_URL; ?>/viewimageresize.js"></script>

<!-- 게시판 이름 표시 <div id="bo_v_table"><?php echo ($board['bo_mobile_subject'] ? $board['bo_mobile_subject'] : $board['bo_subject']); ?></div> -->
<ul class="btn_top top btn_bo_user" style="display:none;"> 
	<!--
    <li><a href="#bo_vc" class="btn_b03 btn" title="댓글"><i class="fa fa-commenting" aria-hidden="true"></i><span class="sound_only">댓글</span></a></li>
    <?php if ($board['bo_use_sns'] || $scrap_href){ ?>
    <li class="bo_share">
    	<button type="button" class="btn_share_opt btn_b03 btn is_view_btn" title="공유"><i class="fa fa-share-alt" aria-hidden="true"></i><span class="sound_only">공유</span></button>
    	<div id="bo_v_share" class="is_view_btn">
            <?php if ($scrap_href) { ?><a href="<?php echo $scrap_href; ?>" target="_blank" class=" btn_scrap" onclick="win_scrap(this.href); return false;" title="스크랩"><i class="fa fa-thumb-tack" aria-hidden="true"></i><span class="sound_only">스크랩</span></a><?php } ?>
            <?php include_once(G5_SNS_PATH."/view.sns.skin.php"); ?>
        </div>	
    </li>
    <?php } ?>
    
    <?php if ($write_href) { ?><li><a href="<?php echo $write_href ?>" class="btn_b03 btn" title="글쓰기"><i class="fa fa-pencil" aria-hidden="true"></i><span class="sound_only">글쓰기</span></a></li><?php } ?>
    -->
	
	<li>
		<button type="button" class="btn_more_opt btn_b03 btn is_view_btn" title="게시판 리스트 옵션"><i class="fa fa-ellipsis-v" aria-hidden="true"></i><span class="sound_only">게시판 리스트 옵션</span></button>
    	<?php ob_start(); ?>
	    <ul class="more_opt is_view_btn">
	    	<?php if ($reply_href) { ?><li><a href="<?php echo $reply_href ?>"><i class="fa fa-reply" aria-hidden="true"></i> 답변</a></li><?php } ?>
			<?php if ($update_href) { ?><li><a href="<?php echo $update_href ?>"><i class="fa fa-pencil-square-o" aria-hidden="true"></i> 수정</a></li><?php } ?>
	    	<?php if ($delete_href) { ?><li><a href="<?php echo $delete_href ?>" onclick="del(this.href); return false;"><i class="fa fa-trash-o" aria-hidden="true"></i> 삭제</a></li><?php } ?>
	    	<?php if ($copy_href) { ?><li><a href="<?php echo $copy_href ?>" onclick="board_move(this.href); return false;"><i class="fa fa-files-o" aria-hidden="true"></i> 복사</a></li><?php } ?>
	    	<?php if ($move_href) { ?><li><a href="<?php echo $move_href ?>" onclick="board_move(this.href); return false;"><i class="fa fa-arrows" aria-hidden="true"></i> 이동</a></li><?php } ?>
	    	<?php if ($search_href) { ?><li><a href="<?php echo $search_href ?>">검색</a></li><?php } ?>
	    	<li><a href="<?php echo $list_href ?>" class="btn_list"><i class="fa fa-list" aria-hidden="true"></i> 목록</a></li>
		</ul>
		<?php $link_buttons = ob_get_contents(); ob_end_flush(); ?>
	</li>
</ul>
<script>
jQuery(function($){
    // 게시판 보기 버튼 옵션
    $(".btn_more_opt.is_view_btn").on("click", function(e) {
        e.stopPropagation();
        $(".more_opt.is_view_btn").toggle();
    });
    // 게시글 공유
    $(".btn_share_opt").on("click", function(e) {
        e.stopPropagation();
        $("#bo_v_share").toggle();
    });
    $(document).on("click", function (e) {
        if(!$(e.target).closest('.is_view_btn').length) {
            $(".more_opt.is_view_btn").hide();
            $("#bo_v_share").hide();
        }
    });
});
</script>
<article id="bo_v" class="" style="width:<?php echo $width; ?>">
	<div class=" today">
  <ul class="today_con">
    	<li class="today_date">
			<? //echo $now = date("Y-m-d"); ?> 
            <? echo $now = date("m월 d일"); ?> 
    	    (<? 
				$yoil = array("일", "월", "화", "수", "목", "금", "토");
				echo $yoil[date("w")]; 
			?>)
		</li>
        <li class="today_name"><span><?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>님,</span></li>
        <li class="today_cmt"><?php echo get_view_thumbnail($view['content']); ?></li>
    </ul>	
</div>

<div style="width:100%; float:left; padding:20px;">
	<?php echo display_banner('오늘의운세', 'mainbanner.10.skin.php'); ?>
</div>

		<?php if ($is_admin) { ?>
		<?php if ($update_href) { ?>
        <div id="bo_v_info" style="padding:20px; border-top:1px solid #eee; margin-top:20px;">
	        <h2>페이지 정보</h2>
	        <!--<span class="sound_only">작성자 </span><?php echo $view['name'] ?><span class="ip"><?php if ($is_ip_view) { echo "&nbsp;($ip)"; } ?></span>
            ·
            -->
	        <span class="sound_only">작성일</span><!--<i class="fa fa-clock-o" aria-hidden="true"></i> --><?php echo date("y-m-d H:i", strtotime($view['wr_datetime'])) ?>
            
            <div style="float:right; margin-top:-10px;">
            <a href="<?php echo $list_href ?>" class="btn black_bg white">목록보기</a>
            
            <?php if ($update_href) { ?>
            	<a href="<?php echo $update_href ?>" class="btn point_bg white"><i class="fa fa-pencil-square-o" aria-hidden="true"></i> 수정</a>
			<?php } ?>
            
	    	<?php if ($delete_href) { ?>
            	<a href="<?php echo $delete_href ?>" class="btn black_bg white" onclick="del(this.href); return false;"><i class="fa fa-trash-o" aria-hidden="true"></i> 삭제</a>
			<?php } ?>
            </div>
            <!--
	        <span class="sound_only">조회</span><strong><i class="fa fa-eye" aria-hidden="true"></i> <?php echo number_format($view['wr_hit']) ?></strong>
	        <span class="sound_only">댓글</span><strong><i class="fa fa-commenting-o" aria-hidden="true"></i> <?php echo number_format($view['wr_comment']) ?></strong>
            -->
	    </div>   
        <?php } ?>
        <?php } ?>

</article>

<script>
<?php if ($board['bo_download_point'] < 0) { ?>
$(function() {
    $("a.view_file_download").click(function() {
        if(!g5_is_member) {
            alert("다운로드 권한이 없습니다.\n회원이시라면 로그인 후 이용해 보십시오.");
            return false;
        }

        var msg = "파일을 다운로드 하시면 포인트가 차감(<?php echo number_format($board['bo_download_point']) ?>점)됩니다.\n\n포인트는 게시물당 한번만 차감되며 다음에 다시 다운로드 하셔도 중복하여 차감하지 않습니다.\n\n그래도 다운로드 하시겠습니까?";

        if(confirm(msg)) {
            var href = $(this).attr("href")+"&js=on";
            $(this).attr("href", href);

            return true;
        } else {
            return false;
        }
    });
});
<?php } ?>

function board_move(href)
{
    window.open(href, "boardmove", "left=50, top=50, width=500, height=550, scrollbars=1");
}
</script>

<!-- 게시글 보기 끝 -->

<script>
$(function() {
    $("a.view_image").click(function() {
        window.open(this.href, "large_image", "location=yes,links=no,toolbar=no,top=10,left=10,width=10,height=10,resizable=yes,scrollbars=no,status=no");
        return false;
    });

    // 추천, 비추천
    $("#good_button, #nogood_button").click(function() {
        var $tx;
        if(this.id == "good_button")
            $tx = $("#bo_v_act_good");
        else
            $tx = $("#bo_v_act_nogood");

        excute_good(this.href, $(this), $tx);
        return false;
    });

    // 이미지 리사이즈
    $("#bo_v_atc").viewimageresize();
});

function excute_good(href, $el, $tx)
{
    $.post(
        href,
        { js: "on" },
        function(data) {
            if(data.error) {
                alert(data.error);
                return false;
            }

            if(data.count) {
                $el.find("strong").text(number_format(String(data.count)));
                if($tx.attr("id").search("nogood") > -1) {
                    $tx.text("이 글을 비추천하셨습니다.");
                    $tx.fadeIn(200).delay(2500).fadeOut(200);
                } else {
                    $tx.text("이 글을 추천하셨습니다.");
                    $tx.fadeIn(200).delay(2500).fadeOut(200);
                }
            }
        }, "json"
    );
}
</script>