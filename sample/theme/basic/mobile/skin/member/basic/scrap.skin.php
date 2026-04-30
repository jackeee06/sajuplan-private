<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가


include_once(G5_LIB_PATH . '/counsel_flag.lib.php'); //심리 노출 제어 작업 시작 20250908

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="' . $member_skin_url . '/style.css">', 0);

// 카테고리별 배경이미지 Class
$cate_bg = array('타로' => 'tarot', '신점' => 'sinjeom', '사주' => 'saju', '심리' => 'simli');
?>


<style>
    .empty_list {
        width: 100%;
        float: left;
        padding: 100px 0 !important;
    }

    .top_nav_01 {
        border-color: #465bf0 !important;
        color: #465bf0;
        font-weight: 600;
    }
</style>


<!--
<div class="top_nav" style="">
	<a href="<?php /*echo G5_BBS_URL */ ?>/scrap.php"><ul class="on">타로</ul></a>
	<a href="<?php /*echo G5_BBS_URL */ ?>/scrap.php"><ul>신점</ul></a>
	<a href="<?php /*echo G5_BBS_URL */ ?>/scrap.php"><ul>사주</ul></a>
	<a href="<?php /*echo G5_BBS_URL */ ?>/scrap.php"><ul>심리</ul></a>
</div>-->
<?php
//전체 카테고리
$all_cats = ['타로', '신점', '사주', '심리'];

$hidden = function_exists('cs_hidden_cats') ? cs_hidden_cats() : []; // ['심리'] 또는 []
$visible_cats = array_values(array_diff($all_cats, $hidden));        // 전체 - 숨김 = 보임

//현재 선택 카테고리 (?ca = 타로 형태),  없으면 첫 번째 표시 카테고리

$req = $_GET['ca'] ??'';
$ca = in_array($req, $visible_cats, true) ? $req : null;
?>
<!--20250909 추가-->
<script>
    window.VISIBLE_CATS = <?php echo json_encode($visible_cats, JSON_UNESCAPED_UNICODE); ?>;
    window.RESOLVED_CA  = <?php echo json_encode($ca,           JSON_UNESCAPED_UNICODE); ?>;
</script>
<!--20250909 추가-->



<!--
<div class="list_filter_wrap">
	<div class="list_title">단골 상담사</div>
</div>
-->

<div id="res_list" class="">

</div>

<script type="text/javascript">

    $(document).ready(function () {
        <!--20250909 추가-->

        <!--20250909 추가-->

        load_res_list();
        setInterval(load_res_list, 15000);
    });

    function load_res_list() {
        const queryParams = getQueryParams(); // 현재 GET 값들

        // 20250909 서버가 확정한 카테고리로 강제 세팅
        if (window.RESOLVED_CA &&
            Array.isArray(window.VISIBLE_CATS) &&
            window.VISIBLE_CATS.indexOf(window.RESOLVED_CA) !== -1) {
            // URL로 ca가 들어온 경우에만 해당 카테고리로 제한
            queryParams['ca'] = window.RESOLVED_CA;
        } else {
            // 기본은 전체 조회 (숨김은 서버에서 필터)
            delete queryParams['ca'];
        }
        // 20250909 서버가 확정한 카테고리로 강제 세팅



        $.ajax({
            url: './ajax.scrap_list.php',
            type: 'POST',
            data: queryParams, // GET 파라미터를 POST로 전달
            dataType: 'json',
            success: function (response) {
                if (
                    $('#res_list').html().replace(/\s/g, '') !==
                    $('<div>').html(response.html).html().replace(/\s/g, '')

                ) {
                    $('#res_list').html(response.html);
                    console.log('not same');
                } else {
                    console.log('same');
                }
            },
            error: function (xhr, status, error) {
                console.error('에러 발생:', error);
            }
        });
    }

    function getQueryParams() {
        const params = {};
        const queryString = window.location.search.slice(1); // "a=1&b=2"
        const pairs = queryString.split("&");

        for (let pair of pairs) {
            if (!pair) continue;
            const [key, value] = pair.split("=");
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }

        return params;
    }

    function scrap_submit(wr_id) {
//var param = $("form[name=f_scrap_popin]").serialize();
        $.ajax({
            url: g5_bbs_url + "/scrap_popin_update.php",
            type: "POST",
            data: {bo_table: 'counselor', wr_id: wr_id},
            success: function (data) {
                //alert("성공");
                console.log(data);
                var a_comment = /<noscript>(([\s\S]+?[\s\S]))<\/p>/.exec(data);
                if (a_comment != null) {
                    var content = String(a_comment[1].trim());
                    content = content.substring(3, content.length);
                    alert(content);

                    $('#scrap_icon_' + wr_id).attr("src", "/img/common/list_icon_scrap_on.png");
                }
            },
            error: function (data) {
                alert("error");
            }
        });
    }
</script>
