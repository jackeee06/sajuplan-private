	<div class="review_top" style="">
    	<ul class="review_top_img">
			<?php echo display_banner('일반-상담후기', 'mainbanner.10.skin.php'); ?>
		</ul>
        <ul class="review_top_noti" style="">
        	<i class="xi-check point" style=""></i> 본인인증 완료 및 5분 이상 상담한 고객님에 한하여 후기 작성이 가능합니다.
        </ul>

        <ul class="review_write_btn">
            <button onclick="location.href='../bbs/write.php?bo_table=review&csr_id=<?=$view["mb_id"]?>' ">후기 작성하기 <i class="xi-angle-right"></i></button>
        </ul>
        
        <ul class="review_write_noti">
        	후기 작성 시, 코인 지급!
            <a href="../bbs/faq.php?fm_id=1">
            <p class="review_guide">상담후기 운영정책 <i class="xi-help-o"></i></p>
            </a>
        </ul>
    </div>