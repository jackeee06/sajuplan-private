<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
?>

<?php if ($is_admin == 'super') {  ?><!-- <div style='float:left; text-align:center;'>RUN TIME : <?php echo get_microtime()-$begin_time; ?><br></div> --><?php }  ?>

<!-- ie6,7에서 사이드뷰가 게시판 목록에서 아래 사이드뷰에 가려지는 현상 수정 -->
<!--[if lte IE 7]>
<script>
$(function() {
    var $sv_use = $(".sv_use");
    var count = $sv_use.length;

    $sv_use.each(function() {
        $(this).css("z-index", count);
        $(this).css("position", "relative");
        count = count - 1;
    });
});
</script>
<![endif]-->


</div>
<!-- con_div : END --> 

</div>
<!-- body_div : END --> 




<!-- 상단으로 이동하기 버튼 -->
<a href="#" class="btn_gotop btn_gotop_btn">
  <span class="glyphicon glyphicon-chevron-up">
  	<img src="<?php echo G5_URL ?>/img/common/to_top.png" alt="상단으로 이동하기 이미지" />
  </span>
</a>

<!--고객센터 https://pf.kakao.com/_xjkVMC-->
<a href="http://pf.kakao.com/_gLTVX" class="btn_gokakao btn_gokakao_btn" target="_blank">
  <span class="">
  	<img src="<?php echo G5_URL ?>/img/tail/sns_kakao.png" alt="카카오톡 아이콘" />
  </span>
</a>

<style>
.btn_gotop_btn,
.btn_gokakao_btn {
	
	position:fixed;
	right:15px;
	z-index:999;
	cursor:pointer;
	border-radius:100%;
	width:50px;
}

.btn_gotop_btn {
	bottom:140px; display:none;}
.btn_gokakao_btn {
	bottom:80px;}

.btn_gotop_btn img,
.btn_gokakao_btn img { width:100%; border-radius:50%;}

</style>
<!-- TOP으로 이동 -->
<script>
$(window).scroll(function(){
	if ($(this).scrollTop() > 200){
		$('.btn_gotop').show();
	} else{
		$('.btn_gotop').hide();
	}
});
$('.btn_gotop').click(function(){
	$('html, body').animate({scrollTop:0},400);
	return false;
});
</script>

<script>
//  회원정보> 탭메뉴
$(window).scroll(function(){
	if ($(this).scrollTop() > 000){
		$('.btn_gotop_02').show();
	} else{
		$('.btn_gotop_02').show();
	}
});
$('.btn_gotop_02').click(function(){
	$('html, body').animate({scrollTop:0},000);
	return false;
});
</script>
  <!-- Swiper JS -->


<script src="../js/swiper.min.js"></script>
<script>
    var main_slide = new Swiper('.main_slide', { // 메인 슬라이드 배너
	  slidesPerView: 'auto',
      spaceBetween: 30,
      pagination: {
        el: '.main_slide_pagination',
        clickable: true,
      },
	  autoplay: 2500,
      autoplayDisableOnInteraction: false,
	  navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
	
    var slide_menu = new Swiper('.slide_menu', { // 메인 슬라이드 메뉴
	  autoplay: 2500,
      autoplayDisableOnInteraction: false,
	  slidesPerView: 5.3,	
      //spaceBetween: 30,
      //pagination: {
        //el: '.slide_menu_pagination',
        //clickable: true,
      //},
    });
	
    var swiper3 = new Swiper('.swiper3', {  // 슬롯배너
      spaceBetween: 30,
	  autoplay: {
        delay: 2500,
        disableOnInteraction: false,
      },
      //pagination: {
        //el: '.swiper-pagination3',
        //clickable: true,
      //},
    });
	
    var swiper_fix_banner = new Swiper('.swiper_fix_banner', {  // 슬롯배너
      spaceBetween: false,
      //pagination: {
        //el: '.swiper-pagination3',
        //clickable: true,
      //},
    });	
	
	var slide_list = new Swiper('.slide_list', { // 상담사 슬라이드 리스트
      //spaceBetween: 30,
	  slidesPerView: 3.6,
      //pagination: {
        //el: '.swiper-pagination4',
        //clickable: true,
      //},
    });
	
	var slide_list = new Swiper('.slide_column', { // 상담사 슬라이드 리스트
      //spaceBetween: 30,
	  slidesPerView: 3,
	  navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      //pagination: {
        //el: '.swiper-pagination4',
        //clickable: true,
      //},
    });
	
  </script>


<script>
	$(function(){
	 var rollHeader = 300;
	  $(window).scroll(function() {
		var scroll = getCurrentScroll();
		  if ( scroll >= rollHeader ) {
			   $('.head').addClass('roll');
			}
			else {
				$('.head').removeClass('roll');
			}
	  });
	function getCurrentScroll() {
		return window.pageYOffset || document.documentElement.scrollTop;
		}
	});
</script>



<!-- 전화상담 시작  팝업 Start -->
<?php include(G5_PATH.'/include/counsel_start_tel.php'); ?>
<!-- 전화상담 시작  팝업 End -->


<!-- 채팅상담 시작  팝업 Start -->
<?php include(G5_PATH.'/include/counsel_start_caht.php'); ?>
<!-- 채팅상담 시작  팝업 End -->



<script>

function go_chat(memid, csrid){
 confirm('채팅 상담이 시작되면 포인트 차감이 시작됩니다. 정말 상담을 시작하시겠습니까?')

	if(!memid){
		alert('회원번호가 없습니다. 관리자에 문의바랍니다.');
		return;
	}
	if(!csrid){
		alert('상담사번호가 없습니다. 관리자에 문의바랍니다.');
		return;
	}


	$.ajax({
            url: "/con/ajax.send_chat.php",
            type: "POST",
            data: {
                "memid": memid,
				        "csrid": csrid,
            },
            dataType: "json",
            success: function(data) {

			    // var rst =  rv_ajax_rtn(data);

          if(data.result == true) {
            location.href = data.url;

          } else {
            alert(data.msg);
          }
            
				alert(rst);
			 // if(rst=="error"){
				//  alert('채팅신청 에러! 관리자에문의 하세요!');
			
            }
        }); 

}

function go_tel(tel_num){
	if(tel_num){
		 window.location.href = 'tel://' + tel_num;
	}
}


function chat_close_pop(){
 $('.dim-layer-chat').fadeOut(); // 닫기 버튼을 클릭하면 레이어가 닫힌다.
 }

function con_close_pop(){
	$('.dim-layer-tel').fadeOut()// 닫기 버튼을 클릭하면 레이어가 닫힌다.	
}


function get_con_detail(mb_id, layer){

	if(!mb_id)return;


	$.ajax({
            url: "/con/ajax.get_con_detail.php",
            type: "POST",
            data: {
                "mb_id": mb_id,
            },
            dataType: "html",
            success: function(data) {
                $('#'+layer).html(data); 
            }
        }); 
}

function get_chat_detail(mb_id, layer){
	if(!mb_id)return;

	$.ajax({
            url: "/con/ajax.get_chat_detail.php",
            type: "POST",
            data: {
                "mb_id": mb_id,
            },
            dataType: "html",
            success: function(data) {
                $('#'+layer).html(data); 
            }
        }); 
}

//20250729 eun 인덱스 페이지 팝업 버튼 수정 시작
// 전화상담
// $('.btn-pop-tel').click(function(){
$(document).on('click', '.btn-pop-tel', function(){


        var $href = $(this).attr('href');
		
		var mb_id = $(this).data('mb_id');

		get_con_detail(mb_id, "layer2");
				
        layer_popup($href, mb_id);

    });
//20250729 eun 인덱스 페이지 팝업 버튼 수정 마감

    function layer_popup(el, mb_id){

        var $el = $(el);    //레이어의 id를 $el 변수에 저장
        var isDim = $el.prev().hasClass('dimBg-tel'); //dimmed 레이어를 감지하기 위한 boolean 변수

        isDim ? $('.dim-layer-tel').fadeIn() : $el.fadeIn();

	
        var $elWidth = ~~($el.outerWidth()),
            $elHeight = ~~($el.outerHeight()),
            docWidth = $(document).width(),
            docHeight = $(document).height();

        
//		$el.find('a.btn-layerClose-tel').on("click",'div',function(){
//            isDim ? $('.dim-layer-tel').fadeOut() : $el.fadeOut(); // 닫기 버튼을 클릭하면 레이어가 닫힌다.
//            return false;
//        });
//
//        $('.layer-tel .dimBg-tel').click(function(){
//            $('.dim-layer-tel').fadeOut();
//            return false;
//        });

    }

//20250729 eun 인덱스 페이지 팝업 버튼 수정 시작
// 채팅상담
/*$('.btn-pop-chat').click(function(){
        var $href = $(this).attr('href');

		var mb_id = $(this).data('mb_id');
		get_chat_detail(mb_id, "layer3");
        layer_popup02($href); //20250729 eun  채팅 팝업 마라미터 추가
    });*/

    $(document).on('click', '.btn-pop-chat', function(){
        var $href = $(this).attr('href');
        var mb_id = $(this).data('mb_id');
        get_chat_detail(mb_id, "layer3");
        layer_popup02($href, mb_id);
    });
//20250729 eun 인덱스 페이지 팝업 버튼 수정 마감

    function layer_popup02(el, mb_id){
        var $el = $(el);    //레이어의 id를 $el 변수에 저장
        var isDim = $el.prev().hasClass('dimBg-chat'); //dimmed 레이어를 감지하기 위한 boolean 변수

        isDim ? $('.dim-layer-chat').fadeIn() : $el.fadeIn();

        var $elWidth = ~~($el.outerWidth()),
            $elHeight = ~~($el.outerHeight()),
            docWidth = $(document).width(),
            docHeight = $(document).height();

//        $el.find('a.btn-layerClose-chat').click(function(){
//            isDim ? $('.dim-layer-chat').fadeOut() : $el.fadeOut(); // 닫기 버튼을 클릭하면 레이어가 닫힌다.
//            return false;
//        });
//
//        $('.layer-chat .dimBg-chat').click(function(){
//            $('.dim-layer-chat').fadeOut();
//            return false;
//        });
    }
	
</script>



<script>
// 휴대폰번호 자동 '-' 입력
						$(document).on("keyup", ".phoneNumber", function() { 
							$(this).val( $(this).val().replace(/[^0-9]/g, "").replace(/(^02|^0505|^1[0-9]{3}|^0[0-9]{2})([0-9]+)?([0-9]{4})$/,"$1-$2-$3").replace("--", "-") ); 
						});

</script>

<script>
$(function(){
  // 눈표시 클릭 시 패스워드 보이기
  $('.eyes').on('click',function(){
    $('.input.password').toggleClass('active');

    if( $('.input.password').hasClass('active') == true ){
    	$(this).find('.xi-eye-o').attr('class',"xi-eye-off-o").parents('.input').find('.mb_password').attr('type',"text");
    				// i 클래스                // 텍스트 보이기 i 클래스
    }
    else{
    	$(this).find('.xi-eye-off-o').attr('class',"xi-eye-o").parents('.input').find('.mb_password').attr('type','password');
    }
  });
});
</script>


<?php run_event('tail_sub'); ?>

</body>



<!-- 24.10.16 pixel gaf -->
<!-- Be careful to modify or delete. -->
<!--<script>var yTOTy = ({"ua" : location.href ,"ub" : document.referrer ,"w" : "KRW" ,"gafa" : "yclass" ,"adsa" : "" ,"dbg" : ''});var ySck = function(name, value, exp) {var date = new Date();date.setTime(date.getTime() + exp*24*60*60*1000);document.cookie = name + '=' + value + ';expires=' + date.toUTCString() + ';path=/';};var yGck = function(name) {var value = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|jQuery)');return value? value[2] : null;};function yPcd(sname){var params = location.search.substr(location.search.indexOf("?") + 1);var sval = "";params = params.split("&");for (var i = 0; i < params.length; i++) {temp = params[i].split("=");if([temp[0]] == sname) { sval = temp[1]; }}return sval;};var yDvc = /iPad/.test(navigator.userAgent) ? "t" : /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Silk/.test(navigator.userAgent) ? "m" : "p";setTimeout( function(){try{var yClass = yGck('y_SignUp');if(yClass == 'ok'){dataLayer.push({"event":"yJOINy"});ySck('y_SignUp', '');if(yTOTy.dbg == 'on'){ console.log('ga4 send'); };}else{if(yTOTy.dbg == 'on'){ console.log( 'ga4 double' ); };};}catch(error){console.error(error);};},1000);</script>-->
<!-- 24.10.16 script end -->

<!-- NAVER SCRIPT START -->
<script type="text/javascript" src="//wcs.naver.net/wcslog.js"></script>
<script type="text/javascript">
if (!wcs_add) var wcs_add={};
wcs_add["wa"] = "s_2e874f1d2162";
if(window.wcs) {
wcs.inflow("sajumoon.co.kr");
wcs_do();
}
</script>
<!-- NAVER SCRIPT END -->

</html>
<?php


echo html_end(); // HTML 마지막 처리 함수 : 반드시 넣어주시기 바랍니다.


sql_close();