<?php 
include_once('../common.php'); 
// 페이지 제목 
$g5['title'] = "앱 정보";  
include_once(G5_THEME_MOBILE_PATH.'/head.php');
//include_once('../sub/sub_tap_css.php'); 
 
?> 


 
<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<style>

body {}

.div_100 {
    width: calc(100% + 0px);
    float: left;
}
</style>

<div class="div_100">

	<ul>
    	<li style="width:100%; float:left; padding:50px 0; text-align:center;background-color:#fff;">
   	    	<img src="../img/mobile/my/ver_icon.png" style="width:30%; border-radius:20%; max-width:150px; ">
            <p style=" text-align:center; padding-top:15px; font-size:24px; font-weight:600;">퍼스트지</p>
            <span style="display:inline-block; margin-top:15px; padding:4px 12px; background-color:#f5f5f5; border-radius:50px; font-size:14px; color:#777;">현재버전 1.0</span>
        </li>
    </ul>
    
    <div style="width:100%; float:left; padding:15px 15px 30px; background-color:#f5f5f5; color:#222; position:relative;">
		
        <ul style="width:100%; float:left; font-size:18px; font-weight:600; padding-bottom:20px; margin-bottom:0px;">
        	사업자정보 <i class="fa fa-caret-down" aria-hidden="true" style="display:inline-block; margin-left:4px; color:#3b56a6;"></i>
        </ul>
        
		<ul style="width:100%; float:left; font-size:16px; font-weight:600; color:#3b56a6;">오토핸즈</ul>

    	<ul style="width:100%; float:left; margin:0px 0; font-size:14px; color:#707070;">
        	<li style="width:100%; float:left; line-height:1.8; font-weight:500; margin-top:10px;">
        		<span style="display:inline-block; padding-right:15px; color:#222;">대표</span>구본웅<br>
	            <span style="display:inline-block; padding-right:15px; color:#222;">사업자등록번호</span>502-28-81731<br>
    	        <span style="display:inline-block; padding-right:15px; color:#222;">통신판매업신고번호</span>제2023 - 대구수성구 000<br>
            
        	</li>
	    </ul>
    	<ul style="width:100%; float:left; font-size:14px; color:#707070; position:relative; margin-top:15px; padding-top:15px; font-weight:500; border-top:1px solid #ddd;">
    		<li style="width:100%; float:left; margin-bottom:10px;">
	        	<i class="fa fa-map-marker" aria-hidden="true" style="display:inline-block; margin-right:8px; opacity:.6;"></i> 대구광역시 수성구 청수로 69-1
	        </li>
    		<li style="width:100%; float:left; margin-bottom:10px;">
        		<i class="fa fa-phone" aria-hidden="true" style="display:inline-block; margin-right:8px; opacity:.6;"></i> 053-761-7911
	        </li>
    	    
            <!--
        	<li style="width:100%; float:left; margin-bottom:10px;">
	        	<i class="fa fa-fax" aria-hidden="true" style="display:inline-block; margin-right:8px;"></i>
    	    </li>
            -->
        
        	<li style="width:100%; float:left; margin-bottom:10px;">
	        	<i class="fa fa-envelope" aria-hidden="true" style="display:inline-block; margin-right:8px; opacity:.6;"></i> lghdufer@gmail.com
    	    </li>
	    </ul>    
	</div>
    
</div>
<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 

<?
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
?> 
