<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가

function find_banner_asset_evt($bn_id)
{
    $dir = G5_DATA_PATH . '/banner';
    $url = G5_DATA_URL . '/banner';
    foreach (['webp', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'mp4'] as $ext) {
        $p = "{$dir}/{$bn_id}.{$ext}";
        if (is_file($p)) return [$p, "{$url}/{$bn_id}.{$ext}", $ext];
    }
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
?>
<!--20250805 eun 이벤트 배너 뜨도록 작업 시작-->
<style>
    .main-banner .swiper-pagination-bullet{width: 6px; height: 6px; background: #000; opacity: 0.3;}
    .main-banner .swiper-pagination-bullet-active{width: 12px; background: #f1564d; opacity: 1; border-radius:50px;}
    /* 메인 배너 비디오에 포인터 이벤트 비활성화 */
    .swiper-slide video {pointer-events: none;}


    /* 이미지의 경우 object-fit: contain;로 비율 유지하며 크기 축소 */
    .main-banner .swiper-slide img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: contain; /* 이미지 크기를 배너에 맞게 축소 */
    }


    /* aspect-ratio 지원 브라우저용 */
    .main-banner {
        width: 100%;
        aspect-ratio: 25 / 13;
        overflow: hidden;
    }

    /* 레거시 브라우저용 패딩 트릭 */
    .main-banner {
        position: relative;
        width: 100%;
    }
    .main-banner::before {
        content: "";
        display: block;
        /* 13 ÷ 25 × 100 = 52% */
        padding-top: 52%;
    }
    .main-banner .swiper-wrapper {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
    }
    .swiper-horizontal>.swiper-pagination-bullets .swiper-pagination-bullet, .swiper-pagination-horizontal.swiper-pagination-bullets .swiper-pagination-bullet {margin: 0 var(--swiper-pagination-bullet-horizontal-gap, 1.5px);}
</style>

<div class="swiper">
    <div class="swiper-wrapper">
        <?php
        // if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
        //     echo " [EVT_BANNER] sql=".htmlspecialchars($sql ?? '(undefined)', ENT_QUOTES)." \n";
        //     echo " [EVT_BANNER] result=".($result ? 'OK, rows='.sql_num_rows($result) : 'FAIL/NULL')."\n";
        // }
        while ($row = sql_fetch_array($result)) {


            $bimg = G5_DATA_PATH . '/banner/' . $row['bn_id'];
            $bn_filename = $row['bn_id'];
            if(!file_exists($bimg)) {
                $found = glob($bimg . '.*');
                if($found) {
                    $bimg = $found[0];
                    $bn_filename = basename($bimg);
                }
            }
            // if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
            //     echo "[EVT_BANNER] bn_id={$row['bn_id']}, bn_filename={$bn_filename}, bimg={$bimg}, exists=".(file_exists($bimg)?'YES':'NO')."\n";
            // }

            if (!file_exists($bimg)) continue;



            // 1) 파일 확장자/ MIME 먼저 검사
            $ext = strtolower(pathinfo($bimg, PATHINFO_EXTENSION));
            $mime = function_exists('mime_content_type')
                ? mime_content_type($bimg)
                : '';

            echo '<div class="swiper-slide">';

            // 링크 오픈
            $banner = '';
            if ($row['bn_url'][0] === '#') {
                $banner = '<a href="' . $row['bn_url'] . '">';
            } elseif ($row['bn_url'] && $row['bn_url'] !== 'http://') {
                $banner = '<a href="' . G5_SHOP_URL . '/bannerhit.php?bn_id=' . $row['bn_id'] . '"'
                    . ($row['bn_new_win'] ? ' target="_blank"' : '')
                    . '>';
            }
            echo $banner;

            // 2) 동영상 분기: mp4면 곧바로 <video>
            if ($ext === 'mp4' || $mime === 'video/mp4') {
                echo '<video autoplay muted loop playsinline ">'
                    . '<source src="' . G5_DATA_URL . '/banner/' . $bn_filename
                    . '" type="video/mp4">'
                    . '이 브라우저는 비디오를 지원하지 않습니다.'
                    . '</video>';
            }
            
            // 3) 이미지 분기: 그 외에만 getimagesize 검사
            else {
                $size = @getimagesize($bimg);
                if ($size && $size[2] >= 1 && $size[2] <= 16) {
                    // (기존 이미지 최대 크기 업데이트 로직이 필요하다면 여기)
                    echo '<img src="' . G5_DATA_URL . '/banner/' . $bn_filename . '"'
                        . ' alt="메인배너"'
                        . ($row['bn_border'] ? ' class="sbn_border"' : '')
                        . ' style="width:100%;" />';
                }
                // getimagesize 실패하면 슬라이드 닫고 continue
                else {
                    echo '</a></div>';
                    continue;
                }
            }

            // 4) 링크 닫기 & 슬라이드 닫기
            if ($banner) echo '</a>';
            echo '</div>';

        }
        ?>
    </div>
    <div class="swiper-pagination"></div>
</div>


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
<!--메인배터 이벤트 스킨-->
