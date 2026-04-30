<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가


function find_banner_asset($bn_id)
{
    $dir = G5_DATA_PATH . '/banner';
    $url = G5_DATA_URL . '/banner';
// 우선순위: webp → jpg → jpeg → png → gif → bmp → mp4
    foreach (['webp', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'mp4'] as $ext) {
        $p = "{$dir}/{$bn_id}.{$ext}";
        if (is_file($p)) return [$p, "{$url}/{$bn_id}.{$ext}", $ext];
    }
// 레거시(무확장자) 호환
    $legacy = "{$dir}/{$bn_id}";
    if (is_file($legacy)) return [$legacy, "{$url}/{$bn_id}", ''];
    return [null, null, null];
}
// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.G5_MSHOP_SKIN_URL.'/style.css">', 0);
add_javascript('<script src="'.G5_JS_URL.'/owlcarousel/owl.carousel.min.js"></script>', 10);
add_stylesheet('<link rel="stylesheet" href="'.G5_JS_URL.'/owlcarousel/owl.carousel.min.css">', 10);



$max_width = $max_height = 0;
$bn_first_class = ' class="bn_first"';
$bn_slide_btn = '';
$bn_sl = ' class="bn_sl"';
$main_banners = array();

//20250909 소원다락방 배너 크기 줄어든 것 작업 시작
$__bo_table = isset($bo_table) ? $bo_table : (isset($_GET['bo_table']) ? $_GET['bo_table'] : '');
$is_wish = ($__bo_table === 'wish');
//20251120 후기 배너
$is_counselor = ($__bo_table === 'counselor'); // 추가
$is_main = defined('_INDEX_'); // 메인 페이지 여부
//20250909 소원다락방 배너 크기 줄어든 것 작업 마감
?>
<!--20250721 eun 메인배너 비주얼 배너 mp4 뜨도록 작업 시작-->
<style>
    /* 페이지네이션 불릿 */
    .main-banner .swiper-pagination-bullet { width:6px; height:6px; background:#e3e3e3; opacity:0.3; }
    .main-banner .swiper-pagination-bullet-active { width:12px; background:#FFFFFF; opacity:1; border-radius:50px; }
    .swiper-horizontal>.swiper-pagination-bullets .swiper-pagination-bullet,
    .swiper-pagination-horizontal.swiper-pagination-bullets .swiper-pagination-bullet { margin: 0 1.5px; }
    /* 메인 배너 비디오에 포인터 이벤트 비활성화 */
    .swiper-slide video {pointer-events: none;}
    .main-banner .swiper-slide img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover !important; /* 이미지 크기를 배너에 맞게 축소 */
        border-radius: 20px;
    }

    /* 비디오의 경우 object-fit: cover;로 배너 크기에 맞춰 꽉 차도록 */
    .main-banner .swiper-slide video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover; /* 비디오 크기를 배너에 맞게 꽉 차게 설정 */
        border-radius: 20px;
    }
    /* aspect-ratio 지원 브라우저용 */
    .main-banner {
        width: 100%;
        aspect-ratio: 380 / 100 !important;
        overflow: hidden;
    }
</style>
<!--20250909 eun 소원다락방 배너 크기 맞추는 작업 시작-->
<?php if ($is_wish): ?>
    <style>
        /*  wish에서는 이미지 높이를 원본 비율로, 컨테이너 강제비율 삭제 */
        .main-banner.is-wish::before{ display:none !important; padding-top:0 !important; }
        .main-banner.is-wish{ aspect-ratio:auto !important; }

        /* 스와이퍼 내부가 절대배치로 고정되어 있어 높이가 0이 되는 문제 방지 */
        .main-banner.is-wish .swiper-wrapper{ position:static !important; width:100% !important; height:auto !important; }
        .main-banner.is-wish .swiper-slide{ position:static !important; }

        /* 이미지: 가로 100%, 세로 auto(원본비율), 라인박스 여백 제거 */
        .main-banner.is-wish .swiper-slide img{
            position:static !important;
            width:100% !important;
            height:auto !important;
            object-fit:initial !important;
            display:block;
        }
    </style>
<?php endif; ?>
<!--20250909 eun 소원다락방 배너 크기 맞추는 작업 마감-->

<!--<div class="swiper main-banner--><?php //echo $is_wish ? ' is-wish' : ''; ?><!--">-->
<div class="main_slide_wr">
    <div class="swiper<?php echo $is_main ? ' main-banner' : ''; ?><?php echo $is_wish ? ' is-wish' : ''; ?>">
        <!--20250909 eun 소원다락방 배너 크기 맞추는 작업 마감-->

        <!-- 메인 배너 비율 : 380px * 100px -->
        <div class="swiper-wrapper">
            <?php

            while ($row = sql_fetch_array($result)) {

                // 실제 파일(확장자 포함) 찾기
                list($path, $src, $ext) = find_banner_asset($row['bn_id']);
                if (!$path) continue;

                echo '<div class="swiper-slide">';

                // 링크 열기 (안전하게)
                $bn_url = $row['bn_url'] ?? '';
                $open = '';
                if (substr($bn_url, 0, 1) === '#') {
                    $open = '<a href="'.$bn_url.'">';
                } elseif ($bn_url && $bn_url !== 'http://') {
                    $target = !empty($row['bn_new_win']) ? ' target="_blank"' : '';
                    $open = '<a href="'.G5_SHOP_URL.'/bannerhit.php?bn_id='.$row['bn_id'].'"'.$target.'>';
                }
                echo $open;

                // 타입별 출력
                if ($ext === 'mp4') {
                    echo '<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block">'
                        .   '<source src="'.$src.'" type="video/mp4">'
                        .   '이 브라우저는 비디오를 지원하지 않습니다.'
                        . '</video>';
                } else {
                    $alt = htmlspecialchars($row['bn_alt'] ?: '메인배너', ENT_QUOTES);
                    $cls = !empty($row['bn_border']) ? ' class="sbn_border"' : '';
                    echo '<img src="'.$src.'" alt="'.$alt.'"'.$cls.' style="width:100%;height:100%;display:block">';
                }

                if ($open) echo '</a>';
                echo '</div>';
            }
            ?>

        </div>
        <div class="swiper-pagination main-banner-pagination"></div>
        <!-- swiper-pagination 클래스 필수: Swiper가 이 클래스로 불릿을 렌더링함 -->
    </div>
</div>


<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>

<!-- 메인배너 -->

<!-- Swiper JS -->
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>

<!-- Initialize Swiper -->
<script>
    var swiper = new Swiper('.main-banner', {
        loop: true,               // 무한 루프
        autoplay: {
            delay: 5000,            // 5초마다 자동 전환
            disableOnInteraction: false  // 사용자가 슬라이드를 변경해도 자동 재생 유지
        },
        pagination: {
            el: '.swiper-pagination',  // 페이지네이션
            clickable: true            // 페이지네이션 클릭 가능
        }
    });
</script>
<!--20250721 eun 메인배너 mp4 뜨도록 작업 마감-->
