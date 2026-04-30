<?php
include_once("./_common.php"); // 메뉴별 공통파일
$g5['title'] = "이벤트상담사"; 
include_once(G5_THEME_MOBILE_PATH.'/head.php');
##############################################################


$sql_common = " from {$g5['member_table']} ";

$sql_search = " where (1) and ev_2='Y' and mb_level='5'";


if (!$sst) {
    $sst = "mb_datetime";
    $sod = "desc";
}

//$sql_order = " order by {$sst} {$sod} ";
$sql_order = " order by rand() ";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함



$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";


$result = sql_query($sql);
?>




<?php echo display_banner('이벤트2', 'mainbanner.10.skin.php'); ?>


<div class="counselor_list_wrap" >


    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
	
	/// 프로필테이블에서 관련정보를 가져온다 //
	$row1 = sql_fetch("select * from g5_write_counselor where mb_id='".$row["mb_id"]."'");
	/// 프로필테이블에서 관련정보 가져오기 끝//

	$thumb = get_list_thumbnail('counselor', $row1['wr_id'], '170', '116', false, true);

	$simg = "";
	if($thumb['src']) {
		$simg = $thumb['src'];
	} else {
		$simg = '../img/common/noimage.png';
	}



	?>


	<div class="counselor_list">
    	<div class="counselor_list_item">
           	<a href="../bbs/board.php?bo_table=counselor&wr_id=<?=$row1["wr_id"]?>">
        	<ul class="counselor_img_wrap type_bg <?=$cate_bg[$row1['ca_name']]?>">
            	
				<span class="list_scrap" onclick="scrap_submit('<?=$row1["wr_id"]?>')" style="cursor:pointer;">				
				<?
				$sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $row1["wr_id"]);
				$scrap_img = "/img/common/list_icon_scrap.png";
				if($sflag==true){
					$scrap_img = "/img/common/list_icon_scrap_on.png";
				}
				?>
				<img src="<?=$scrap_img?>" id="scrap_icon_<?=$row1["wr_id"]?>">					
			</span>
      



                <span class="icon_cate <?=$cate_bg[$row1['ca_name']]?>"><?=$row1["ca_name"]?></span>
                <li class="counselor_img" style=" background-image:url(<?=$simg?>);">                        		
                </li>
            </ul>
            </a>
                    
            <ul class="counselor_con_wrap">
            	<a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
               	<li class="counselor_con_title">
					<?=$row["mb_nick"]?>
                	<!-- 상담사 고유번호 -->
					<?
					$cinfo = $row;
					?>
                    <?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>
                </li>
                <li class="counselor_con_text"><?php echo $row1['wr_8'] ?></li>
               	<li class="counselor_con_price">
           	      	<img src="../../../img/common/icon_price.png">
               	  	<?=number_format($cinfo["mb_4"])?>원<span class="unit">(<?=$cinfo["mb_5"]?>초)</span>
               	</li>
                </a>
                        
               	<!--상담상태 버튼 Wrap Start -->
    			<?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>
				<!--상담상태 버튼 Wrap End -->
           	</ul>
        </div>
        <details class="counselor_list_info">
            <summary>
            	<a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
	        	<ul class="left">
                	<span class="tag">#<?php echo $row1['wr_9'] ?></span>
                    <span class="tag">#<?php echo $row1['wr_10'] ?></span>
    	        </ul>
                </a>
                
                <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
                <ul class="right">
           	  	    <li class="right_item"><img src="../../../img/common/icon_review.png">최근 후기(<?=get_counselor_afcnt($row["mb_id"])?>)</li>
                    <li class="right_item gray">|</li>
	                <li class="right_item">문의<span>(<?=get_counselor_qa_new($row["mb_id"])?>)</span></li>
        	        <!--<li class="right_item"><img src="../../../img/common/select_02.png"></li>-->
            	</ul>
                </a>
            </summary>
            <!--
            <div class="counselor_review">

				 <?
					  //// 상담 후기 리스트 가져오기 ///

					$rsql = "select * from g5_write_review where wr_1='".$row["mb_id"]."' order by wr_datetime desc limit 0,3";
					//echo $rsql;

					$rst = sql_query($rsql);
					if($rst){
						while($res=sql_fetch_array($rst)){
							$minfo = get_member($res["mb_id"]);
						?>
					  <ul class="counselor_review_item">
                      	  <li class="counselor_review_con"><?=$res['wr_subject']?></li>
                          <li class="counselor_review_name point"><?=$minfo["mb_name"]?></li>
                      </ul>
						
					<?
						
						}
					}
					?>					


            	<a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$row1["wr_id"]?>&sca=<?=$row1["ca_name"]?>">
                	<ul class="counselor_review_more">더보기 <i class="xi-angle-down"></i></ul>
                </a>
        	</div>
            -->
		</details>
                
    </div>
    
 <?php
    }
    if ($i == 0)
        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
    ?>




<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>


</div>

<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
