<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "앱 설정";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
################################################


$push_all = $member["push_all"];
?> 

<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 


<div class="con_section_02">
    <?
				$push_all_class = "";
				$push_all_check = "";
				if($push_all=="Y"){
					$push_all_class = "switchon";
					$push_all_check = "checked='checked'";
				}
			?>
    <ul class="set_div">        
		<li class="dis_none" style="background-image:url(../img/etc/icon_push.png);">
	        푸시알림설정
       		<label class="switch">
  				<input name="push_all" type="checkbox" id="push_all"  onclick="set_push_mb('push_all')" value="Y" <?=$push_all_check?> <?=$push_all_class?>>
  				<span class="slider round" id="push_all_c"></span>
			</label>              
        </li>
        
	</ul>
    
	<ul class="set_div"> 
        <!--
        <li style="background-image:url(../img/etc/icon_secret.png);">
            <a>고객센터</a>
        </li>
        -->
        
		
        <li style="background-image:url(../img/etc/icon_partner.png);">
			

			
			<a href="#none;" id="review_url">리뷰로 응원하기</a>
        </li>        
		<script>
			$(function(){
				let mode = "";
				const user = navigator.userAgent;
				if ( user.indexOf("iPhone") > -1 || user.indexOf("Android") > -1 ) {
					if(user.indexOf("iPhone") > -1){
						$("#review_url").attr("href","");
					}else{
						$("#review_url").attr("href","https://play.google.com/store/apps/details?id=kr.co.devedu.thesaju");
					}
				}
			});
		</script>
        <li style="background-image:url(../img/etc/icon_event.png);">
            <a href="../bbs/board.php?bo_table=notice">공지사항</a>
        </li>
    </ul>

    
    <ul class="set_div">    
        <li style="background-image:url(../img/etc/icon_guide.png);">
            <a href="../etc/provision.php" target="_self" class="">이용약관</a>
        </li>
        
        <li style="background-image:url(../img/etc/icon_privacy.png);">
            <a href="../etc/privacy.php" target="_self" class="">개인정보처리방침</a>
        </li>
    </ul>
    
    <!--
    <ul class="set_div">    
        <li class="text_item" style="background-image:url(../img/etc/icon_category.png);">
            앱 정보
            <span id="app_version">ver 1.1</span>
        </li>
    </ul>    
	-->
</div>


<script>
function get_version(){
	let ver = 1.1;
	
    
    if ( user.indexOf("iPhone") > -1 || user.indexOf("Android") > -1 ) {
    	ver = window.Emcfunction.getVersionInfo();
		//	alert(ver);
    }
	
}

function set_version(ver){
	ver = 'ver '+ver;
	$("#app_version").html(ver);
}

get_version();

function set_push_mb(m){
	push_set(m);
}


function push_set(m){
		$.ajax({
			type: "POST",
			url: "/etc/ajax_push_state_update.php",
			data: { id: m },
			contentType: 'application/x-www-form-urlencoded; charset=euc-kr',
			dataType: "html",
			success: function(data) {
                const obj       = (typeof data === 'string') ? JSON.parse(data) : data;
                const params    = [];
                const un_params = [];
                const currentYear = new Date().getFullYear();
                
                if(obj.push_chk == "Y"){ // 푸시 ON 상태
                 
                    params.push(`chl_${obj.data.mb_level}`);
                    params.push(`chl_all`);
                    try {
                        // if (obj.data.mb_birth) {
                        //         const d = new Date(obj.data.mb_birth);
                        //         if (!isNaN(d)) {
                        //             params.push(`chl_birth_${d.getFullYear()}`);
                        //         }
                        // }
                    } catch (error) {
                            
                    }

                }else{
                    un_params.push(`chl_all`);
                    un_params.push(`chl_2`);
                    un_params.push(`chl_5`);
                }
                console.log('구독',params)
                console.log('구독해제',un_params)
                push_topic_update(params,un_params);
			}
		});	
}



</script>
    


<?php include_once("../include/leave.php"); ?>




<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once("../include/tail.sub.php");
?> 
