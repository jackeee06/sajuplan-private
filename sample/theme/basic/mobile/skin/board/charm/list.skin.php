<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
add_stylesheet('
<style>
/* 쓰기 버튼이 페이지네이션과 겹치지 않도록 바닥에서 60px 위로 올립니다. */
.fix_btn.write_btn {
  bottom: 120px !important;
}
</style>
', 1);
?>




<script src="<?php echo G5_JS_URL; ?>/jquery.fancylist.js"></script>

<form name="fboardlist"  id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
    <input type="hidden" name="stx" value="<?php echo $stx ?>">
    <input type="hidden" name="spt" value="<?php echo $spt ?>">
    <input type="hidden" name="sst" value="<?php echo $sst ?>">
    <input type="hidden" name="sod" value="<?php echo $sod ?>">
    <input type="hidden" name="page" value="<?php echo $page ?>">
    <input type="hidden" name="sw" value="">

    <?php if ($write_href) { ?>
        <div class="fix_btn write_btn ">
            <a href="<?php echo $write_href ?>" class="point_bg white" title="작성"><?php echo $board['bo_subject']; ?> 작성</a>
        </div>
    <?php } ?>

    <?php if ($is_checkbox) { ?>
        <div class="all_chk chk_box">
            <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
            <label for="chkall">
                <span></span>
                <b class="sound_only">현재 페이지 게시물 </b> 전체선택
            </label>

            <button type="submit" name="btn_submit" value="선택삭제" class="btn black_bg white" onclick="document.pressed=this.value" style="    float: right;"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button>

            <?php if ($rss_href || $write_href) { ?>
                <ul class="<?php echo isset($view) ? 'view_is_list btn_top' : 'btn_top top btn_bo_user';?>" style="display:none;">
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
                                    <li><button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value"><i class="fa fa-files-o" aria-hidden="true"></i> 선택복사</button></li>
                                    <li><button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value"><i class="fa fa-arrows" aria-hidden="true"></i> 선택이동</button></li>
                                </ul>
                            <?php } ?>
                        </li>
                    <?php } ?>
                </ul>
            <?php } ?>
        </div>
    <?php } ?>

    <!--
<?php if ($rss_href || $write_href) { ?>
<ul class="<?php echo isset($view) ? 'view_is_list btn_top' : 'btn_top top btn_bo_user';?>">
	<?php if ($admin_href) { ?><li><a href="<?php echo $admin_href ?>" class="btn_admin btn" title="관리자"><i class="fa fa-cog fa-spin fa-fw"></i><span class="sound_only">관리자</span></a></li><?php } ?>
    <?php if ($rss_href) { ?><li><a href="<?php echo $rss_href ?>" class="btn_b03 btn" title="RSS"><i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span></a></li><?php } ?>
    <?php if ($is_admin == 'super' || $is_auth) {  ?>
	<li>
		<button type="button" class="btn_more_opt btn_b03 btn is_list_btn" title="게시판 리스트 옵션"><i class="fa fa-ellipsis-v" aria-hidden="true"></i><span class="sound_only">게시판 리스트 옵션</span></button>
		<?php if ($is_checkbox) { ?>
        <ul class="more_opt is_list_btn">
            <li><button type="submit" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button></li>
            <li><button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value"><i class="fa fa-files-o" aria-hidden="true"></i> 선택복사</button></li>
            <li><button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value"><i class="fa fa-arrows" aria-hidden="true"></i> 선택이동</button></li>
        </ul>
        <?php } ?>
	</li>
    <?php } ?>
	<?php if ($write_href) { ?><li><a href="<?php echo $write_href ?>" class="fix_btn write_btn" title="글쓰기"><i class="fa fa-pencil" aria-hidden="true"></i><span class="sound_only">글쓰기</span></a></li><?php } ?>
</ul>
<?php } ?>
-->

    <!-- 게시판 목록 시작 -->
    <div id="bo_gall">

        <?php if ($is_category) { ?>
            <nav id="bo_cate">
                <h2><?php echo ($board['bo_mobile_subject'] ? $board['bo_mobile_subject'] : $board['bo_subject']) ?> 카테고리</h2>
                <ul id="bo_cate_ul">
                    <?php echo $category_option ?>
                </ul>
            </nav>
        <?php } ?>

        <h2>이미지 목록</h2>


        <ul id="gall_ul" style="margin-bottom: 60px;">
            <?php
            for ($i=0; $i<count($list); $i++) {

                $ss_name = 'ss_view_'.$bo_table.'_'.$list[$i]['wr_id'];
                if (!get_session($ss_name)) set_session($ss_name, TRUE);


                $filename = $list[$i]['file'][0]['file'];
                $filepath = G5_DATA_PATH.'/file/'.$bo_table;
                $filesrc = G5_DATA_URL.'/file/'.$bo_table.'/'.$filename;
                $thumb = thumbnail($filename, $filepath , $filepath , 200, 200, false, true);
                $thumbsrc = G5_DATA_URL.'/file/'.$bo_table.'/'.$thumb;
                /*
                echo "파일명: $filename";
                echo "<br>";
                echo "data 폴더 경로: $filepath";
                echo "<br>";
                echo "이미지 주소: $filesrc";
                echo "<br>";
                echo "썸네일 이미지 파일명: $thumb";
                echo "<br>";
                echo "썸네일 이미지 주소: $thumbsrc";
                */
                ?>
                <li class="gall_li <?php if ($wr_id == $list[$i]['wr_id']) { ?>gall_now<?php } ?>">
                    <div class="gall_li_wr">

                        <?php if ($is_checkbox) { ?>
                            <span class="gall_li_chk chk_box">
                    <input type="checkbox" name="chk_wr_id[]" value="<?php echo $list[$i]['wr_id'] ?>" id="chk_wr_id_<?php echo $i ?>" class="selec_chk">
                	<label for="chk_wr_id_<?php echo $i ?>">
                		<span></span>
                		<b class="sound_only"><?php echo $list[$i]['subject'] ?></b>
                	</label>
                </span>
                        <?php } ?>
                        <span class="sound_only">
                    <?php
                    if ($wr_id == $list[$i]['wr_id'])
                        echo "<span class=\"bo_current\">열람중</span>";
                    else
                        echo $list[$i]['num'];
                    ?>
                </span>

                        <?php if ($is_admin) { ?>
                        <a href="<?php echo $list[$i]['href'] ?>" class="gall_img">
                            <? } else { ?>
                            <!--<a href="<?php echo $list[$i]['file'][0]['href']; ?>" class="gall_img">-->

                            <a href="<?php echo $filesrc; ?>" class="gall_img" download="<?php echo $filename; ?>">
                                <?php } ?>

                                <?php
                                if ($list[$i]['is_notice']) { // 공지사항 ?>
                                    <strong class="gall_notice">공지</strong>
                                    <?php
                                } else {
                                    $thumb = get_list_thumbnail($board['bo_table'], $list[$i]['wr_id'], $board['bo_mobile_gallery_width'], $board['bo_mobile_gallery_height']);

                                    if($thumb['src']) {
                                        $img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" width="'.$board['bo_mobile_gallery_width'].'" height="'.$board['bo_mobile_gallery_height'].'">';
                                    } else {
                                        $img_content = '<span class="no_img"><i class="fa fa-picture-o" aria-hidden="true"></i></span>';
                                    }

                                    echo run_replace('thumb_image_tag', $img_content, $thumb);
                                }
                                ?>
                            </a>


                            <div class="gall_text_href">
                                <?php if ($is_category && $list[$i]['ca_name']) { ?>
                                    <a href="<?php echo $list[$i]['ca_name_href'] ?>" class="bo_cate_link"><?php echo $list[$i]['ca_name'] ?></a>
                                <?php } ?>

                                <?php if ($is_admin) { ?>
                                <a href="<?php echo $list[$i]['href'] ?>" class="gall_li_tit">
                                    <? } else { ?>
                                    <a href="<?php echo $list[$i]['file'][0]['href']; ?>" class="gall_li_tit">
                                        <?php } ?>
                                        <?php echo $list[$i]['subject'] ?>
                                        <!--
                                        <br />
                                        <p class="point_bg white" style="display:inline-block; padding:4px 14px; font-size:14px; margin-top:4px; border-radius:4px;">다운로드 <i class="xi-download" style="font-size:16px; vertical-align:-1px;"></i> </p>
                                        -->
                                    </a>

                            </div>
                    </div>
                </li>
            <?php } ?>
            <?php if (count($list) == 0) { echo "<li class=\"empty_list\">게시물이 없습니다.</li>"; } ?>
        </ul>
    </div>

</form>

<?php if($is_checkbox) { ?>
    <noscript>
        <p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
    </noscript>
<?php } ?>

<!-- 페이지 -->
<?php echo $write_pages; ?>


<?php if ($is_checkbox) { ?>
    <script>
        function all_checked(sw) {
            var f = document.fboardlist;

            for (var i=0; i<f.length; i++) {
                if (f.elements[i].name == "chk_wr_id[]")
                    f.elements[i].checked = sw;
            }
        }

        function fboardlist_submit(f) {
            var chk_count = 0;

            for (var i=0; i<f.length; i++) {
                if (f.elements[i].name == "chk_wr_id[]" && f.elements[i].checked)
                    chk_count++;
            }

            if (!chk_count) {
                alert(document.pressed + "할 게시물을 하나 이상 선택하세요.");
                return false;
            }

            if(document.pressed == "선택복사") {
                select_copy("copy");
                return;
            }

            if(document.pressed == "선택이동") {
                select_copy("move");
                return;
            }

            if(document.pressed == "선택삭제") {
                if (!confirm("선택한 게시물을 정말 삭제하시겠습니까?\n\n한번 삭제한 자료는 복구할 수 없습니다\n\n답변글이 있는 게시글을 선택하신 경우\n답변글도 선택하셔야 게시글이 삭제됩니다."))
                    return false;

                f.removeAttribute("target");
                f.action = g5_bbs_url+"/board_list_update.php";
            }

            return true;
        }

        // 선택한 게시물 복사 및 이동
        function select_copy(sw) {
            var f = document.fboardlist;

            if (sw == 'copy')
                str = "복사";
            else
                str = "이동";

            var sub_win = window.open("", "move", "left=50, top=50, width=500, height=550, scrollbars=1");

            f.sw.value = sw;
            f.target = "move";
            f.action = g5_bbs_url+"/move.php";
            f.submit();
        }

        // 게시판 리스트 관리자 옵션
        jQuery(function($){
            $(".btn_more_opt.is_list_btn").on("click", function(e) {
                e.stopPropagation();
                $(".more_opt.is_list_btn").toggle();
            });
            $(document).on("click", function (e) {
                if(!$(e.target).closest('.is_list_btn').length) {
                    $(".more_opt.is_list_btn").hide();
                }
            });
        });
    </script>
<?php } ?>
<!-- 게시판 목록 끝 -->
