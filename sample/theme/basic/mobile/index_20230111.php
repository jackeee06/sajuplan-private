<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    include_once(G5_THEME_MSHOP_PATH.'/index.php');
    return;
}

include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>



<script src="http://code.jquery.com/jquery-latest.js"></script>


<div class="main_slide">

	<ul class="main_title">
		<? if ($is_member) {?>
			안녕하세요, <span><?php echo $member['mb_nick'];?></span>님!<br />
    		어떤 서비스가 필요하세요?
		<? } else {?>
			<span>로그인</span>하시면,<br />
    		맞춤 차량관리를 제공해 드려요!
		<? } ?>
        
	</ul>

	<ul class="main_slide_ul">
  	
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.main.css">

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
	.swiper-slide img { width:100%; border-radius:16px 16px 16px 60px; box-shadow:5px 5px 10px rgba(0,0,0,.12);  }
  	</style>

  	<!-- Swiper -->
  
  	<div class="swiper-container">
        <div class="swiper-wrapper">
            <div class="swiper-slide"><img src="../../../img/main/slide_01.png"/></div>
            <div class="swiper-slide"><img src="../../../img/main/slide_02.png"/></div>
            <div class="swiper-slide"><img src="../../../img/main/slide_03.png"/></div>
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
        //centeredSlides: true,
        autoplay: 2600,
        autoplayDisableOnInteraction: false,
		breakpoints: { //반응형 조건 속성
        640: { //640 이상일 경우
          slidesPerView: 1.2, //레이아웃 2열
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
    	편리하고 스마트한 차량관리
        <p>슬기로운 차량관리 오토보스</p>
    </ul>
    
    <ul class="con">
    	<a href="<?php echo G5_URL; ?>/sub/wash_step_01.php">
    	<li>
   	    	<p class="icon"><img src="../../../img/main/main_01_icon_01.png"/></p>
            <p class="title">정기세차</p>
            <p class="text" style=" ">고민하지 말고 편리한 오토보스에서</p>
        </li>
        </a>
        
        <a href="<?php echo G5_BBS_URL; ?>/board.php?bo_table=pr">
        <li>
   	    	<p class="icon"><img src="../../../img/main/main_01_icon_02.png"/></p>
            <p class="title">제휴업체</p>
            <p class="text" style=" ">차량관리 서비스를 원하신다면</p>
        </li>
        </a>
    </ul>
</div>

<div class="main_02">
	<a href="../../../sub/wash_info.php">
    <ul>
    	<p class="icon"><img src="../../../img/main/main_02_icon.png"/></p>
        <li>
        	오토보스 정기세차가 궁금하시면?<br />
            <span>안내</span>를 확인하세요!
        </li>
        <p class="more"><span>보기</span></p>        
    </ul>
    </a>
</div>

<style>

/* 메인섹션 타이틀 공통CSS */
.main_title {width:100%; float:left; font-size:18px; color:#000; line-height:150%; padding:15px; font-weight:600;}
.main_title span {color:#2b3990; border-bottom:1px solid #2b3990;}
.main_title p { font-size:14px; color:#999;font-weight:400;}

.main_slide {width:100%; float:left;}
.main_slide ul.main_slide_ul {position:relative; width:100%; float:left; padding-left:15px; padding-top:5px; padding-bottom:30px;}

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

.main_02 {width:100%; float:left; padding:15px;}
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



<div class="main_03">
	<ul class="main_title">프리미엄 멤버십</ul>
    <ul class="con">
    	
        <!--[ 프리미엄 세차 ]-->
        <li>
   	    	<img src="../../../img/main/main_03_img_01.png"/> 
            <p class="text">
            	<span class="name">프리미엄 세차</span>
                <span class="sub_text_01">믿고 맡기는 프리미엄 세차</span>
                <span class="sub_text_02">5회 진행시 1회 무료</span>
            </p>
            <p class="main_03_btn"><span>예약</span></p>
        </li>
        
        <!--[ 광택·코팅 ]-->
        <li>
   	    	<img src="../../../img/main/main_03_img_02.png"/> 
            <p class="text">
            	<span class="name">광택·코팅</span>
                <span class="sub_text_01">중고차를 새차로 만드는 효자템</span>
                <span class="sub_text_02">1회 진행시 5% 할인</span>
            </p>
            <p class="main_03_btn"><span>예약</span></p>
        </li>
        
        <!--[ 프리미엄 세차 ]-->
        <li>
   	    	<img src="../../../img/main/main_03_img_03.png"/> 
            <p class="text">
            	<span class="name">실내크리닝</span>
                <span class="sub_text_01">실내 냄새제거까지 완벽하게</span>
                <span class="sub_text_02">3회 진행시 10% 할인</span>
            </p>
            <p class="main_03_btn"><span>예약</span></p>
        </li>
        
        <!--[ 프리미엄 세차 ]-->
        <li>
   	    	<img src="../../../img/main/main_03_img_04.png"/> 
            <p class="text">
            	<span class="name">세라믹코팅</span>
                <span class="sub_text_01">오토보스만의 디테일링 코팅</span>
                <span class="sub_text_02">1회 진행시 5% 할인</span>
            </p>
            <p class="main_03_btn"><span>예약</span></p>
        </li>
        
    </ul>
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