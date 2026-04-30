<?php
if (!defined("_GNUBOARD_")) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

// add_stylesheet('css 구문', 출력순서); 숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

// 현재 게시물을 스크랩했는지 체크
$scrap_sql = " select count(*) as cnt from {$g5['scrap_table']} where mb_id = '{$member['mb_id']}' and bo_table = '$bo_table' and wr_id = '{$view['wr_id']}' ";
$scrap_row = sql_fetch($scrap_sql);


include_once(G5_THEME_MOBILE_PATH.'/head_roll.php');


// 카테고리별 배경이미지 Class
$cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');
?>

<script src="<?php echo G5_JS_URL; ?>/viewimageresize.js"></script>


<style>
    #hd,
    .tail,
    .tail_block { display:none;}
    .view_tail .counselor_state_btn_wrap {width:calc(100% - 50px); margin-left:10px; height:50px; text-align:center; font-weight:600; font-size:18px; line-height: 46px;}

    .counsel_view .cnt {font-size:14px; font-weight:600; margin-bottom:6px;}
    .counsel_view .cnt img {width:18px; display:inline-block; margin-right:4px;}
    .counsel_view .cnt .unit {font-size:.9em; color:#999;}

    .view_tail {position:fixed; bottom:0; left:0; width:100%; background-color:#fff; padding:10px 20px; z-index:999; display: flex; box-shadow:0 -5px 15px rgba(0,0,0,.1);}
    .view_tail .view_tail_scrap {font-size:12px; text-align:center; width: 100%;; font-size:12px; padding-top:2px; color:#000; padding-top: 5px;}
    .view_tail .view_tail_scrap img {width:20px; margin-bottom:0px;}
    .view_tail .view_tail_scrap p{width:100%;}
    .view_tail .view_state_btn {width:calc(100% - 50px); margin-left:10px; height:50px; text-align:center; border-radius:6px; font-weight:600; font-size:18px; line-height: 46px;}
    .view_tail .view_state_btn.tel { border:2px solid #465bf0;}
    .view_tail .view_state_btn.tel_wait {background-color: #fff; color: #465bf0;}
    .view_tail .view_state_btn.tel_ing {background-color: #465bf0; color: #fff;}

    /*
    .pop-layer .pop-container {
      padding: 20px 25px;
    }

    .pop-layer p.ctxt {
      color: #666;
      line-height: 25px;
    }

    .pop-layer .btn-r {
      width: 100%;
      margin: 10px 0 20px;
      padding-top: 10px;
      border-top: 1px solid #DDD;
      text-align: right;
    }

    .pop-layer {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 410px;
      height: auto;
      background-color: #fff;
      border: 5px solid #3571B5;
      z-index: 10;
    }

    .dim-layer {
      display: none;
      position: fixed;
      _position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100;
    }

    .dim-layer .dimBg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      opacity: .5;
      filter: alpha(opacity=50);
    }

    .dim-layer .pop-layer {
      display: block;
    }

    a.btn-layerClose {
      display: inline-block;
      height: 25px;
      padding: 0 14px 0;
      border: 1px solid #304a8a;
      background-color: #3f5a9d;
      font-size: 13px;
      color: #fff;
      line-height: 25px;
    }

    a.btn-layerClose:hover {
      border: 1px solid #091940;
      background-color: #1f326a;
      color: #fff;
    }
    */
</style>
<!--20250727 eun 프로필  gif 작업 시작-->
<!-- Swiper CSS/JS CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<!--20250727 eun 프로필  gif 작업 마감-->

<?php
   $c_sql = "
    select
     count(ms_id) as cnt
    from
     g5_scrap
    where
     wr_id = '{$view['wr_id']}'
    ";
    $crow = sql_fetch($c_sql);	
?>
<div class="view_tail" >
    <ul class="view_tail_scrap" >


        <?php if ($scrap_href) { ?>
            <a href="javascript:;" onclick="scrap_submit()" class=" btn_scrap" title="스크랩">
                <?php echo ($scrap_row['cnt']) ? "<img src='../img/common/list_icon_scrap_on.png' />" : "<img src='../img/common/list_g_icon_scrap.png' />"; ?>
            </a>
        <?php }else{ ?>
            <a href="javascript:;" onclick="alert('로그인 하셔야합니다.!');return false;" class=" btn_scrap" title="스크랩">
                <?php echo ($scrap_row['cnt']) ? "<img src='../img/common/list_icon_scrap_on.png' />" : "<img src='../img/common/list_g_icon_scrap.png' />"; ?>
            </a>

        <?}?>

        <p class="hart_font"><?php echo ($scrap_row['cnt']) ? "찜" : "찜"; ?><span> (<?=$crow['cnt']?>)</span></p>
    </ul>
    <?php
    // echo G5_PATH.'/include/counselor_view_state_btn.php';

    ?>
    <?php 
    include(G5_PATH.'/include/counselor_view_state_btn.php'); 
    ?>
    <!--상담상태 버튼 Wrap End -->

</div>




<?php


$mb = get_member($view["mb_id"]);


$filename = $view['file'][0]['file'];
$filepath = G5_DATA_PATH.'/file/'.$bo_table;
$filesrc = G5_DATA_URL.'/file/'.$bo_table.'/'.$filename;
$thumb = thumbnail($filename, $filepath , $filepath , 720, 430, false, true);
$thumbsrc = G5_DATA_URL.'/file/'.$bo_table.'/'.$thumb;
?>
<!--
<img src="<?=$filesrc?>">
<img src="<?=$thumbsrc?>">
-->

<!-- VIEW : START -->
<div class="counsel_view">
    <!--20250727 프로필 mp4 작업 시작 PHOTO : START -->

    <!--<ul class="photo_wrap  type_bg <?php /*=$cate_bg[$view['ca_name']]*/?>">
    	<li class="photo" style=" background-image:url(<?php /*=$filesrc*/?>);">
	    	<p class="views_count" > 선생님의 페이지를 지금 <span class="point_02"><?php /*=get_mypage_view_count()*/?></span>명이 보고 있습니다.</p>
    	    <?php /*//echo $view['file'][0]['view']; */?>
        </li>
	</ul>-->
    <?php
    // 첨부파일 2개까지, 동영상 먼저 정렬
    $media = [];
    for ($i = 0; $i < 2; $i++) {
        $file = $view['file'][$i]['file'];
        if (!$file) continue;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $media[] = ['file' => $file, 'ext' => $ext];
    }
    // 동영상이 앞에 오도록 정렬
    usort($media, function($a, $b) {
        if ($a['ext'] == 'mp4') return -1;
        if ($b['ext'] == 'mp4') return 1;
        return 0;
    });
    ?>
    <ul class="photo_wrap type_bg <?=$cate_bg[$view['ca_name']]?>">
        <li class="photo" style="background-image:none; padding:0; position:relative;">
            <!-- Swiper 컨테이너 -->
            <div class="swiper mySwiper">
                <div class="swiper-wrapper">
                    <?php foreach ($media as $m):
                        $src = G5_DATA_URL.'/file/'.$bo_table.'/'.$m['file'];
                        ?>
                        <div class="swiper-slide" style="text-align:center;">
                            <?php if ($m['ext'] == 'mp4'): ?>
                                <video autoplay muted loop playsinline controls
                                       style="max-width:100%; max-height:320px; margin:auto; display:block;">
                                    <source src="<?=$src?>" type="video/mp4">
                                    이 브라우저는 비디오를 지원하지 않습니다.
                                </video>
                            <?php else: ?>
                                <img src="<?=$src?>" style="max-width:100%; max-height:320px; margin:auto; display:block;">
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
                <!-- 스와이프 인디케이터(점) -->
                <div class="swiper-pagination"></div>
            </div>
            <p class="views_count" style="z-index: 4;" > 선생님의 페이지를 지금 <span class="point_02"><?=get_mypage_view_count()?></span>명이 보고 있습니다.</p>
        </li>
    </ul>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var swiper = new Swiper('.mySwiper', {
                loop: false,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                }
            });
        });
    </script>



    <!-- PHOTO : END -->
    <!--20250727 프로필 mp4 작업 마감 PHOTO : START -->

    <!-- PROFILE : START -->
    <ul class="profile">
        <!-- 이름 -->
        <li class="pro_title">
            <!-- 왼쪽 영역 -->
            <p class="left">
                <span class="point" style="font-size:15px; font-weight:600;"><img src="../img/common/icon_cate_tarot.png" style="width:16px; margin-right:4px; vertical-align: -2px;"/><?php echo $view['ca_name']; // 분류 출력 끝 ?></span>
                <!-- 구분 상태값<span class="cate cate_type01">타로</span>--><br />
                <!-- 이름 --><span class="name" style="margin-top:4px; display:inline-block;"><?php echo cut_str(get_text($view['wr_subject']), 70); // 글제목 출력 ?></span>
                <!-- 상담사 고유번호 --><?php include(G5_PATH.'/include/counselor_num.php'); ?>
            </p>

            <!-- 오른쪽 영역 -->
            <p class="right">
                <?php if ($update_href) { ?>
                    <a class="btn point_bg white" href="<?php echo $update_href ?>" style="display:none;"><i class="fa fa-pencil-square-o" aria-hidden="true"></i> 수정</a>
                <?php } ?>
                <?php if ($delete_href) { ?>
                    <a class="btn black_bg white" href="<?php echo $delete_href ?>" onclick="del(this.href); return false;"><i class="fa fa-trash-o" aria-hidden="true"></i> 삭제</a>
                <?php } ?>
            </p>

        </li>


        <!-- 현황 영역 -->
        <li class="cnt">
            <img src="../../../img/common/icon_price.png">
            <?=number_format($mb["mb_4"])?>원 <span class="unit">(<?=$mb["mb_5"]?>초당)</span>
            <!-- 채택 개수<span>채택 <strong>4</strong></span>
            <리뷰 평점<span>평점 <strong>4.7</strong></span>-->
        </li>

        <!-- 짧은 소개
    	<li class="summary">
        	<! 짧은 소개 솔직하게 담백한 상담을 원하신다면?
    	</li>
        -->

        <!-- 해시태그 영역 -->
        <li class="tag">
            <!-- 키워드 --><span>#<?php echo $view['wr_9']; ?></span>
            <span>#<?php echo $view['wr_10']; ?></span>
        </li>

        <div class="count">
            <ul class="count_item">
                <img src="../../../img/common/icon_review.png" style='margin-bottom:5px;'>최근 후기<span>(<?=get_counselor_afcnt($view["mb_id"])?>)</span>
            </ul>
            <ul class="count_line gray">|</ul>
            <ul class="count_item">
                문의<span>(<?=get_counselor_qa_new($view["mb_id"])?>)</span>
            </ul>
            <ul class="count_line gray">|</ul>
            <?php if ($scrap_href) { ?>
                <a href="javascript:;" onclick="scrap_submit()" class=" btn_scrap" title="스크랩">
                    <?php echo ($scrap_row['cnt']) ? "<img src='../img/common/list_icon_scrap_on.png' style='width:14px; margin-bottom:5px; margin-right:3px;' />" : "<img src='../img/common/list_g_icon_scrap.png' style='width:14px; margin-bottom:5px; margin-right:3px;' />"; ?>
                </a>
            <?php }else{ ?>
                <a href="javascript:;" onclick="alert('로그인 하셔야합니다.!');return false;" class=" btn_scrap" title="스크랩">
                    <?php echo ($scrap_row['cnt']) ? "<img src='../img/common/list_icon_scrap_on.png' style='width:14px; margin-bottom:5px; margin-right:3px;' />" : "<img src='../img/common/list_g_icon_scrap.png' style='width:14px; margin-bottom:5px; margin-right:3px;' />"; ?>
                </a>
            <?}?>
            <ul class="count_item">
                단골 <span>(<?=$crow['cnt']?>)</span>
            </ul>
            <!--
    	    <ul class="" style=" margin-left:6px; display: flex; align-items: center;"><img src="../../../img/common/icon_star.png" style="width:14px; margin-right:4px;">0.0<span>(00)</span></ul>
            -->
        </div>
        <!-- 상담가능한 일정 -->
        <li class="schedule" style="display:none;">
            <p class="schedule_con">
                <span><img src="../img/common/icon_date.png"/> 월, 화, 수, 목, 금, 토, 일</span>
                <span><img src="../img/common/icon_time.png"/> 09:00 ~ 18:30</span>
            </p>
        </li>
    </ul>
</div>

<div class="counsel_view counsel_menu" style="display:none;">
    <ul class="">
        <!-- 상담 버튼 -->
        <li class="list_btn">
            <!-- 채팅상담 버튼 --><span class="chat_btn_on"><a href="counsel_chat.php">채팅</a></span>
            <!-- 음성상담 버튼 --><span class="tel_btn_on"><a href="counsel_tel_user.php">음성</a></span>
            <!-- 영상상담 버튼 --><span class="video_btn">영상</span>
            <!-- 후불상담 버튼 --><span class="after_btn_on"><a href="tel:060-900-4321">후불</a></span>
            <!-- 예약상담 버튼 --><span class="reserve_btn_on"  id="myBtn02">예약</span>
        </li>

    </ul>
    <!-- PROFILE : END -->
</div>
<div class="counsel_view">

    <div style="width:100%; float:left; padding:20px; border-top: 15px solid #f3f3f3;">
        <h2 style="font-size:18px; font-weight:600; margin-bottom:10px; display: flex; align-items: flex-end;">
            상담사 공지
            <span style="font-size:.8em; color:#999; margin-left:4px; font-weight:400;">
            	<?=$view['wr_last']?>
          </span>
        </h2>
        <ul class=" c_noti" style="text-align:left;"><?=nl2br($view['content'])?></ul>
    </div>

    <div style="width:100%; float:left; padding:20px; border-top: 15px solid #f3f3f3;">

        <dl style="display:flex; margin-bottom:10px;">
            <dt style="width:70px; font-weight:600; ">전문분야</dt>
            <dd>
                <?php
                echo gola_value($view["wr_5"]);
                ?>
            </dd>
        </dl>

        <dl style="display:flex;">
            <dt style="width:70px; font-weight:600; ">스타일</dt>
            <dd><?php echo gola_value($view['wr_6']); ?></dd>
        </dl>

        <!--
        <h2 style="font-size:18px; font-weight:600; margin-bottom:10px; display: flex; align-items: flex-end;">
    		전문분야
    	</h2>
	    <ul style="text-align:left;"><?php echo $view['wr_5']; ?></ul>

		<h2 style="font-size:18px; font-weight:600; margin-bottom:10px; display: flex; align-items: flex-end;">
    		스타일
    	</h2>
    	<ul style="text-align:left;"><?php echo $view['wr_6']; ?></ul>
        -->

    </div>

    <div style="width:100%; float:left; padding:20px; border-top: 15px solid #f3f3f3;">
        <h2 style="font-size:18px; font-weight:600; margin-bottom:10px; display: flex; align-items: flex-end;">
            상담사 약력
        </h2>
        <ul style="text-align:left;"><?=nl2br($view['wr_7'])?></ul>
    </div>


    <!-- TAP : START -->
    <ul class="view_tap">
        <li class="view_tap_menu">
            <p href="#tab1" class="view_tap_btn on">상담사 소개</p>
            <p href="#tab2" class="view_tap_btn">상담 후기</p>
            <p href="#tab3" class="view_tap_btn">상담 문의</p>
            <p href="#tab4" class="view_tap_btn">부가서비스</p>
        </li>
        <!--
        <li id="tab1" class="panel introduce">
            <div style="padding:0 20px;"><?php /*=nl2br($view['wr_4']) */?></div>
        </li>
        -->

        <li id="tab1" class="panel introduce" style=" float:left; margin:20px;">
            <ul class=" c_noti" style="text-align:left; padding-right: 40px; "><?=nl2br($view['wr_4'])?></ul>
        </li>



        <li id="tab2" class="panel review">
            <div class="con_section_03" >

                <?php include_once(G5_PATH.'/include/review_title.php'); ?>

                <!--
                <div class="review_wrap_title">상담 후기 00건</div>
                -->
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                $itab = "comment";
                $csr_id = $view["mb_id"];
                echo latest('theme/review', 'review', 100, 100);		// 최소설치시 자동생성되는 갤러리게시판
                ?>
            </div>
        </li>



        <li id="tab3" class="panel introduce">
            <div class="con_section_03" >
                <?php include_once(G5_PATH.'/include/qa_title.php'); ?>
                <?php
                // 코멘트 입출력
                //include_once(G5_BBS_PATH.'/view_comment.php');
                ?>
                <?php //include(G5_PATH.'/include/waiting.php'); ?>
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                $itab = "comment";
                $csr_id = $view["mb_id"];
                echo latest('theme/qa', 'qa', 100, 100);		// 최소설치시 자동생성되는 갤러리게시판
                ?>
            </div>
        </li>


        <li id="tab4" class="panel introduce">
            <!--<img src="../../../../../../img/sample/view_goods.JPG" style="width:100%;" />-->
            <?
            // 스킨경로
            $skin_dir = G5_MSHOP_SKIN_PATH;

            if($ca['ca_mobile_skin_dir']) {
                if(preg_match('#^theme/(.+)$#', $ca['ca_mobile_skin_dir'], $match))
                    $skin_dir = G5_THEME_MOBILE_PATH.'/'.G5_SKIN_DIR.'/shop/'.$match[1];
                else
                    $skin_dir = G5_MOBILE_PATH.'/'.G5_SKIN_DIR.'/shop/'.$ca['ca_mobile_skin_dir'];

                if(is_dir($skin_dir)) {
                    $skin_file = $skin_dir.'/'.$ca['ca_mobile_skin'];

                    if(!is_file($skin_file))
                        $skin_dir = G5_MSHOP_SKIN_PATH;
                } else {
                    $skin_dir = G5_MSHOP_SKIN_PATH;
                }
            }

            $ca_id = get_cate_id($view["mb_id"]);

            if($ca_id){

                $sql = " select *
							   from {$g5['g5_shop_category_table']}
							  where ca_id = '$ca_id'
								and ca_use = '1'  ";
                $ca = sql_fetch($sql);

                $sql = " select *
									from {$g5['g5_shop_item_table']}
									where ( ca_id like '$ca_id%' or ca_id2 like '$ca_id%' or ca_id3 like '$ca_id%' )
									  and it_use = '1'
									order by it_order, it_id desc
									limit 0, 3 ";

                //echo $sql;


                // 리스트 스킨
                $skin_file = is_include_path_check($skin_dir.'/'.$ca['ca_mobile_skin']) ? $skin_dir.'/'.$ca['ca_mobile_skin'] : $skin_dir.'/list.10.skin.php';

                //echo $skin_file;
                ///home/hosting_users/dfsoft_thesaju/www/theme/basic/mobile/skin/shop/basic/list.10.skin.php



                if (file_exists($skin_file)) {

                    echo '<div id="sct_sortlst">';

                    $sort_skin = $skin_dir.'/list.sort.skin.php';
                    if(!is_file($sort_skin))
                        $sort_skin = G5_MSHOP_SKIN_PATH.'/list.sort.skin.php';
                    include $sort_skin;

                    // 상품 보기 타입 변경 버튼
                    $sub_skin = $skin_dir.'/list.sub.skin.php';
                    if(!is_file($sub_skin))
                        $sub_skin = G5_MSHOP_SKIN_PATH.'/list.sub.skin.php';

                    if(is_file($sub_skin)){
                        include $sub_skin;
                    }

                    echo '</div>';

                    // 총몇개
                    $items = $ca['ca_mobile_list_mod'] * $ca['ca_mobile_list_row'];
                    // 페이지가 없으면 첫 페이지 (1 페이지)
                    if ($page < 1) $page = 1;
                    // 시작 레코드 구함
                    $from_record = ($page - 1) * $items;

                    $list = new item_list($skin_file, $ca['ca_mobile_list_mod'], $ca['ca_mobile_list_row'], $ca['ca_mobile_img_width'], $ca['ca_mobile_img_height']);
                    //$list->set_category($ca['ca_id'], 1);
                    //$list->set_category($ca['ca_id'], 2);
                    //$list->set_category($ca['ca_id'], 3);

                    $list->set_query($sql);

                    $list->set_is_page(true);
                    $list->set_mobile(true);
                    $list->set_order_by($order_by);
                    $list->set_from_record($from_record);
                    $list->set_view('it_img', true);
                    $list->set_view('it_id', false);
                    $list->set_view('it_name', true);
                    $list->set_view('it_price', true);
                    $list->set_view('sns', true);
                    $list->set_view('it_icon', true);
                    echo $list->run();

                    // where 된 전체 상품수
                    $total_count = $list->total_count;
                }
                else
                {
                    echo '<div class="sct_nofile">'.str_replace(G5_PATH.'/', '', $skin_file).' 파일을 찾을 수 없습니다.<br>관리자에게 알려주시면 감사하겠습니다.</div>';
                }

            }

            ?>


            <?php //include(G5_PATH.'/include/waiting.php'); ?>

        </li>


    </ul>
    <!-- TAP : END -->

</div>


<!--20250727 eun 모달창으로 인해 상담사 페이지 클릭 안 되는 부분 작업 시작-->

<!-- The Modal -->
<div id="myModal" class="modal" style="display: none;">
    <!--20250727 eun 모달창으로 인해 상담사 페이지 클릭 안 되는 부분 작업 마감-->

    <!-- Modal content -->
    <div class="modal-content">
        <span class="close"><i class="xi-close"></i></span>
        <ul class="pop_title">신고</ul>

        <div class="form_warp">
            <h4>신고하신 내용은 담당자에게 접수됩니다.</h4>
            <ul>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_1">
                    <label for="booking_1"></label>
                    욕설 및 불쾌한 언행 사용
                </li>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_2">
                    <label for="booking_2"></label>
                    비방 및 비하로 인한 명예훼손
                </li>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_3">
                    <label for="booking_3"></label>
                    성희롱 및 청소년에게 부적절한 언행 사용
                </li>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_4">
                    <label for="booking_4"></label>
                    기타
                    <p class="p_left_28"><textarea class="small" placeholder="사유를 입력해주세요."></textarea></p>
                </li>

                <li class="btn_div">
                    <button class="cancel_btn close">취소</button>

                    <a href="../index.php" class="ok_btn">신고하기</a>
                </li>

            </ul>
        </div>
    </div>

</div>
<!--20250727 eun 모달창으로 인해 상담사 페이지 클릭 안 되는 부분 작업 시작-->
<script>
    $(function(){
        // x 닫기 버튼 클릭
        $('.modal .close').click(function(){
            $(this).closest('.modal').hide();
        });
    });
    $(function(){
        $('#myModal').click(function(e){
            if (e.target === this) $(this).hide();
        });
    });
</script>
<!--20250727 eun 모달창으로 인해 상담사 페이지 클릭 안 되는 부분 작업 마감-->

<!-- The Modal -->
<div id="myModal02" class="modal02">

    <!-- Modal content -->
    <div class="modal-content">
        <span class="close02"><i class="xi-close"></i></span>
        <ul class="pop_title">예약상담</ul>



        <div class="form_warp con_section_b_bot_02">
            <ul>
                <h3>예약정보를 입력해주세요.</h3>

                <li class="input_div input_div_flex  input_div_toggle">
                    <input type="date" placeholder="선택해주세요" />
                    <input type="time" placeholder="선택해주세요" />
                </li>

            </ul>
        </div>


        <div class="form_warp">
            <ul>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_1">
                    <label for="booking_1"></label>
                    채팅
                </li>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_2">
                    <label for="booking_2"></label>
                    음성
                </li>

                <li class="mbot_15">
                    <input type="radio" name="booking" id="booking_3">
                    <label for="booking_3"></label>
                    영상
                </li>
                <li class="btn_div">
                    <button class="cancel_btn close02">취소</button>

                    <a href="../index.php" class="ok_btn">예약신청</a>
                </li>

            </ul>
        </div>
    </div>

</div>



<!--<ul class="title">이든</ul>-->


<!--팝업창없이 바로 스크랩하기 : START -->
<form name="f_scrap_popin" action="<?php echo G5_BBS_URL?>/scrap_popin_update.php" method="post">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table ?>">
    <input type="hidden" name="wr_id" value="<?php echo $wr_id ?>">
    <input type="hidden" name="wr_content" value="">
</form>

<script type="text/javascript">
    function scrap_submit() {
        var param = $("form[name=f_scrap_popin]").serialize();
        $.ajax({
            url: g5_bbs_url+"/scrap_popin_update.php",
            type: "POST",
            data: param,
            success:function(data){
                //alert("성공");
                console.log(data);

                var a_comment = /<noscript>(([\s\S]+?[\s\S]))<\/p>/.exec(data);
                if (a_comment != null)
                {
                    var content = String(a_comment[1].trim());
                    content = content.substring(3,content.length);
                    webAlert(content);
                    location.reload();
                }
            },
            error:function(data){
                alert("error");
            }
        });
    }
</script>
<!--팝업창없이 바로 스크랩하기 : END -->

<script id="src">
    $(function(){
        // ul 에 li 를 클릭했을때
        $(".view_tap_btn").click(function(){
            // a 에 있는 모든 클래스 selected 를 삭제
            $(".view_tap_btn").removeClass("on");
            // 그리고 현재의 요소에만 selected 클래스 추가.
            $(this).addClass("on");
            // 탭의 변경에 맞쳐 패널의 표시,비표시를 변경합니다.모든 패널을 비표시합니다.
            $(".panel").hide();
            // $(this).attr("href") 로 클릭된 a 태그의 href 속성을 가져와 같은 이름의 id 속성을 가진 패널을 보여줍니다.
            // 즉 현재의 클릭된 요소만 보여줍니다.
            //$($(this).attr("href")).show();
            //$($(this).attr("href")).css("opacity","0.5").show();
            $($(this).attr("href")).fadeIn("slow");
            //$($(this).attr("href")).animate({    opacity: 1  }, 500, "swing", function() {    });
            // 탭에 a 요소로 되어 있어서 클릭했을때 발생하는 click 이벤트를 설정, 이동하지 못하게 합니다.
            return false;
        });

        //기본설정
        $(".panel").hide();
        $($('.view_tap_btn.on').attr("href")).fadeIn("slow");
    })
</script>

<script>
    <?php if ($board['bo_download_point'] < 0) { ?>
    $(function() {
        $("a.view_file_download").click(function() {
            if(!g5_is_member) {
                alert("다운로드 권한이 없습니다.\n회원이시라면 로그인 후 이용해 보십시오.");
                return false;
            }

            var msg = "파일을 다운로드 하시면 포인트가 차감(<?php echo number_format($board['bo_download_point']) ?>점)됩니다.\n\n포인트는 게시물당 한번만 차감되며 다음에 다시 다운로드 하셔도 중복하여 차감하지 않습니다.\n\n그래도 다운로드 하시겠습니까?";

            if(confirm(msg)) {
                var href = $(this).attr("href")+"&js=on";
                $(this).attr("href", href);

                return true;
            } else {
                return false;
            }
        });
    });
    <?php } ?>

    function board_move(href)
    {
        window.open(href, "boardmove", "left=50, top=50, width=500, height=550, scrollbars=1");
    }
</script>

<!-- 게시글 보기 끝 -->

<script>
    $(function() {
        $("a.view_image").click(function() {
            window.open(this.href, "large_image", "location=yes,links=no,toolbar=no,top=10,left=10,width=10,height=10,resizable=yes,scrollbars=no,status=no");
            return false;
        });

        // 추천, 비추천
        $("#good_button, #nogood_button").click(function() {
            var $tx;
            if(this.id == "good_button")
                $tx = $("#bo_v_act_good");
            else
                $tx = $("#bo_v_act_nogood");

            excute_good(this.href, $(this), $tx);
            return false;
        });

        // 이미지 리사이즈
        $("#bo_v_atc").viewimageresize();
    });

    function excute_good(href, $el, $tx)
    {
        $.post(
            href,
            { js: "on" },
            function(data) {
                if(data.error) {
                    alert(data.error);
                    return false;
                }

                if(data.count) {
                    $el.find("strong").text(number_format(String(data.count)));
                    if($tx.attr("id").search("nogood") > -1) {
                        $tx.text("이 글을 비추천하셨습니다.");
                        $tx.fadeIn(200).delay(2500).fadeOut(200);
                    } else {
                        $tx.text("이 글을 추천하셨습니다.");
                        $tx.fadeIn(200).delay(2500).fadeOut(200);
                    }
                }
            }, "json"
        );
    }
</script>
<?
$item_name =  cut_str(get_text($view['wr_subject']), 70);
$price = $mb["mb_4"];
$item_id = $wr_id;


?>
<script>
    //구글 애널리틱스 item_view호출 //

    var price = "<?=$price?>";
    var item_id = "<?=$item_id?>";
    var item_name = "<?=$item_name?>";
    try{
        g4_view_item_new(price, item_id, item_name);
    }catch (e) {
        console.log(e);
    }

    g4_view_item(price, item_id, item_name);
</script>