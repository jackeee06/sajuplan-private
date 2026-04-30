<ul class="haed_menu">
    <li class="push">
        <!--20250804 eun 푸시알림 new bounce 적용 시작-->
        <span class="dot">NEW</span>
        <!--20250804 eun 푸시알림 new bounce 적용 마감-->
        <a href="<?php echo G5_URL ?>/sub/push_list.php">
            <img src="<?php echo G5_URL ?>/img/head/push_w.png" />
        </a>
    </li>
</ul>

<div class="search">
    <button type="button" id="user_btn" class="hd_opener" style=""><img src="../../../img/head/search_w.png" /></button>
    <div class="hd_div" id="user_menu">
        <button type="button" id="user_close" class="hd_closer">
            <span class="sound_only">메뉴 닫기</span>
            <img src="../../../img/head/icon_back.png" style="width:24px;" title="">
        </button>
        <div id="hd_sch">
            <h2>사이트 내 전체검색</h2>
            <form name="fsearchbox" action="<?php echo G5_BBS_URL ?>/search.php" onsubmit="return fsearchbox_submit(this);" method="get">
                <input type="hidden" name="sfl" value="wr_subject||wr_content">
                <input type="hidden" name="sop" value="and">
                <input type="text" name="stx" id="sch_stx" placeholder="상담사를 입력해주세요." required maxlength="20">
                <button type="submit" value="검색" id="sch_submit"><img src="../img/head/search.png"><span class="sound_only">검색</span></button>
            </form>

            <script>
                function fsearchbox_submit(f)
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

                    return true;
                }
            </script>
        </div>
        <?php echo popular('theme/basic'); // 인기검색어 ?>



        <script>
            $(function () {

                $(".hd_opener").on("click", function() {
                    var $this = $(this);
                    var $hd_layer = $this.next(".hd_div");

                    if($hd_layer.is(":visible")) {
                        $hd_layer.hide();
                        $this.find("span").text("열기");
                    } else {
                        var $hd_layer2 = $(".hd_div:visible");
                        $hd_layer2.prev(".hd_opener").find("span").text("열기");
                        $hd_layer2.hide();

                        $hd_layer.show();
                        $this.find("span").text("닫기");
                    }
                });

                $("#container").on("click", function() {
                    $(".hd_div").hide();

                });

                $(".btn_gnb_op").click(function(){
                    $(this).toggleClass("btn_gnb_cl").next(".gnb_2dul").slideToggle(300);
                });

                $(".hd_closer").on("click", function() {
                    var idx = $(".hd_closer").index($(this));
                    $(".hd_div:visible").hide();
                    $(".hd_opener:eq("+idx+")").find("span").text("열기");
                });
            });
        </script>
    </div>
</div>