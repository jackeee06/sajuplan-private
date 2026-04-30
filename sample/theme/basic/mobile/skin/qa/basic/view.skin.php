<?php
if (!defined("_GNUBOARD_")) exit;
include_once(G5_LIB_PATH.'/thumbnail.lib.php');
add_stylesheet('<link rel="stylesheet" href="'.$qa_skin_url.'/style.css">', 0);
?>

<script src="<?php echo G5_JS_URL; ?>/viewimageresize.js"></script>

<style>
/* ===== QA 뷰 리디자인 ===== */
#bo_v, #bo_v *, #bo_v *::before, #bo_v *::after { box-sizing: border-box; }
.sound_only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* 상태 + 제목 헤더 */
.qv_header {
    background: #fff;
    padding: 20px 16px 16px;
    border-bottom: 1px solid #eee;
}
.qv_status {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 10px;
}
.qv_status.done { background: #e8f5e9; color: #2e7d32; }
.qv_status.wait { background: #fff3e0; color: #e65100; }
.qv_title {
    font-size: 17px;
    font-weight: 700;
    color: #222;
    line-height: 1.5;
    margin: 0 0 10px;
    word-break: break-all;
}
.qv_cate_badge {
    display: inline-block;
    background: #f3efff;
    color: #8259f5;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-right: 6px;
    vertical-align: middle;
}
.qv_meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #999;
}
.qv_meta .qv_dot { color: #ddd; }

/* 연락처 */
.qv_contact {
    background: #fff;
    margin: 10px 12px 0;
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid #eee;
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: #666;
}
.qv_contact dt {
    color: #8259f5;
    margin-right: 4px;
    display: inline;
}
.qv_contact dd {
    display: inline;
    margin: 0;
    color: #333;
    font-weight: 500;
}
.qv_contact dl { margin: 0; }

/* 본문 카드 */
.qv_content_card {
    background: #fff;
    margin: 10px 12px;
    border-radius: 14px;
    padding: 20px 16px;
    border: 1px solid #eee;
}
#bo_v_atc_title { display: none; }
#bo_v_img { margin-bottom: 14px; }
#bo_v_img img { max-width: 100%; height: auto; border-radius: 8px; }
#bo_v_con {
    font-size: 14px;
    line-height: 1.75;
    color: #444;
    word-break: break-all;
}
#bo_v_con img { max-width: 100%; height: auto; }

/* 추가질문 버튼 */
.qv_rewrite_btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 14px;
    padding: 10px 20px;
    background: #f3efff;
    color: #8259f5;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
}

/* 첨부파일 */
.qv_files {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #f0f0f0;
}
.qv_files h2 {
    font-size: 13px;
    font-weight: 700;
    color: #333;
    margin: 0 0 8px;
}
.qv_files ul {
    list-style: none;
    margin: 0;
    padding: 0;
}
.qv_files li {
    margin-bottom: 6px;
}
.qv_files a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
    text-decoration: none;
    color: #555;
    font-size: 13px;
}
.qv_files a i { color: #8259f5; }
.qv_files a strong { font-weight: 500; color: #333; }

/* 수정/삭제 버튼 */
.qv_actions {
    display: flex;
    gap: 8px;
    margin: 0 12px 10px;
}
.qv_actions a {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    line-height: 1;
}
.qv_btn_edit {
    background: #8259f5;
    color: #fff !important;
}
.qv_btn_edit:active { background: #6b3fe4; }
.qv_btn_del {
    background: #fff;
    color: #ff5252 !important;
    border: 1.5px solid #ff5252;
}
.qv_btn_del:active { background: #fff5f5; }

/* 이전/다음 */
.qv_nav {
    list-style: none;
    margin: 0 12px 10px;
    padding: 0;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #eee;
    overflow: hidden;
}
.qv_nav li {
    border-bottom: 1px solid #f0f0f0;
}
.qv_nav li:last-child { border-bottom: none; }
.qv_nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 14px;
    text-decoration: none;
    color: #555;
    font-size: 13px;
}
.qv_nav a i {
    color: #8259f5;
    font-size: 12px;
    flex-shrink: 0;
}
.qv_nav a:active { background: #fafafa; }

/* 연관질문 */
#bo_v_rel {
    margin: 0 12px 20px;
}
#bo_v_rel > h2 {
    font-size: 14px;
    font-weight: 700;
    color: #333;
    margin: 0 0 10px;
    padding: 0;
}
#bo_v_rel .list_01 ul {
    list-style: none;
    margin: 0;
    padding: 0;
}
#bo_v_rel .list_01 li {
    background: #fff;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 6px;
}
#bo_v_rel .li_title { margin-bottom: 6px; }
#bo_v_rel .li_title strong {
    display: inline-block;
    background: #f3efff;
    color: #8259f5;
    padding: 1px 7px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    margin-right: 6px;
}
#bo_v_rel .li_sbj {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    text-decoration: none;
}
#bo_v_rel .li_info {
    font-size: 12px;
    color: #aaa;
}
#bo_v_rel .txt_done { color: #2e7d32; font-weight: 600; }
#bo_v_rel .txt_rdy { color: #e65100; font-weight: 600; }
#bo_v_rel .li_date { margin-left: 6px; }

/* 목록 버튼 */
.qv_list_btn {
    display: block;
    text-align: center;
    margin: 0 12px 24px;
    padding: 14px 0;
    background: #fff;
    color: #666;
    font-size: 14px;
    font-weight: 600;
    border: 1.5px solid #ddd;
    border-radius: 10px;
    text-decoration: none;
}
.qv_list_btn:active { background: #fafafa; }
</style>

<!-- 게시물 읽기 시작 { -->
<article id="bo_v">

    <!-- 헤더: 상태 + 제목 + 메타 -->
    <div class="qv_header">
        <span class="qv_status <?php echo ($view['qa_status'] ? 'done' : 'wait'); ?>">
            <?php echo ($view['qa_status'] ? '답변완료' : '답변대기'); ?>
        </span>
        <h2 class="qv_title">
            <?php if($view['category']) { ?><span class="qv_cate_badge"><?php echo $view['category']; ?></span><?php } ?>
            <?php echo $view['subject']; ?>
        </h2>
        <div class="qv_meta">
            <span><?php echo $view['name'] ?></span>
            <span class="qv_dot">·</span>
            <span><?php echo $view['datetime']; ?></span>
        </div>
    </div>

    <?php if($view['email'] || $view['hp']) { ?>
    <div class="qv_contact">
        <?php if($view['email']) { ?>
        <dl>
            <dt><i class="fa fa-envelope-o" aria-hidden="true"></i></dt>
            <dd><?php echo $view['email']; ?></dd>
        </dl>
        <?php } ?>
        <?php if($view['hp']) { ?>
        <dl>
            <dt><i class="fa fa-phone" aria-hidden="true"></i></dt>
            <dd><?php echo $view['hp']; ?></dd>
        </dl>
        <?php } ?>
    </div>
    <?php } ?>

    <!-- 본문 -->
    <div class="qv_content_card">
        <section id="bo_v_atc">
            <h2 id="bo_v_atc_title">본문</h2>

            <?php
            if($view['img_count']) {
                echo "<div id=\"bo_v_img\">\n";
                for ($i=0; $i<$view['img_count']; $i++) {
                    echo get_view_thumbnail($view['img_file'][$i], $qaconfig['qa_image_width']);
                }
                echo "</div>\n";
            }
            ?>

            <div id="bo_v_con"><?php echo get_view_thumbnail($view['content'], $qaconfig['qa_image_width']); ?></div>

            <?php if($view['qa_type']) { ?>
            <div><a href="<?php echo $rewrite_href; ?>" class="qv_rewrite_btn"><i class="fa fa-pencil" aria-hidden="true"></i>&nbsp;추가질문</a></div>
            <?php } ?>

            <?php if($view['download_count']) { ?>
            <div class="qv_files">
                <h2>첨부파일</h2>
                <ul>
                <?php for ($i=0; $i<$view['download_count']; $i++) { ?>
                    <li>
                        <a href="<?php echo $view['download_href'][$i]; ?>" class="view_file_download" download>
                            <i class="fa fa-paperclip" aria-hidden="true"></i>
                            <strong><?php echo $view['download_source'][$i] ?></strong>
                        </a>
                    </li>
                <?php } ?>
                </ul>
            </div>
            <?php } ?>
        </section>
    </div>

    <!-- 수정/삭제 -->
    <?php if ($update_href || $delete_href) { ?>
    <div class="qv_actions">
        <?php if ($update_href) { ?>
        <a href="<?php echo $update_href ?>" class="qv_btn_edit"><i class="fa fa-pencil" aria-hidden="true"></i>&nbsp;수정</a>
        <?php } ?>
        <?php if ($delete_href) { ?>
        <a href="<?php echo $delete_href ?>" onclick="del(this.href); return false;" class="qv_btn_del"><i class="fa fa-trash-o" aria-hidden="true"></i>&nbsp;삭제</a>
        <?php } ?>
    </div>
    <?php } ?>

    <!-- 이전/다음 -->
    <?php if ($prev_href || $next_href) { ?>
    <ul class="qv_nav">
        <?php if ($prev_href) { ?><li><a href="<?php echo $prev_href ?>"><i class="fa fa-chevron-up" aria-hidden="true"></i> <?php echo $prev_qa_subject;?></a></li><?php } ?>
        <?php if ($next_href) { ?><li><a href="<?php echo $next_href ?>"><i class="fa fa-chevron-down" aria-hidden="true"></i> <?php echo $next_qa_subject;?></a></li><?php } ?>
    </ul>
    <?php } ?>

</article>
<!-- } 게시판 읽기 끝 -->

<?php
if(!$view['qa_type']) {
    if($view['qa_status'] && $answer['qa_id'])
        include_once($qa_skin_path.'/view.answer.skin.php');
    else
        include_once($qa_skin_path.'/view.answerform.skin.php');
}
?>

<?php if($view['rel_count']) { ?>
<section id="bo_v_rel">
    <h2>연관질문</h2>
    <div class="list_01">
        <ul>
        <?php for($i=0; $i<$view['rel_count']; $i++) { ?>
            <li>
                <div class="li_title">
                    <strong><?php echo get_text($rel_list[$i]['category']); ?></strong>
                    <a href="<?php echo $rel_list[$i]['view_href']; ?>" class="li_sbj"><?php echo $rel_list[$i]['subject']; ?></a>
                </div>
                <div class="li_info">
                    <span class="li_stat <?php echo ($rel_list[$i]['qa_status'] ? 'txt_done' : 'txt_rdy'); ?>"><?php echo ($rel_list[$i]['qa_status'] ? '답변완료' : '답변대기'); ?></span>
                    <span class="li_date"><?php echo $rel_list[$i]['date']; ?></span>
                </div>
            </li>
        <?php } ?>
        </ul>
    </div>
</section>
<?php } ?>

<a href="<?php echo $list_href ?>" class="qv_list_btn"><i class="fa fa-list" aria-hidden="true"></i> 목록으로</a>

<script>
$(function() {
    $("a.view_image").click(function() {
        window.open(this.href, "large_image", "location=yes,links=no,toolbar=no,top=10,left=10,width=10,height=10,resizable=yes,scrollbars=no,status=no");
        return false;
    });
    $("#bo_v_atc").viewimageresize();
});
</script>