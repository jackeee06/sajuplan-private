<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if(G5_COMMUNITY_USE === false) {
    include_once(G5_THEME_MSHOP_PATH.'/index.php');
    return;
}

include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>


<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_home.css" type="text/css">

<!-- HEAD 회색으로 변경 -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/mobile_shop.css">

<!-- 메인 슬라이드 CSS -->  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">

<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.css">

<!-- HEAD 회색으로 변경  	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_head.css">
 -->
<!-- BODY 회색으로 변경 	
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_body.css">
-->  



<style>


/* 메인섹션 타이틀 공통CSS */
.main_title {width:100%; float:left; font-size:18px; color:#000; line-height:1.3; padding:15px 15px 0; font-weight:600;}
.main_title span {color:#13a89e;}
.main_title p { font-size:14px; color:#999;font-weight:400;}

.main_slide {width:100%; float:left;}
.main_slide ul.main_slide_ul {position:relative; width:100%; float:left; padding-bottom:30px;}

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

.main_state_wrap {display:flex; justify-content: center; padding: 10px; gap: 9px;}
.main_state {width:100%; padding:10px 5px 5px; display:flex; border-radius:6px;justify-content: center; align-items: center; background-color:#FDECF0; text-align:center;}

.main_state .main_state_name {font-size:12px; color:#000; font-weight:500;}
.main_state .main_state_name p {display:block; font-weight:500;}
.main_state .main_state_name .conuter span{font-size:15px; font-weight:700; color:#E84263;}
.main_state .main_state_con {font-size:18px; font-weight:800;}






.counselor_tap_title {width: 100%; float: left; text-align:center; padding: 20px 20px 0; font-size:16px;}


</style>


<?php echo display_banner('메인-비주얼', 'mainbanner.10.skin.php'); ?>


<ul class="main_state_wrap" >
	<li class="main_state" >
    	<div class="main_state_name" >
        	<p>최근 <!--일주일--><span style="font-weight:600">상담 건수</span></p>
			<div class="conuter"><span id="count"></span><span class="count_text">건</span></div>
        </div>

    </li>
    
    <li class="main_state" >
    	<div class="main_state_name" >
        	<p>현재 접속중인 <span style="font-weight:600">상담사</span></p>
			<div class="conuter"><span id="mcount"></span><span class="count_text">명</span></div>
        </div>

    </li>
</ul>

<?
$wcount = number_format(get_week_con_num());
$mcount = get_now_conn_con();
?>

<script>
let wcount = "<?=$wcount?>";
let mcount = "<?=$mcount?>";
new RollingNum('mcount',mcount,'slide');
new RollingNum('count',wcount,'slide');


function RollingNum(id, number, type) {
	var $cntBox = document.getElementById(id);
	var $cntNum = number;
	var $cntLen = $cntNum.length;
	var $numArr=$cntNum.split('');
	var delay = 300;
	var speed = 100;
	
	
	// 카운트
	for ( var i=0; i<$cntLen; i++){
		var bckI = ($cntLen - i*1) -1;
		var num = document.createElement('span');
		num.classList.add('num', 'idx'+bckI);
		num.setAttribute('data-num',$numArr[i]);
		
		$cntBox.append(num);
		setNum (num, i);
	}
	//,처리
	if ($cntLen>3) {
		for (var i=1; i<=Math.floor($cntLen/3); i++) {
			var idx3n = $cntBox.querySelector('.idx'+i*3);
			var count_dotEl = document.createElement('span');
			count_dotEl.classList.add('count_dot');
			idx3n.after(count_dotEl);
		}
		setTimeout(function(){
			var count_dot = $cntBox.querySelectorAll('.count_dot');
			count_dot.forEach(el => {
				el.innerText=','
			});
		},(speed*10) + ($cntLen * delay) + speed);
	};

	function setNum (el, n){
		if (type == 'slide') {
			setTimeout(function(){
				var no=0;
				var numHeight = 30;
				// style 추가
				var style = document.createElement('style');
				style.innerHTML=
					".num, .count_dot {display: inline-block;vertical-align: middle;}\
					.num {overflow: hidden;}\
					.numList {display: inline-block;margin-top:0;text-align: center;transition: all "+(speed/1000)+"s;}"
				document.body.appendChild(style);

				var numbersDiv = document.createElement('span');
				var numbers = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9';
				el.style='height:'+numHeight+'px;line-height:'+numHeight+'px;';
				numbersDiv.classList.add('numList');
				numbersDiv.innerText = numbers;
				el.append(numbersDiv);

				var intervalNo = setInterval(function(){
					no++;
					numbersDiv.style='margin-top:'+(no * numHeight * -1)+'px;';
					if(no == 10) {
						clearInterval(intervalNo);
						numbersDiv.style='margin-top:'+(el.getAttribute('data-num') * numHeight * -1)+'px';
					}
				},speed);
			}, delay*i);
		}else {
			setTimeout(function(){
				var no=0;
				var intervalNo = setInterval(function(){
					el.innerText = no++;
					if(no == 10) {
						clearInterval(intervalNo);
						el.innerText = el.getAttribute('data-num');
					}
				},speed);
			}, delay*i);
		}
	}
}
</script>




<!-- 최근 상담사 -->
<div class="recent_counselor">
	<div class="top">
		<img src="../../../img/main/heart_icon.png">
		<p><span class="counselor_name">김민수</span>님의 최근 상담사</p>
	</div>
	<!-- 첫 상담 만족도 // 최근 상담사가 없을 시 나옴-->
	<div class="first_consultation">
		<a class="">
			<p><span style="font-weight:600;">첫 상담 만족도가 높은 상담사</span>를 추천해드려요!</p>
			<img src="../../../img/main/right_ar.svg" >
		</a>
	</div>
	<!-- 최근 상담사 내용 -->
	<div class="swiper recent_counselor_slide">
		<ul class="swiper-wrapper">
			<li class="swiper-slide on"><!-- 바로 연결로 되면 on이 생긴다. -->
				<p>타타몽</p>
				<div class="d-flex">
					<span class="call_c"></span>
					<p>바로연결</p>
				</div>
			</li>
			<li class="swiper-slide">
				<p>수호선</p>
				<div class="d-flex">
					<span class="call_c"></span>
					<p>3분후</p>
				</div>
			</li>
			<li class="swiper-slide">
				<p>수호선</p>
				<div class="d-flex">
					<span class="call_c"></span>
					<p>3분후</p>
				</div>
			</li>
		</ul>
	</div>
	<script>
		var swiper = new Swiper(".recent_counselor_slide", {
			slidesPerView: "auto",
			spaceBetween: 6,
		});
	</script>
</div>

<!-- 이벤트베너 // 관리자에서 이벤트 가져오면 됩니다. -->
<div class="main-event">
	<img src="../../../img/main/event-img.png">
</div>

<div class="recommend">
	<div class="top">
		<div class="flex align-items-center justify-content-between">
			<div class="flex align-items-center">
				<img src="../../../img/main/star_icon.png" style="width:20px; margin-bottom:4px">
				<p>사주문 추천</p>
			</div>
			<a href="">더보기 <img src="../../../img/main/right_g_ar.svg"></a>
		</div>
	</div>
	<div class="swiper recommend-slide">
		<ul class="swiper-wrapper">
			<li class="swiper-slide">
				<div class="proflie">
					<img src="">
				</div>
				<div class="counselor_s_info">
					<div class="top">
						<span class="icon_cate saju">사주</span>
						<p>복숭아생성</p>
					</div>
					<div class="bottom">
						<p><span>1,200원</span> 분당</p>
						<span class="g-line"></span>
						<div class="flex align-items-center gap_02">
							<img src="../../../img/main/ic_star.svg">
							<p>4.8</p>
						</div>
					</div>
				</div>
			</li>
			<li class="swiper-slide">
				<div class="proflie">
					<img src="">
				</div>
				<div class="counselor_s_info">
					<div class="top">
						<span class="icon_cate saju">사주</span>
						<p>복숭아생성</p>
					</div>
					<div class="bottom">
						<p><span>1,200원</span> 분당</p>
						<span class="g-line"></span>
						<div class="flex align-items-center gap_02">
							<img src="../../../img/main/ic_star.svg">
							<p>4.8</p>
						</div>
					</div>
				</div>
			</li>
			<li class="swiper-slide">
				<div class="proflie">
					<img src="">
				</div>
				<div class="counselor_s_info">
					<div class="top">
						<span class="icon_cate saju">사주</span>
						<p>복숭아생성</p>
					</div>
					<div class="bottom">
						<p><span>1,200원</span> 분당</p>
						<span class="g-line"></span>
						<div class="flex align-items-center gap_02">
							<img src="../../../img/main/ic_star.svg">
							<p>4.8</p>
						</div>
					</div>
				</div>
			</li>
		</ul>
	</div>
	<script>
		var swiper = new Swiper(".recommend-slide", {
			slidesPerView: "auto",
			spaceBetween: 10,
		});
	</script>
</div>


<div class="page_tap sub_section_100">
	<!--<input type="radio" name="tabmenu" id="tab01" checked>-->
	<input type="radio" name="tabmenu" id="tab02" checked>
	<input type="radio" name="tabmenu" id="tab03">
	<input type="radio" name="tabmenu" id="tab04">
	<input type="radio" name="tabmenu" id="tab05">
	<input type="radio" name="tabmenu" id="tab06">
	<div class="btn_wrap counselor_list_btn">
		<!--<label for="tab01">상담중</label>-->
		<label for="tab02">급상승 <span class="hot_new">HOT</span></label>
		<label for="tab03">스카웃</label>
		<label for="tab04">채팅</label>
		<label for="tab05">전체</label>
		<label for="tab06">후기 <span class="hot_new">NEW</span></label>
	</div>	
    

    
	<div class="conbox con1" id="mtab1" style=" display:none;">
	<?
			$sql = "select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state='CONN'";
		$rst = sql_fetch($sql);
		$ct = $rst["ct"];
		?>
		<div class="counselor_tap_title">현재 <span class="orange" style="font-weight:700;"><?=$ct?>명</span>이 상담 진행중입니다.</div>

		<div class="latest_wr">
		    <?php
			$itab = "ing";
			

		   echo latest('theme/counselor_latest', 'counselor',7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		</div>	
	  <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
   </div>


<!-- 상담중 불러오기 -->
<script>
//function rd_main_1(){
//	$.ajax({
//		url: "/sub/main_tab1.php",
//		type:"POST",
//		data:{},
//		timeout: 1000 * 120,
//		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
//		success: function(data) {
//			if(data){
//				$("#mtab1").html(data)
//			}			
//		},
//		error: function(e) {
//			//alert(JSON.stringify(e));
//		},
//		timeout: 5000
//	});
//}

//setInterval(function(){
   // rd_main_1();
//}, 2000)
</script>


    <!-- 급상승 -->
	<div class="conbox con2">
		<!-- <div class="counselor_tap_title" >3일간 상담시간 <span class="orange" style="font-weight:700;">TOP 5</span></div> -->

		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
			$itab = "best";
		    echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>        

        <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>

    </div>
	<!-- 스카웃 -->
    <div class="conbox con3">

		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
				$itab = "sco";
		    echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>
 
        <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>

    </div>
	<!-- 채팅 -->
    <div class="conbox con4">

		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
			$itab = "idle";
		    echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>
  
        <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
    </div>
	<!-- 전체 -->
	<div class="conbox con5">
		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
			$itab = "idle";
		    echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>     
        <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
    </div>
	<!-- 후기 -->
	<div class="conbox con6">
		<div class="latest_wr">
		    <!-- 사진 최신글2 { -->
		    <?php
		    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
		    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
		    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
			$itab = "idle";
		    echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
		    ?>
		    <!-- } 사진 최신글2 끝 -->
		</div>
                
        <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
    </div>

</div>


<div style="position:relative; width:100%; float:left; ">
<?php echo display_banner('메인-중앙배너', 'mainbanner.20.skin.php'); ?>
</div>


<?php if($is_member){ ?>

<div class="counselor_list_wrap" >
        	
  <h2 style=" width:100%; float:left; font-size:20px; font-weight:600; padding:20px 20px 0;">사주문 AI 상담사 추천!</h2>

	<div class="counselor_list bo_none" >
       <?php
	    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
	    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
	    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
		$itab="ai";
	    echo latest('theme/counselor_latest_02', 'counselor', 2, 23);		// 최소설치시 자동생성되는 갤러리게시판
	    ?>
    </div>
            
</div>            

<?php } ?>


<link href="https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.css" rel="stylesheet" type="text/css"/>

<div class="main_footer">
	<div class="main_footer_manu">
    	<p class="sns">
        	<a href="https://instagram.com/the.saju" target="_blank">
            	<span><img src="../img/tail/sns_instagram.png" alt="인스타그램" /></span>
            </a>
            
            <a href="http://pf.kakao.com/_gLTVX" target="_blank">
            	<span><img src="../img/tail/sns_kakao.png" alt="카카오톡" /></span>
            </a>
            
            <a href="https://m.blog.naver.com/fbtjrwns2" target="_blank">
            	<span><img src="../img/tail/sns_blog.png" alt="블로그" /></span>
            </a>
            
            <a href="https://youtube.com/@TheSaju" target="_blank">
            	<span><img src="../img/tail/sns_youtube.png" alt="유튜브" /></span>
            </a>
            
       	  <a href="https://www.tiktok.com/@thesaju" target="_blank">
            	<span><img src="../img/tail/sns_tiktok.png" alt="틱톡" /></span>
            </a>
        </p>
        
    	<a href="../etc/provision.php"><span class="policy">이용약관</span></a>
        <span class="dot">·</span>
        <a href="../etc/privacy.php"><span class="point">개인정보취급방침</span></a>
    </div>
	<details class="company company_more" open="open">
    	<summary class="company_title">
    		<span>더마즈 사업자정보</span>
	    </summary>
    	<div class="company_info">
	    	<span>대표자</span> <?php echo $default ['de_admin_company_owner'] ?><br />
            <span>주소</span> <?php echo $default ['de_admin_company_addr'] ?><br />
			<span>사업자등록번호</span> <?php echo $default ['de_admin_company_saupja_no'] ?><br />			
			<span>통신판매자신고번호</span> <?php echo $default ['de_admin_tongsin_no'] ?><br />
			<span>대표전화</span> <?php echo $default ['de_admin_company_tel'] ?><br />
            <span>이메일</span> <?php echo $default ['de_admin_info_email'] ?><br />
			<span>제휴 및 상담사 채용 문의</span> themaj_2@naver.com<br />
	    </div>
  	</details>
    
    <div class="main_footer_copy">Copyrightⓒ 사주문. All Rights Reserved.</div>
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

<!-- 메뉴 링크 -->
<!-- <div class="con_section sub_section_100 main_navi" >
	<ul class="main_navi_item" >
		<a href="../bbs/board.php?bo_table=counselor&sca=타로">
		<img src="../../../img/main/main_menu_01.png" alt="타로" />
        <p class="main_navi_name" >타로</p>
        </a>
    </ul>
	<ul class="main_navi_item" >
		<a href="../bbs/board.php?bo_table=counselor&sca=신점">
		<img src="../../../img/main/main_menu_02.png" alt="신점" />
        <p class="main_navi_name" >신점</p>
        </a>
    </ul>
	<ul class="main_navi_item" >
		<a href="../bbs/board.php?bo_table=counselor&sca=사주">
		<img src="../../../img/main/main_menu_03.png" alt="사주" />
        <p class="main_navi_name" >사주</p>
        </a>
    </ul>
	<ul class="main_navi_item" >
		<a href="../bbs/board.php?bo_table=counselor&sca=심리">
		<img src="../../../img/main/main_menu_04.png" alt="심리" />
        <p class="main_navi_name" >심리</p>
        </a>
    </ul>
	<ul class="main_navi_item" >
		<a href="../bbs/board.php?bo_table=review">
		<img src="../../../img/main/main_menu_05.png" alt="후기" />
        <p class="main_navi_name" >후기</p>
        </a>
    </ul>
</div>
 -->


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');