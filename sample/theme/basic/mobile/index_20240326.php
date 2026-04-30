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

.main_login {width:100%; float:left; font-size:18px; color:#000; padding:15px 15px 20px; font-weight:600; margin-top: 10px; line-height: 1.6; border-bottom: 15px solid #e9e9e9;}
.main_login .main_login_info {position:relative;}
.main_login .main_login_info .mem_info {position:relative; font-size: 18px; color: #000;}
.main_login .main_login_info .mem_info span {font-weight: 700;}
.main_login .main_login_info .mem_info i {vertical-align:-1px;}
.main_login .main_login_info .mem_info_btn {display: inline-block; margin-top: 20px; color: #fff; padding:0px 10px;}
.main_login .main_login_info .car_btn { background-color:#2b3990; border-radius:50px; margin-right:6px; font-size: 14px; line-height:30px; }
.main_login .main_login_info .manager_btn { background-color:#000; border-radius:4px; text-align:center; font-size: 16px; line-height:36px; width:calc(50% - 5px); float:left;}
.main_login .main_login_info .manager_btn:last-child { margin-left:10px;}
</style>


<div class="main_slide">

	<ul class="main_login">
    	<!-- 회원일 때 -->
		<? if ($is_member) {?>
        	<!-- 매니저 이상(권한 3 이상) -->
        	<?php if($member['mb_level']>2){ ?>

                <li class="main_login_info">
                	<a href="<?php echo G5_URL; ?>/shop/mypage.php">
            		<p class="mem_info">
						안녕하세요!<br />
                        <span class="mint"><?php echo $member['mb_name'];?></span> 매니저님
                    	<i class="xi-arrow-right"></i>
                	</p>
                    </a>
                    
                    <a href="../my/car_list.php" class="mem_info_btn manager_btn">담당차량 목록</a>
                    
                    <a href="../bbs/board.php?bo_table=history" class="mem_info_btn manager_btn">세차내역 작성</a>
            	</li>

            <!-- 고객(권한 2) -->
            <? } else { ?>
            	
                <li class="main_login_info">
                	<a href="<?php echo G5_URL; ?>/shop/mypage.php">
            		<p class="mem_info">
						<span class="mint"><?php echo $member['mb_name'];?></span>님은<br />
    	            	<span>퍼스트지 카케어</span>를 이용중이십니다
                    	<i class="xi-arrow-right"></i>
                	</p>
                    </a>
                    
                    <a href="../bbs/board.php?bo_table=service&wr_id=4" class="mem_info_btn car_btn">티구안 1234</a>
                    
                    <a href="../bbs/board.php?bo_table=service&wr_id=3" class="mem_info_btn car_btn">아반떼 5678</a>
            	</li>

            <?php } ?>
		
        <!-- 비회원일 때 -->
		<? } else {?>
			<a href="<?php echo G5_URL; ?>/bbs/login.php">
            <li class="main_login_info">
	            <span class="mint">로그인</span>하시면,<br />
    			맞춤 차량관리를 제공해 드려요!
            </li>
            </a>
		<? } ?>
        
	</ul>

	<ul class="main_slide_ul">

  	<!-- Swiper -->  
  	<div class="swiper-container">
        <div class="swiper-wrapper">
            <div class="swiper-slide"><a href="<?php echo G5_URL ?>/sub/wash_step_01.php"><img src="<?php echo G5_URL ?>/../../img/main/01.png"/></a></div>
            <div class="swiper-slide"><a href="<?php echo G5_URL ?>/sub/wash_info.php"><img src="<?php echo G5_URL ?>/../../img/main/02.png"/></a></div>
            <div class="swiper-slide"><a href="<?php echo G5_URL ?>/sub/wash_info_package.php"><img src="<?php echo G5_URL ?>/../../img/main/03.png"/></a></div>
            <div class="swiper-slide"><a href="<?php echo G5_URL ?>/bbs/board.php?bo_table=event"><img src="<?php echo G5_URL ?>/../../img/main/04.png"/></a></div>
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


<div class="sub_div type_btn_wrap" style=" padding-bottom:0;">	
	
    <!-- 프리미엄 패캐지 : START -->
    <ul class="type_btn">
    	<a href="<?php echo G5_URL; ?>//bbs/write.php?bo_table=service&sca=소형">
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon"><img src="<?php echo G5_URL ?>/img/main/wash_cate_01.png"/></ul>
                <ul class="text">
                    <li class="title" style=" color:#459084;">소형차<p>작은 차 큰 기쁨!</p></li> 
                	<li class="tip"><span>￦30,000~</span></li>
                </ul>
            </div>            
        </li>
        </a>
    </ul>
    <!-- 프리미엄 패캐지 : END -->
    
    <!-- 베이직 패키지 : START -->
    <ul class="type_btn">
    	<a href="<?php echo G5_URL; ?>//bbs/write.php?bo_table=service&sca=중형">
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon"><img src="<?php echo G5_URL ?>/img/main/wash_cate_02.png"/></ul>
                <ul class="text">
                	<li class="title" style=" color:#829cf0;">중형차<p>실속파 차량관리!</p></li> 
                	<li class="tip"><span>￦40,000~</span></li>
                </ul>
            </div>            
        </li>
        </a>
    </ul>
    <!-- 베이직 패캐지 : END -->
    
    <!-- 라이트 패키지 : START -->
    <ul class="type_btn">
    	<a href="<?php echo G5_URL; ?>//bbs/write.php?bo_table=service&sca=대형">
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon"><img src="<?php echo G5_URL ?>/img/main/wash_cate_03.png"/></ul>
                <ul class="text">
                	<li class="title" style=" color:#8560a8;">대형차<p>카케어의 시작!</p></li> 
                	<li class="tip"><span>￦50,000~</span></li>           
                </ul>
            </div>            
        </li>
        </a>
    </ul>    
    <!-- 라이트 패캐지 : END -->
    
    <!-- 라이트 패키지 : START -->
    <ul class="type_btn">
    	<a href="<?php echo G5_URL; ?>//bbs/write.php?bo_table=service&sca=초대형">
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon"><img src="<?php echo G5_URL ?>/img/main/wash_cate_04.png"/></ul>
                <ul class="text">
                	<li class="title" style=" color:#1b1464;">초대형차<p>품격있는 카케어!</p></li> 
                	<li class="tip"><span>￦60,000~</span></li>
                </ul>
            </div>            
        </li>
        </a>
    </ul>
    
    <!-- 라이트 패캐지 : END -->
    
    <!-- 라이트 패키지 : START -->
    <ul class="type_btn">
    	<a href="<?php echo G5_URL; ?>//bbs/write.php?bo_table=service&sca=SUV·RV">
        <li class="type_con">        	
            <div class="type_con_div">
            	<ul class="icon"><img src="<?php echo G5_URL ?>/img/main/wash_cate_05.png"/></ul>
                <ul class="text">
                	<li class="title" style=" color:#f26d7d;">SUV·RV<p>레저에도 프리미엄!</p></li> 
                	<li class="tip"><span>￦70,000~</span></li>
                </ul>
            </div>            
        </li>
        </a>
    </ul>
    <!-- 라이트 패캐지 : END -->    
        
</div>

<div class="main_02">
	<a href="<?php echo G5_URL ?>/../../sub/wash_info_package.php">
    <ul>
    	<p class="icon"><img src="<?php echo G5_URL ?>/../../img/main/main_02_icon.png"/></p>
        <li>
        	퍼스트지 정기세차가 궁금하시면?<br />
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