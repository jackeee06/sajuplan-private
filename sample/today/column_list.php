<?php
include_once("../include/head.sub.php");
include_once("../include/head_main.php");

include_once("./_common.php"); // 메뉴별 공통파일
?>


<div class="top_nav">
	<a href="index.php"><ul>소원성취 홈</ul></a>
	<a href="my_today.php"><ul>오늘의운세</ul></a>
	<a href="wish.php"><ul>소원다락방</ul></a>
	<a href="column_list.php"><ul class="on">사주문칼럼</ul></a>
	<a href="store.php"><ul>스토어</ul></a>
</div>



<div class="sub_nav">
	<a href="column_list.php"><ul class="on">전체</ul></a>
	<a href="column_list.php"><ul>사주</ul></a>
	<a href="column_list.php"><ul>심리</ul></a>
	<a href="column_list.php"><ul>건강</ul></a>
	<a href="column_list_02.php"><ul>꿈해몽</ul></a>
</div>

<!-- 선생님 슬라이드 리스트 -->
<div class="con_section_02">
	<!-- 타이틀 -->
	<h3 class="con_title_02">사주칼럼 BEST 6</h3>	
    
	<!-- 슬라이드 리스트 영역 -->
	<div class="swiper-container slide_column">
    	<div class="swiper-wrapper slide_banner">
    		
		    
            <!-- BEST 01 -->
            <div class="swiper-slide">
            	<ul class="slide_banner_item">
    				<a href="column_view.php">
        				<p class="slide_banner_img" style="background-image:url(../img/sample/partner_28.png);"></p><!-- 썸네일 이미지 배경이미지 처리 -->
	       				 <p class="slide_banner_title">신내림받은지 1년 6개월, 애월동자 "예화"선생님을 만나다</p>        
    	    			<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />563</span>
	        			</p>
    	    		</a>
	    		</ul>
		    </div>
            
            <!-- BEST 01 -->
    		<div class="swiper-slide">
            	<ul class="slide_banner_item">
					<a href="column_view.php">    
		   				<p class="slide_banner_img" style="background-image:url(../img/sample/partner_07.png);"></p><!-- 썸네일 이미지 배경이미지 처리 -->
    	    			<p class="slide_banner_title">오랜 경험, '수연'선생님을 만나다</p>        
        				<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />963</span>
	        			</p>
    	    		</a>
            	</ul>
		    </div>
            
            <!-- BEST 01 -->
    		<div class="swiper-slide">
            	<ul class="slide_banner_item">
    				<a href="column_view.php">
    					<p class="slide_banner_img" style=" background-image:url(../img/sample/20230308125912_kdplvken.jpg);"></p><!-- 썸네일 이미지 배경이미지 처리 -->       
	        			<p class="slide_banner_title">사주와 타르의 교집합, '이든'선생님을 만나다</p>        
    	    			<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />124</span>
	        			</p>
    	    		</a>
            	</ul>
		    </div>
            
            <!-- BEST 01 -->
            <div class="swiper-slide">
            	<ul class="slide_banner_item">
    				<a href="column_view.php">
        				<p class="slide_banner_img" style="background-image:url(../img/sample/good_03.png);"></p><!-- 썸네일 이미지 배경이미지 처리 -->
	       				 <p class="slide_banner_title">신내림받은지 1년 6개월, 애월동자 "예화"선생님을 만나다</p>        
    	    			<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />563</span>
	        			</p>
    	    		</a>
	    		</ul>
		    </div>
            
            <!-- BEST 01 -->
    		<div class="swiper-slide">
            	<ul class="slide_banner_item">
					<a href="column_view.php">    
		   				<p class="slide_banner_img" style="background-image:url(../img/sample/good_01.png);"></p><!-- 썸네일 이미지 배경이미지 처리 -->
    	    			<p class="slide_banner_title">오랜 경험, '수연'선생님을 만나다</p>        
        				<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />963</span>
	        			</p>
    	    		</a>
            	</ul>
		    </div>
            
            <!-- BEST 01 -->
    		<div class="swiper-slide">
            	<ul class="slide_banner_item">
    				<a href="column_view.php">
    					<p class="slide_banner_img" style=" background-image:url(../img/sample/column_01.png);"></p><!-- 썸네일 이미지 배경이미지 처리 -->       
	        			<p class="slide_banner_title">'이 말'을 자주 한다면 지금 당신은 지쳐있다.</p>        
    	    			<p class="slide_banner_info">
        					<span><img src="../img/common/list_icon_thumb_up.png" />124</span>
	        			</p>
    	    		</a>
            	</ul>
		    </div>


    	</div>
            
  
           <!-- Add Arrows -->
   		   <div class="swiper-button-next"></div>
   		   <div class="swiper-button-prev"></div>
</div>
<!-- 선생님 슬라이드 리스트 : END -->


<div class="con_section search_bar">
    <ul class="type_search">
    	<input class="input" type="text" placeholder="키워드검색">
        <i class="xi-search"></i>
    </ul>
    
  <ul class="type_btn">
   	  <img src="../img/common/icon_sort.png" />
    </ul>
</div>

<div class="webzine_list">
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/20230308125912_kdplvken.jpg);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type01">사주</span>
       		<!-- 제목 --><p class="name">잘맞는 별자리 궁합</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">[별자리궁합] 이든선생님의 인터뷰</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/good_01.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type04">심리</span>
       		<!-- 제목 --><p class="name">'이 말'을 자주 한다면 지금 당신은 지쳐있다.</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">내적 소모가 많은 당신에게</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/column_03.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type05">건강</span>
       		<!-- 제목 --><p class="name">얼굴에 나타나는 건강 적신호</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">이목구비로 알아보는 적신호</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/20230308125912_kdplvken.jpg);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type01">사주</span>
       		<!-- 제목 --><p class="name">잘맞는 별자리 궁합</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">[별자리궁합] 이든선생님의 인터뷰</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/good_01.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type04">심리</span>
       		<!-- 제목 --><p class="name">'이 말'을 자주 한다면 지금 당신은 지쳐있다.</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">내적 소모가 많은 당신에게</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/column_03.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type05">건강</span>
       		<!-- 제목 --><p class="name">얼굴에 나타나는 건강 적신호</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">이목구비로 알아보는 적신호</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/20230308125912_kdplvken.jpg);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type01">사주</span>
       		<!-- 제목 --><p class="name">잘맞는 별자리 궁합</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">[별자리궁합] 이든선생님의 인터뷰</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/good_01.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type04">심리</span>
       		<!-- 제목 --><p class="name">'이 말'을 자주 한다면 지금 당신은 지쳐있다.</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">내적 소모가 많은 당신에게</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/column_03.png);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type05">건강</span>
       		<!-- 제목 --><p class="name">얼굴에 나타나는 건강 적신호</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">이목구비로 알아보는 적신호</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>  
    
    <!-- 글 1 -->
	<ul class="webzine_list_detail">
    	<!-- 글 썸네일 -->
        <a href="column_view.php">
        <li class="photo" style="background-image:url(../img/sample/20230308125912_kdplvken.jpg);">
        </li>
        </a>
        
        <!-- 글 정보 -->
        <li class="info">
        	<a href="column_view.php">
        	<!-- 카테고리 --><span class="cate cate_type01">사주</span>
       		<!-- 제목 --><p class="name">잘맞는 별자리 궁합</p>
            <!-- 짧은 소개 : 최8대 18글자 --><p class="text01">[별자리궁합] 이든선생님의 인터뷰</p>
            
            <!-- 글 정보 -->
            <p class="text02">
              	<span><img src="../img/common/list_icon_thumb_up.png" /> 500</span>
                <span><img src="../img/common/list_icon_hit.png" /> 11687</span>
            </p>
            </a>
        </li>
    </ul>
              
</div>


<?php include_once("../include/pagination.php"); ?>


<?php
include_once("../include/tail.php");
include_once("../include/tail.sub.php");
?>
