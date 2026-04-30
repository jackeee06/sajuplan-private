<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$qa_skin_url.'/style.css">', 0);
?>

<form name="fqalist" id="fqalist" action="./qadelete.php" onsubmit="return fqalist_submit(this);" method="post">
<input type="hidden" name="stx" value="<?php echo $stx; ?>">
<input type="hidden" name="sca" value="<?php echo $sca; ?>">
<input type="hidden" name="page" value="<?php echo $page; ?>">
<input type="hidden" name="token" value="<?php echo get_text($token); ?>">

<style>
/* ===== QA 리스트 리디자인 ===== */
#fqalist, #fqalist *, #fqalist *::before, #fqalist *::after { box-sizing: border-box; }
#fqalist { width: 100%; max-width: 100%; }
#bo_list { width: 100%; }
.fix_btn.write_btn { display: none !important; }
.sound_only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* FAQ 배너 */
.qa_faq_banner {
    background: #8259f5;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.qa_faq_banner .banner_text { flex: 1; min-width: 0; }
.qa_faq_banner .banner_title { font-size: 14px; font-weight: 700; color: #fff; }
.qa_faq_banner .banner_sub { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }
.qa_faq_link {
    flex-shrink: 0;
    padding: 7px 14px;
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    text-decoration: none;
    white-space: nowrap;
}

/* 카테고리 탭 */
#bo_cate { background: #fff; border-bottom: 1px solid #eee; padding: 0; overflow: visible !important; }
#bo_cate h2 { display: none; }
#bo_cate_ul {
    display: flex !important;
    list-style: none !important;
    margin: 0 !important; padding: 0 !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    flex-wrap: nowrap !important;
}
#bo_cate_ul::-webkit-scrollbar { display: none; }
#bo_cate_ul li {
    flex-shrink: 0 !important;
    display: list-item !important;
    visibility: visible !important;
    opacity: 1 !important;
    height: auto !important;
    width: auto !important;
    max-height: none !important;
    overflow: visible !important;
    position: static !important;
}
#bo_cate_ul li a {
    display: block !important;
    padding: 8px 14px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #999 !important;
    text-decoration: none !important;
    white-space: nowrap !important;
    border-bottom: 2.5px solid transparent !important;
    visibility: visible !important;
    opacity: 1 !important;
    height: auto !important;
    width: auto !important;
    position: static !important;
    overflow: visible !important;
    clip: auto !important;
}
#bo_cate_ul li a:hover,
#bo_cate_ul li a#bo_cate_on {
    color: #8259f5 !important;
    border-bottom-color: #8259f5 !important;
}

/* 검색 영역 */
.qa_search_area {
    background: #fff;
    padding: 10px 16px;
    border-bottom: 1px solid #eee;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    align-items: center !important;
    width: 100% !important;
}
.qa_search_area > * {
    float: none !important;
}
.qa_search_area select {
    flex: 0 0 60px !important;
    width: 60px !important;
    padding: 9px 2px !important;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    font-size: 13px;
    color: #555;
    background: #fafafa;
    outline: none;
}
.qa_search_area select:focus { border-color: #8259f5; }
.qa_search_area .sch_input {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    width: auto !important;
    padding: 9px 10px !important;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: #fafafa;
}
.qa_search_area .sch_input:focus { border-color: #8259f5; background: #fff; }
.qa_search_area .sch_btn {
    flex: 0 0 38px !important;
    width: 38px !important;
    height: 38px !important;
    background: #8259f5;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
    margin: 0 !important;
}

/* 목록 카운트 */
#bo_list_total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    font-size: 12px;
    color: #999;
    background: #f5f5f7;
    border-bottom: 1px solid #eee;
}
#bo_list_total span { font-weight: 700; color: #666; }

/* 전체선택 */
.all_chk.chk_box {
    display: flex; align-items: center;
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #eee;
    font-size: 13px;
}
.all_chk .btn {
    margin-left: auto;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    background: #ff5252;
    color: #fff;
    border: none;
    font-weight: 600;
}

/* 기존 list_01 숨김 */
.list_01 { display: none !important; }

/* 리스트 */
.qa_list_wrap { background: #f5f5f7; padding: 8px 0; }
.qa_list_wrap ul { list-style: none; margin: 0; padding: 0; }

.qa_item {
    background: #fff;
    margin: 0 10px 6px;
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid #eee;
}

/* 상태 뱃지 */
.qa_status_badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 6px;
}
.qa_status_badge.done { background: #e8f5e9; color: #2e7d32; }
.qa_status_badge.wait { background: #fff3e0; color: #e65100; }

/* 제목 */
.qa_subject {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #333;
    text-decoration: none;
    line-height: 1.5;
    margin-bottom: 6px;
    word-break: break-all;
}

/* 메타 */
.qa_meta {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; color: #aaa; flex-wrap: wrap;
}
.qa_meta .qa_cate {
    background: #f3efff; color: #8259f5;
    padding: 1px 7px; border-radius: 3px;
    font-weight: 600; font-size: 11px;
}
.qa_meta .qa_dot { color: #ddd; }

/* 빈 리스트 */
.qa_empty {
    text-align: center; padding: 50px 20px;
    color: #bbb; font-size: 14px;
    background: #fff; margin: 0 10px;
    border-radius: 10px; border: 1px solid #eee;
}

/* 페이징 */
.qa_paging {
    text-align: center;
    padding: 14px 10px 16px;
    background: #f5f5f7;
}
.qa_paging a, .qa_paging strong {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 30px; height: 30px;
    border-radius: 6px; font-size: 13px; font-weight: 600;
    text-decoration: none; color: #888;
    background: #fff; border: 1px solid #eee; margin: 0 2px;
}
.qa_paging strong { background: #8259f5; color: #fff; border-color: #8259f5; }

/* 문의하기 버튼 */
.qa_write_btn_wrap {
    padding: 16px;
    background: #fff;
}
.qa_write_btn_wrap a {
    display: block;
    text-align: center;
    width: 100%;
    padding: 15px 0;
    background: #8259f5;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
    border-radius: 10px;
}
.qa_write_btn_wrap a:active { background: #6b3fe4; }

/* 하단 버튼 공간 제거 */
#bo_list { padding-bottom: 0; }

/* 기존 bo_sch 숨김 */
#bo_sch { display: none !important; }
</style>

<!-- FAQ 배너 -->
<div class="qa_faq_banner">
    <div class="banner_text">
        <div class="banner_title">궁금하신 점이 있으신가요?</div>
        <div class="banner_sub">자주하는 질문에서 빠르게 확인하세요</div>
    </div>
    <a href="../bbs/board.php?bo_table=c_faq" class="qa_faq_link">바로가기</a>
</div>

<div id="bo_list">
    <?php if ($category_option) { ?>
    <nav id="bo_cate">
        <h2><?php echo $qaconfig['qa_title'] ?> 카테고리</h2>
        <ul id="bo_cate_ul">
            <?php echo $category_option ?>
        </ul>
    </nav>
    <?php } ?>

    <!-- 검색 (JS 방식 - 중첩 폼 방지) -->
    <div class="qa_search_area">
        <select id="sch_sfl">
            <?php echo get_qa_sfl_select_options($sfl); ?>
        </select>
        <input type="text" id="sch_stx" value="<?php echo stripslashes($stx) ?>" placeholder="검색어를 입력하세요" class="sch_input" size="15" maxlength="15" onkeypress="if(event.keyCode==13){qa_search();return false;}">
        <button type="button" onclick="qa_search();" class="sch_btn"><i class="fa fa-search" aria-hidden="true"></i></button>
    </div>

    <div id="bo_list_total">
        <span>전체 <?php echo number_format($total_count) ?>건</span>
        <?php echo $page ?> 페이지
    </div>

    <?php if ($is_checkbox) { ?>
    <div class="all_chk chk_box">
        <input type="checkbox" id="chkall" onclick="if (this.checked) all_checked(true); else all_checked(false);" class="selec_chk">
        <label for="chkall">
            <span></span>
            <b class="sound_only">현재 페이지 게시물 </b> 전체선택
        </label>
        <button type="submit" name="btn_submit" value="선택삭제" class="btn" onclick="document.pressed=this.value"><i class="fa fa-trash-o" aria-hidden="true"></i> 선택삭제</button>
    </div>
    <?php } ?>

    <!-- 숨김 처리 (체크박스 폼용) -->
    <div class="list_01">
        <ul>
            <?php for ($i=0; $i<count($list); $i++) { ?>
            <li>
                <?php if ($is_checkbox) { ?>
                <div class="bo_chk chk_box">
                    <input type="checkbox" name="chk_qa_id[]" value="<?php echo $list[$i]['qa_id'] ?>" id="chk_qa_id_<?php echo $i ?>" class="selec_chk">
                    <label for="chk_qa_id_<?php echo $i ?>"><span></span></label>
                </div>
                <?php } ?>
            </li>
            <?php } ?>
        </ul>
    </div>

    <!-- 문의 목록 -->
    <div class="qa_list_wrap">
        <ul>
            <?php for ($i=0; $i<count($list); $i++) { ?>
            <li class="qa_item">
                <span class="qa_status_badge <?php echo ($list[$i]['qa_status'] ? 'done' : 'wait'); ?>">
                    <?php echo ($list[$i]['qa_status'] ? '답변완료' : '답변대기'); ?>
                </span>
                <a href="<?php echo $list[$i]['view_href']; ?>" class="qa_subject">
                    <?php echo $list[$i]['subject']; ?>
                    <?php if ($list[$i]['icon_file']) echo ' <i class="fa fa-download" aria-hidden="true"></i>'; ?>
                </a>
                <div class="qa_meta">
                    <?php if ($list[$i]['category']) { ?>
                    <span class="qa_cate"><?php echo $list[$i]['category']; ?></span>
                    <?php } ?>
                    <span><?php echo $list[$i]['name']; ?></span>
                    <span class="qa_dot">·</span>
                    <span><?php echo $list[$i]['date']; ?></span>
                </div>
            </li>
            <?php } ?>
            <?php if ($i == 0) { ?>
            <li class="qa_empty">게시물이 없습니다.</li>
            <?php } ?>
        </ul>
    </div>

    <!-- 페이징 -->
    <div class="qa_paging">
    <?php echo $list_pages; ?>
    </div>

    <!-- 문의하기 버튼 -->
    <?php if ($write_href) { ?>
    <div class="qa_write_btn_wrap">
        <a href="<?php echo $write_href ?>">문의하기</a>
    </div>
    <?php } ?>

</div>
</form>

<?php if($is_checkbox) { ?>
<noscript>
<p>자바스크립트를 사용하지 않는 경우<br>별도의 확인 절차 없이 바로 선택삭제 처리하므로 주의하시기 바랍니다.</p>
</noscript>
<?php } ?>

<!-- 기존 검색 삭제됨 -->

<script>
function qa_search() {
    var sfl = document.getElementById('sch_sfl').value;
    var stx = document.getElementById('sch_stx').value.trim();
    var url = './qalist.php?sca=<?php echo urlencode($sca) ?>&sop=and';
    if (stx) url += '&sfl=' + encodeURIComponent(sfl) + '&stx=' + encodeURIComponent(stx);
    location.href = url;
}
</script>

<?php if ($is_checkbox) { ?>
<script>
function all_checked(sw) {
    var f = document.fqalist;
    for (var i=0; i<f.length; i++) {
        if (f.elements[i].name == "chk_qa_id[]")
            f.elements[i].checked = sw;
    }
}

function fqalist_submit(f) {
    var chk_count = 0;
    for (var i=0; i<f.length; i++) {
        if (f.elements[i].name == "chk_qa_id[]" && f.elements[i].checked)
            chk_count++;
    }
    if (!chk_count) {
        alert(document.pressed + "할 게시물을 하나 이상 선택하세요.");
        return false;
    }
    if(document.pressed == "선택삭제") {
        if (!confirm("선택한 게시물을 정말 삭제하시겠습니까?\n\n한번 삭제한 자료는 복구할 수 없습니다"))
            return false;
    }
    return true;
}
</script>
<?php } ?>