<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "알림 내역";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 

####################################################################

$sql_common = " from member_push ";
$sql_search = " where (1)  ";

if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'kind' :
			$sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '%{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if($member["mb_id"]){
    // mt_level에 따른 gubun 필터링
    // mt_level = 2 (일반회원): gubun 1,2,10
    // mt_level = 5 (상담사): gubun 5,10
    // 기타: 전체
    if($member["mb_level"] == '2'){
        // 일반회원: 개인 전송 또는 (all + gubun 1,2,10)
        $sql_search .=" 
        and ( 
          id= '".$member["mb_id"]."' 
          or 
          (id='all' and gubun in ('1','2','10'))
        )";
    } else if($member["mb_level"] == '5'){
        // 상담사: 개인 전송 또는 (all + gubun 5,10)

        $sql_search .=" 
        and ( 
          id= '".$member["mb_id"]."' 
          or 
          (id='all' and gubun in ('5','10'))
        )";
    } else {
        // 기타: 기존 로직 (전체)
        $sql_search .=" 
        and ( 
          id='all' or id= '".$member["mb_id"]."'   
        )";
    }


}else{

	$sql_search .=" 
    and 
      ( 
       id='all' 
       and
       (
        gubun = '10'
       )
    )";

}
if (!$sst) {
    $sst  = "regdate";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt
            {$sql_common}
            {$sql_search}
            {$sql_order} ";

$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select *
            {$sql_common}
            {$sql_search}
            {$sql_order}
            limit {$from_record}, {$rows} ";

$result = sql_query($sql);
 
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<?php //include_once(G5_PATH.'/include/guide.php'); ?>
<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php //include_once(G5_PATH.'/include/guide.php'); ?>

  <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">

<!-- BODY 회색으로 변경  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_body.css">
-->

<!-- 메인화면 시작 -->

<style>
/*  자주가는 장소 CSS */


.my_con { background-color:#fff;}
.my_push { position:relative; padding: 15px; border-bottom: 1px solid #eee;}

.my_push .push_btn { position:absolute; top:50%; transform:translateY(-50%); right:20px; font-size:20px; color:#999;  }

.my_push .date {color:#999; font-size:14px; padding-right:30px; position:relative;}
.my_push .today { color:#F00 !important; font-weight:800 !important;}

.my_push .title {width:100%; float:left; font-size:14px; line-height:1.6; color:#000; font-weight:600;}
.my_push .title p {display:inline-block;}
.my_push .title p.call {color:#F90; }
.my_push .title p.event {color:#2e3192; }

.my_push .text {width:calc(100%); float:left; line-height:1.3; padding:6px 36px 6px 0; font-size:16px; color:#000; background-position:10px; background-repeat:repeat-y; font-weight:600;}
.my_push .call_bg { /*background-image:url(../images/common/dot_02.png);*/}
.my_push .event_bg { /*background-image:url(../images/common/dot_03.png);*/}
.my_push .text p {margin-top:5px; font-weight:400; color:#444; font-size:12px; line-height:160%;}
.my_push .text p.btn { border-radius:50px; border:2px solid #2e3192; text-align:center; display:block; line-height:50px; height:50px; font-weight:600; color:#2e3192; font-size:16px; margin-top:10px;}
</style>


<div class="gray_noti" style="background-color:#fff; padding:15px; color:#666; text-align:left; border-bottom:10px solid #f5f5f5;">
	최근 6개월 동안의 알림을 확인하실 수 있습니다.
</div>

<div class="">


 <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        $bg = 'bg'.($i%2);


		$sql3 = "select  is_view from member_push where idx='".$row["idx"]."' and is_view not like '%".$member["mb_id"]."%'";
		$result3 = sql_query($sql3);
		if($result3){
			$res3 = sql_fetch_array($result3);
			if($res3["is_view"]=="" || $res3["is_view"]){ /// 한번도 클릭하지 않았으면? id 업데이트
					if($res3["is_view"]){
						$ud  = $res3["is_view"].",".$member["mb_id"];
					}else{
						$ud = $member["mb_id"];
					}
					$sql3 = "update member_push set is_view='".$ud."' where idx='".$row["idx"]."'";
					@sql_query($sql3);
			}
		}

    ?>
		<a href="<?=$row["url"]?>" onclick="up_alclick('<?=$row["idx"]?>');">
			<div class="my_push">
						
				<ul class="title">
					<p class="event">뉴스&amp;공지 알림</p>
				</ul>

				<ul class="text event_bg">
					<?=$row["title"]?>
				</ul>
				
				<ul class="date"><?=$row["regdate"]?></ul>
				
				 <p class="push_btn"><i class="xi-angle-right"></i></p>
				
			</div>
			</a>



	 <?php
    }

    if ($i == 0){
        echo "<div style=\"padding:50px 0; text-align:center; color:#999; font-size:14px;\">수신된 알림이 없습니다.</div>";
	}
    ?>
	<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;&hid=push_list&page='); ?>

    
    

</div>
 


<!-- 화면 끝 -->


<script>

function up_alclick(idx){

if(idx){
        $.ajax({
            url: "/sub/ajax.push_click.php",
            type: "POST",
            data: {"idx": idx},
            dataType: "html",
            async: false,
            cache: false,
            success: function(data) {
				//alert(data);
				//if(data.result){
					//alert(data.msg);
					//location.reload();
				//}else{
					//alert(data.msg);
				//}
            }
        });
 }
}
</script>

<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
