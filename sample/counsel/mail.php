<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = "이메일상담";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>

<style>
.counsel_email {border-color: #465bf0 !important; color: #465bf0 !important; font-weight: 600; }
</style>

<?php include_once(G5_PATH.'/include/counsel_navi.php'); ?>

<div class="table_list con_section_b_bot">
    <!-- 글 1 -->
	<ul class="table_list_detail">
        <!-- 글 정보 -->
        <li class="info">
        	<!-- 카테고리 --><span class="cate">상담대기</span>
       		<!-- 제목 --><p class="name">이메일상담 신청합니다.</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span>2023.03.13</span>
                <span>***qwer@naver.com</span>
            </p>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="table_list_detail">
        <!-- 글 정보 -->
        <li class="info">
        	<!-- 카테고리 --><span class="cate on">상담완료</span>
       		<!-- 제목 --><p class="name">이메일상담 신청합니다.</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span>2023.03.13</span>
                <span>***ifke152@naver.com</span>
            </p>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="table_list_detail">
        <!-- 글 정보 -->
        <li class="info">
        	<!-- 카테고리 --><span class="cate on">상담완료</span>
       		<!-- 제목 --><p class="name">이메일상담 신청합니다.</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span>2023.03.13</span>
                <span>***i1004@naver.com</span>
            </p>
        </li>
    </ul>
</div>

<a href="./mail_select.php">
<div class="bottom_btn">이메일상담 신청</div>
</a>

<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
