<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    include_once(G5_THEME_MSHOP_PATH.'/index.php');
    return;
}

include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>



<script src="http://code.jquery.com/jquery-latest.js"></script>

<!-- HEAD 회색으로 변경 -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/mobile_shop.css">

<!-- 메인 슬라이드 CSS -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.main.css">

<!-- HEAD 회색으로 변경 -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_head.css">

<!-- BODY 회색으로 변경 -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_body.css">

<div class="main_slide">

	<ul class="main_title" style=" margin-top: 10px; line-height: 1.6; padding-bottom: 20px; border-bottom: 15px solid #e9e9e9;">
		<? if ($is_member) {?>
        	<a href="<?php echo G5_URL; ?>/my/service_list.php">
            <li style="position:relative;">
            	<p style=" position:relative; padding-right:20px; font-size: 18px; color: #000;">
					<span style=" font-weight: 700;"><?php echo $member['mb_name'];?></span>님은<br />
    	            <span style=" color:#000; font-weight: 700;">퍼스트Z 카케어</span>를 이용중이십니다
                    <i class="xi-arrow-right" style="vertical-align:-1px; "></i>
                </p>
                <!--<span style="color:#2b3990;">프리미엄패키지</span>를 이용중이십니다.-->
            
        	    <!--<p style="display: inline-block; margin-top: 10px; color: #666; font-size: 16px; border-bottom: 1px solid #888; padding-bottom:2px;">예약정보 바로가기 <i class="xi-long-arrow-right" style="display:inline-block; margin-left:6px;"></i></p>-->
                
                <p style="display: inline-block; margin-top: 10px; color: #fff; font-size: 14px; line-height:30px; padding:0px 10px; background-color:#2b3990; border-radius:50px; margin-right:6px;">티구안 12가1234</p>
                <p style="display: inline-block; margin-top: 10px; color: #fff; font-size: 14px; line-height:30px; padding:0px 10px; background-color:#2b3990; border-radius:50px; margin-right:6px;">아반떼 56가5678</p>
                
                <!--
                <span style="position:absolute; top:50%; right:0; transform:translateY(-50%); width:40px; height:40px; line-height:40px; background-color:#ddd; color:#fff; text-align:center; font-size:24px; border-radius:50%;"><i class="xi-arrow-right" style="vertical-align:-1px; "></i></span>-->
                <!--
                <p style="display: inline-block; margin-top: 10px; color: #fff; font-size: 18px; line-height:30px; padding:0px 10px; background-color:#ddd; border-radius:50px; margin-right:6px; "><i class="xi-arrow-right" style="vertical-align: -1px;"></i></p>
                -->
            </li>
            </a>
		<? } else {?>
			<a href="<?php echo G5_URL; ?>/bbs/login.php">
            <li>
	            <span>로그인</span>하시면,<br />
    			맞춤 차량관리를 제공해 드려요!
            </li>
            </a>
		<? } ?>
        
	</ul>

	<ul class="main_slide_ul">


  	<!-- Demo styles -->
  	<style>
	
	
    .swiper-container {
        width: 100%;
        height: 100%;
        
    }
    .swiper-slide {
        text-align: center;
        font-size: 18px;
        
        /* Center slide text vertically */
        display: -webkit-box;
        display: -ms-flexbox;
        display: -webkit-flex;
        display: flex;
        -webkit-box-pack: center;
        -ms-flex-pack: center;
        -webkit-justify-content: center;
        justify-content: center;
        -webkit-box-align: center;
        -ms-flex-align: center;
        -webkit-align-items: center;
        align-items: center;
		padding-right:15px;
    }
	
	.swiper-slide:last-child { margin-right:30px;}
	.swiper-slide img { width:100%; border-radius:16px 16px 16px 60px; box-shadow:5px 5px 10px rgba(0,0,0,.12);  }
  	</style>

  	<!-- Swiper -->
  
  	<div class="swiper-container">
        <div class="swiper-wrapper">
            <div class="swiper-slide"><a href="../sub/wash_step_01.php"><img src="../../../img/main/01.png"/></a></div>
            <div class="swiper-slide"><a href="../sub/wash_info.php"><img src="../../../img/main/02.png"/></a></div>
            <div class="swiper-slide"><a href="../sub/wash_info_package.php"><img src="../../../img/main/03.png"/></a></div>
            <div class="swiper-slide"><a href="../bbs/board.php?bo_table=event"><img src="../../../img/main/04.png"/></a></div>
        </div>
        <!-- Add Pagination -->
        <div class="swiper-pagination"></div>
        <!-- Add Arrows 
        <div class="swiper-button-next"></div>
        <div class="swiper-button-prev"></div>
        -->
    </div>
  
  
    <script src="<?php echo G5_JS_URL; ?>/swiper.min.main.js"></script>

    <!-- Initialize Swiper -->
    <script>
    var swiper = new Swiper('.swiper-container', {
        pagination: '.swiper-pagination',
        nextButton: '.swiper-button-next',
        prevButton: '.swiper-button-prev',
        paginationClickable: true,
		slidesPerView: 1.2,//640~1024 해상도 외 레이아웃 뷰 개수
        spaceBetween: 0,//위 slidesPerview 여백
		//loop: true, // 루프
        //centeredSlides: true,
        autoplay: 2600,
        autoplayDisableOnInteraction: false,
		breakpoints: { //반응형 조건 속성
        640: { //640 이상일 경우
          slidesPerView: 1.1, //레이아웃 2열
        },
        768: {
          slidesPerView: 2,
        },
        1024: {
          slidesPerView: 3,
        },
      }
    });
    </script>       	

	</ul>    	
</div>

<div class="main_01">
	<ul class="main_title">
    	PREMIUM CAR CARE SERVICE 
        <p>이제부터 세차하지 말고 카케어 하세요!</p>
    </ul>
</div>

<style>

/* 메인섹션 타이틀 공통CSS */
.main_title {width:100%; float:left; font-size:18px; color:#000; line-height:1.3; padding:15px 15px 0; font-weight:600;}
.main_title span {color:#13a89e;}
.main_title p { font-size:14px; color:#999;font-weight:400;}

.main_slide {width:100%; float:left;}
.main_slide ul.main_slide_ul {position:relative; width:100%; float:left; padding-left:15px; padding-top:15px; padding-bottom:30px;}

.main_01 {width:100%; float:left;}
.main_01 ul {width:100%; float:left;}
.main_01 ul.con {font-size:16px; color:#777; padding:45px 15px 15px 15px;}
.main_01 ul.con li {width:calc(50% - 7px); float:left; padding:20px; border-radius:15px; padding:20px; background-color:#fff; float:left; box-shadow:5px 5px 15px rgba(0,0,0,.1);}
.main_01 ul.con a:last-child li { margin-left:14px;}

.main_01 ul.con li p.icon {width:80px; height:80px; padding:20px; background-color:#829cf0; border-radius:100%; margin-top:-65px;}
.main_01 ul.con li p.icon img {width:100%;}
.main_01 ul.con li p.title {color:#4a69c8; font-size:18px; font-weight:600; margin-top:15px;}
.main_01 ul.con li p.text {color:#777; font-size:14px; line-height:1.3; margin-top:5px;}

.main_01 ul.con a:last-child li p.icon {background-color:#7dc8bd !important;}
.main_01 ul.con a:last-child li p.title { color:#459084 !important;}

.main_02 {width:100%; float:left; padding:0 15px 15px;}
.main_02 ul { padding:15px; border:2px solid #ddd; border-radius:10px; position:relative; min-height:75px;}
.main_02 ul p.icon {position:absolute; left:10px; top:10px; width:50px; height:50px; padding:10px; border-radius:100%; background-color:#fff; box-shadow:0 0 10px rgba(0,0,0,.1);}
.main_02 ul p.icon img {width:100%;}
.main_02 ul p.more {position:absolute; right:15px; top:50%; height:100%; vertical-align:middle; margin-top:-10px;}
.main_02 ul p.more span {color:#fff; background-color:#ddd; border:1px solid #d5d5d5; border-radius:30px; font-size:13px; padding:0 6px;}
.main_02 ul li {width:calc(100% - 40px); padding-left:55px; color:#000; font-size:14px;}
.main_02 ul li span {color: #2b3990; text-decoration: underline; font-weight:600;}


.main_03 {width:100%; float:left; width:100%; float:left; padding:15px; }
.main_03 ul {width:100%; float:left;}

.main_03 ul.main_title { padding:0 0 15px 0;}

.main_03 ul.con { padding:20px; background-color:#fff; border-radius:20px; position:relative;  box-shadow:0 0 20px rgba(0,0,0,.1);}
.main_03 ul.con li {width:100%; float:left; border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:15px; min-height:95px; position:relative;}
.main_03 ul.con li:last-child { padding-bottom:0 !important; margin-bottom:0px !important; border-bottom:none !important; }

.main_03 ul.con li img {width:75px; border-radius:25px; position:absolute; left:0; top:0;}
.main_03 ul.con li p.text {width:calc(100% - 50px); padding-left:90px; color:#000;}
.main_03 ul.con li p.text span {display:block;}
.main_03 ul.con li p.text span.name {font-size:18px; font-weight:600; }
.main_03 ul.con li p.text span.sub_text_01 {font-size:13px; display:block;}
.main_03 ul.con li p.text span.sub_text_02 {font-size:15px; color:#52b0ee; font-weight:600; display:block; margin-top:6px;}
.main_03 ul.con li p.main_03_btn {position:absolute; right:0px; top:50%; vertical-align:middle; margin-top:-12px;}
.main_03 ul.con li p.main_03_btn span {color:#fff; background-color:#3a54ab; border-radius:30px; font-size:13px; padding:2px 10px;}
</style>


<div class="sub_div" style=" padding-bottom:0;">	
	
    <!-- 프리미엄 패캐지 : START -->
    <a href="<?php echo G5_URL; ?>/sub/wash_step_01.php">
    <ul class="type_btn">
    	<li class="cost">
        	<span>매주 2번 (월 8회)</span>
            <p></p>
        </li>
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon">
                	<p>월8</p>
               		<img src="../img/wash/wash_step_01_01_img.png"/>                    
                </ul>
                <ul class="text">
                	<li class="tip"><span>￦ 10.0 - 12.0</span></li>
                    <li class="title">프리미엄 패캐지</li>
                    <li class="service">
                    	기본케어 (외부세차, 휠&amp;타이어 세정, 물왁스코팅) <br />+ <span>월1회 내부세차</span>
                    </li>                
                </ul>                
                <ul class="check_btn"></ul>
            </div>            
        </li>
    </ul>
    </a>
    <!-- 프리미엄 패캐지 : END -->
    
    <!-- 베이직 패키지 : START -->
    <a href="<?php echo G5_URL; ?>/sub/wash_step_01.php">
    <ul class="type_btn">
    	<li class="cost">
        	<span>매주 1번 (월 4회)</span>
            <p></p>
        </li>
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon">
                	<p>월4</p>
               		<img src="../img/wash/wash_step_01_02_img.png"/>                    
                </ul>
                <ul class="text">
                	<li class="tip"><span>￦ 7.0 - 9.5</span></li>
                    <li class="title">베이직 패키지</li>
                    <li class="service">
                    	기본케어 (외부세차, 휠&amp;타이어 세정, 물왁스코팅)
                    </li>                
                </ul>                
                <ul class="check_btn"></ul>
            </div>            
        </li>
    </ul>
    </a>
    <!-- 베이직 패캐지 : END -->
    
    <!-- 라이트 패키지 : START -->
    <a href="<?php echo G5_URL; ?>/sub/wash_step_01.php">
    <ul class="type_btn">
    	<li class="cost">
        	<span>2주에 1번 (월 2회)</span>
            <p></p>
        </li>
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon">
                	<p>월2</p>
               		<img src="../img/wash/wash_step_01_03_img.png"/>                    
                </ul>
                <ul class="text">
                	<li class="tip"><span>￦ 5.0 - 6.5</span></li>
                    <li class="title">라이트 패키지</li>
                    <li class="service">
                    	합리적 가격과 실속 케어서비스
                    </li>                
                </ul>                
                <ul class="check_btn"></ul>
            </div>            
        </li>
    </ul>
    </a>
    <!-- 라이트 패캐지 : END -->
        
</div>

<div class="main_02">
	<a href="../../../sub/wash_info.php">
    <ul>
    	<p class="icon"><img src="../../../img/main/main_02_icon.png"/></p>
        <li>
        	퍼스트Z 정기세차가 궁금하시면?<br />
            <span>안내</span>를 확인하세요!
        </li>
        <p class="more"><span>보기</span></p>        
    </ul>
    </a>
</div>


<!-- 메인화면 최신글 시작 
<?php
//  최신글
$sql = " select bo_table
            from `{$g5['board_table']}` a left join `{$g5['group_table']}` b on (a.gr_id=b.gr_id)
            where a.bo_device <> 'pc' ";
if(!$is_admin) {
    $sql .= " and a.bo_use_cert = '' ";
}
$sql .= " order by b.gr_order, a.bo_order ";
$result = sql_query($sql);
for ($i=0; $row=sql_fetch_array($result); $i++) {
    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
    // 스킨은 입력하지 않을 경우 관리자 > 환경설정의 최신글 스킨경로를 기본 스킨으로 합니다.

    // 사용방법
    // latest(스킨, 게시판아이디, 출력라인, 글자수);
    //echo latest('theme/basic', $row['bo_table'], 12, 25);
}
?>
메인화면 최신글 끝 -->



<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');