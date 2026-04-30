<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head.php');
?>



<div class="top_nav">
	<a href="coin_fill.php"><ul>코인 충전</ul></a>
	<a href="coin_history.php"><ul class="on">코인 이용내역</ul></a>
</div>

<div class="con_section date_search">
	<ul>
        	<li class="input_date">
            	<input type="date"  data-placeholder="날짜 선택" required="required" aria-required="true">
                <!--<i class="xi-calendar-check"></i>-->
            </li>
            
            <li class="input_date_line">~</li>
            
            <li class="input_date">
            	<input type="date" data-placeholder="날짜 선택" required="required" aria-required="true">
                <!--<i class="xi-calendar-check"></i>-->
            </li>
            
            <li class="input_search"><i class="xi-search"></i></li>
    </ul>
</div>


<div class="con_section" style="    padding-bottom: 90px;">
    
    <ul class="sub_tap sub_tap_3">
	    <button class="sub_tap_btn on">전체</button>
        <button class="sub_tap_btn">충전</button>
        <button class="sub_tap_btn">사용</button>
    </ul>
	<table width="100%" border="0">
		<tr>
		    <th scope="col">일자</th>
            <th scope="col">구분</th>
            <th scope="col">금액</th>
            <th scope="col">코인</th>
		</tr>
		<tr>
		    <td>2022.11.29</td>
            <td>카드결제</td>
            <td>500,000</td>
            <td class="cion_plus">+ 510</td>
		</tr>
        <tr>
            <td>2022.11.01</td>
            <td>상담(음성)</td>
            <td>-</td>
            <td class="cion_minus">- 500</td>
		</tr>
        <tr>
            <td>2022.10.17</td>
            <td>상담(채팅)</td>
            <td>-</td>
            <td class="cion_minus">- 1200</td>
		</tr>
        <tr>
            <td>2022.09.24</td>
            <td>쿠폰충전</td>
            <td>-</td>
            <td class="cion_plus">+ 300</td>
		</tr>
        <tr>
            <td>2022.09.13</td>
            <td>서비스상품</td>
            <td>100,000</td>
            <td class="cion_plus">+ 1040</td>
		</tr>
        <tr>
            <td>2022.09.07</td>
            <td>후기작성</td>
            <td>-</td>
            <td class="cion_plus">+ 10</td>
		</tr>
        <tr>
		    <td>2022.11.29</td>
            <td>카드결제</td>
            <td>500,000</td>
            <td class="cion_plus">+ 510</td>
		</tr>
        <tr>
            <td>2022.11.01</td>
            <td>상담(음성)</td>
            <td>-</td>
            <td class="cion_minus">- 500</td>
		</tr>
        <tr>
            <td>2022.10.17</td>
            <td>상담(채팅)</td>
            <td>-</td>
            <td class="cion_minus">- 1200</td>
		</tr>
        <tr>
            <td>2022.09.24</td>
            <td>쿠폰충전</td>
            <td>-</td>
            <td class="cion_plus">+ 300</td>
		</tr>
        <tr>
            <td>2022.09.13</td>
            <td>서비스상품</td>
            <td>100,000</td>
            <td class="cion_plus">+ 1040</td>
		</tr>
        <tr>
            <td>2022.09.07</td>
            <td>후기작성</td>
            <td>-</td>
            <td class="cion_plus">+ 10</td>
		</tr>
	</table>
</div>

<div class="bottom_btn">충전하기</div>


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>