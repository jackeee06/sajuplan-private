<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$member_skin_url.'/style.css">', 0);

// 카테고리별 배경이미지 Class
$cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');
?>

<style>
.empty_list { width:100%; float:left; padding:100px 0 !important;}

.top_nav_01 {
    border-color: #465bf0 !important;
    color: #465bf0;
    font-weight: 600;
}
</style>
<!---->
<!-- 단골상담사 탭메뉴 -->
<?php //include_once(G5_PATH.'/include/scrap_navi.php'); ?>

<!--
<div class="top_nav" style="">
	<a href="<?php echo G5_BBS_URL ?>/scrap.php"><ul class="on">타로</ul></a>
	<a href="<?php echo G5_BBS_URL ?>/scrap.php"><ul>신점</ul></a>
	<a href="<?php echo G5_BBS_URL ?>/scrap.php"><ul>사주</ul></a>
	<a href="<?php echo G5_BBS_URL ?>/scrap.php"><ul>심리</ul></a>
</div>
-->
<!--
<div class="list_filter_wrap">
	<div class="list_title">단골 상담사</div>
</div>   
--> 
<div id="res_list" class="">
</div>


<script>

$(document).ready(function() {
load_res_list();
setInterval(load_res_list, 15000);
});

function load_res_list() {
  const queryParams = getQueryParams(); // 현재 GET 값들
  $.ajax({
    url: './ajax.recommend_list.php',
    type: 'POST',
    data: queryParams, // GET 파라미터를 POST로 전달
    dataType: 'json', 
    success: function(response) {
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
    error: function(xhr, status, error) {
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
</script>