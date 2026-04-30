<?php
include_once("../common.php"); // 메뉴별 공통파일

$g5['title'] = "문의하기";  

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>


<div class="form_warp">
		    <ul>
		        <p class="input_title">제목</p>
    			<li class="input_div">
		        	<input type="text" placeholder="제목 입력"/>
    			</li>
        
		        <p class="input_title">문의내용</p>
    			<li class="input_div">
		        	<textarea placeholder=""></textarea>
    			</li>
        
		        <p class="input_title">사진첨부</p>
    			<li class="input_div">
		        	<input type="file">
    			</li>
        
		        <li>
        			<a href="qa_list.php">
		          	<button class="log_btn">작성하기</button>
        		    </a>
		        </li>
		    </ul>
		</div>
        
<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>