<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "나의 상담문의";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<link rel="stylesheet" href="../theme/basic/mobile/skin/board/counselor/style.css?ver=210618">

<style>
#bo_vc { width:100% !important; margin-left:0 !important; border-top:none; margin-top:0; padding-top:0;}
#bo_vc article .comment_inner { border-top:0;}
</style>

<section id="bo_vc">
	
    <a href="../bbs/board.php?bo_table=counselor&wr_id=39">
	<article id="c_45">
        <div class="comment_inner">
            <header>
                <h2>디에프님의 댓글</h2>
                <span class="member">디에프</span>                <!--
                                -->
                <span class="sound_only">작성일</span>
                <span class="bo_vc_hdinfo"><time datetime="2024-08-01">24-08-01 16:41</time></span>
                
                                                
            </header>
            <div class="cmt_contents">
                <!-- 댓글 출력 -->
                <p>문의합니다.</p>

            </div>
            <input type="hidden" id="secret_comment_45" value="">
            <textarea id="save_comment_45" style="display:none">문의합니다.</textarea>
        </div>
    </article>
    </a>
    
    <a href="../bbs/board.php?bo_table=counselor&wr_id=39">
    <article id="c_155" class="re_comment">
        <div class="comment_inner">
            <header>
                <h2>디에프님의 댓글<span class="sound_only">의 댓글</span></h2>
                <span class="member">사주문상담사</span>                <!--
                                -->
                <span class="sound_only">작성일</span>
                <span class="bo_vc_hdinfo"><time datetime="2024-08-02">24-08-02 23:32</time></span>
             </header>
            <div class="cmt_contents">
                <!-- 댓글 출력 -->
                <p>안녕하세요. 반갑습니다.</p>

          </div>
            <input type="hidden" id="secret_comment_155" value="">
            <textarea id="save_comment_155" style="display:none">안녕하세요. 반갑습니다.</textarea>
        </div>
    </article>
    </a>
    
    
</section>
<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
