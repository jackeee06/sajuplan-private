<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가




include_once(G5_THEME_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');


?>


<link href="<?php echo G5_THEME_URL; ?>/css/mobile.css?ver=<?=G5_CSS_VER?>" rel="stylesheet" type="text/css" />



<header id="hd">

	<div class="top_banner">

        <script language="JavaScript">
        
            //쿠키저장
            function setCookie( name, value, expiredays ) {
                var todayDate = new Date();
                todayDate.setDate( todayDate.getDate() + expiredays );
                document.cookie = name + "=" + escape( value ) + "; path=/; expires=" + todayDate.toGMTString() + ";"
            }
        
            $(document).ready(function(){
                $("#topBanner .btnClose").click(function(){
                    if($("#chkday").is(':checked')){
                        setCookie( "topPop", "done" , 1 );
                        //alert("쿠키를 생성 체크");
                    }
                    $('#topBanner').slideUp(500);
                });
            });
        
        </script>
        

    	<!--<div id="topBanner" style="display: block;"> 20250424 업체 요청으로 숨김 -->
        <div id="topBanner" style="display:none;">
        
       	<?
		$today_list = get_today_my_fortune($member["mb_id"]);
		?>
        

        <div class="bn_con">
       	        <?
		if(count($today_list)>0){
		?>
			<a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=wish&sca=&sop=and&sfl=mb_id%2C1&stx=<?=$member["mb_id"]?>">
    	<?
		}else{
		?>
			<a href="#none;" onclick="mv_notlogin();">
		<?
		}
		?>
            <ul style="width:100%; float:left;  position:relative;">
                <p style="position:relative; z-index:1; padding:10px 30% 10px 20px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; font-size:14px; color:#fff; line-height:22px; font-weight:600;">
                	소원다락방 바로가기
                    <i class="xi-angle-right" style="display:inline-block; margin-left:6px; vertical-align:-1px;"></i>
                    <!--
                    <span style="padding:4px 10px; line-height:1; border-radius:50px; background-color:rgba(255,255,255,.1); border:1px solid #fff; color:fff; display:inline-block; margin-left:10px; font-size:13px;">오늘의 운세<i class="xi-angle-right"></i></span>
                    -->
                </p>
                <p style="position:absolute; top:0; right:0; z-index:0;"><img src="../../../img/head/top_bg.png" alt="배너 이미지" style=" height:42px; width:auto;" /></p>
</ul>
			</a>
        </div>
        

        
        <div class="bn_close">
                <!--<input type="checkbox" value="checkbox" name="chkbox" id="chkday"><label for="chkday">오늘 하루 그만보기 </label>-->
                <a href="#none" class="btnClose">
                    <span><i class="xi-close"></i></span>
                </a>
        </div>
    </div>

<?
$mbirth= $member["mb_birth"];
$mb_id = $member["mb_id"];
?>
<script>
function mv_notlogin(){
	var birth = "<?=$mbirth?>";
	var mb = "<?=$mb_id?>";
	if(!mb){
		alert('로그인해주세요!');
		location.href='/bbs/login.php';
	}else if(!birth){
		alert('회원정보를 확인해주세요!');
		location.href='/bbs/register_form.php?w=u';
	}
}
</script>


    
    <script language="Javascript">
        //쿠키가 있으면 창을 안 띄우고 없으면 뛰웁니다.
        /*  20250424 업체 요청으로 숨김
		cookiedata = document.cookie;
        if ( cookiedata.indexOf("topPop=done") < 0 ){
            document.all['topBanner'].style.display = "block";
            }
        else {
            document.all['topBanner'].style.display = "none";
        }
		*/
    </script>
    </div>

    

    <div class="to_content"><a href="#container">본문 바로가기</a></div>

    <?php
    if(defined('_INDEX_')) { // index에서만 실행
        include G5_MOBILE_PATH.'/newwin.inc.php'; // 팝업레이어
        
    } ?>




    <div id="hd_wrapper">

 		
    
    
       
		<h1 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
        
        
        
    		<!--
            <a href="javascript:history.back();">
            	<img src="<?php echo G5_IMG_URL ?>/head/icon_back.png" style="width:24px; vertical-align:0;"/>
                <span class="sound_only">뒤로가기</span>
            </a> 
            -->

            <a href="<?php echo G5_URL ?>" style="display:inline-flex; align-items:center;">
                <img src="<?php echo G5_IMG_URL ?>/common/logo2.png" alt="사주문 로고" style=" height:40px; width: auto; margin-top:-6px;"/>
                <span style="margin:0 0 0 6px; line-height:1;"></span>
            </a>
            
            <?php include_once(G5_PATH.'/include/head_menu.php'); ?>
                    
    	</h1>

        

        <!-- 검색
        <button type="button" id="user_btn" class="hd_opener"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">사용자메뉴</span></button>-->
        <div class="hd_div" id="user_menu">
            <button type="button" id="user_close" class="hd_closer"><span class="sound_only">메뉴 닫기</span><i class="fa fa-times" aria-hidden="true"></i></button>
            <div id="hd_sch">
                <h2>사이트 내 전체검색</h2>
                <form name="fsearchbox" action="<?php echo G5_BBS_URL ?>/search.php" onsubmit="return fsearchbox_submit(this);" method="get">
                <input type="hidden" name="sfl" value="wr_subject||wr_content">
                <input type="hidden" name="sop" value="and">
                <input type="text" name="stx" id="sch_stx" placeholder="검색어를 입력해주세요" required maxlength="20">
                <button type="submit" value="검색" id="sch_submit"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">검색</span></button>
                </form>

                <script>
                function fsearchbox_submit(f)
                {
                    if (f.stx.value.length < 2) {
                        alert("검색어는 두글자 이상 입력하십시오.");
                        f.stx.select();
                        f.stx.focus();
                        return false;
                    }

                    // 검색에 많은 부하가 걸리는 경우 이 주석을 제거하세요.
                    var cnt = 0;
                    for (var i=0; i<f.stx.value.length; i++) {
                        if (f.stx.value.charAt(i) == ' ')
                            cnt++;
                    }

                    if (cnt > 1) {
                        alert("빠른 검색을 위하여 검색어에 공백은 한개만 입력할 수 있습니다.");
                        f.stx.select();
                        f.stx.focus();
                        return false;
                    }

                    return true;
                }
                </script>
            </div>
            <?php echo popular('theme/basic'); // 인기검색어 ?>
            <div id="text_size">
            <!-- font_resize('엘리먼트id', '제거할 class', '추가할 class'); -->
                <button id="size_down" onclick="font_resize('container', 'ts_up ts_up2', '', this);" class="select"><img src="<?php echo G5_URL; ?>/img/ts01.png" width="20" alt="기본"></button>
                <button id="size_def" onclick="font_resize('container', 'ts_up ts_up2', 'ts_up', this);"><img src="<?php echo G5_URL; ?>/img/ts02.png" width="20" alt="크게"></button>
                <button id="size_up" onclick="font_resize('container', 'ts_up ts_up2', 'ts_up2', this);"><img src="<?php echo G5_URL; ?>/img/ts03.png" width="20" alt="더크게"></button>
            </div>
        </div>


        
    </div>
</header>



<div id="wrapper">

    <div id="container">
    <?php if (!defined("_INDEX_")) { ?>
    	<!--
        <h2 id="container_title" class="top" title="<?php echo get_text($g5['title']); ?>">
    		<a href="javascript:history.back();"><i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sound_only">뒤로가기</span></a> <?php echo get_head_title($g5['title']); ?>
    	</h2>
        -->
    <?php }