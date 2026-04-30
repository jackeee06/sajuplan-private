<?

include_once('./_common.php');
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
ob_clean();
ob_start();

$sql_common = " from {$g5['member_table']} a left join g5_write_counselor b on(a.mb_id=b.mb_id) ";
//20250731 EUN RDVC 추가 시작
$sql_search = " where (1) and mb_level='5' and (a.state='CONN' or a.state='IDLE' or a.state='RDVC')";
//20250731 EUN RDVC 추가 마감


if($sca){
	$sql_search .=" and b.ca_name='".$sca."'";
}


if (!$sst) {
    $sst = "mb_datetime";
    $sod = "asc";
}



//상담사상태 IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비
//$sql_order = " order by FIELD(a.state, 'CONN', 'IDLE', 'ABSE') desc, wr_datetime desc ";
//20250730 EUN 인기 정렬 시작
//$sql_order = "order by {$sst} {$sod} ";
//$sql_order =" order by rand()";
$sql_order =" order by 
                if(state in ('IDLE','RDVC', 'CONN', 'ABSE'), 0, 1), FIELD (state, 'IDLE','RDVC', 'CONN', 'ABSE','')";
//20250730 EUN 인기 정렬 시작


$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함



$sql = " select a.*, b.* {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";


//echo $sql;

$result = sql_query($sql);

?>
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
              <a href="../bbs/board.php?bo_table=counselor&wr_id=21">
            <ul class="counselor_img_wrap type_bg <?=$cate_bg[$row1['ca_name']]?>">
                
          <span class="list_scrap" onclick="scrap_submit('<?=$row1["wr_id"]?>')" style="cursor:pointer;">				
          <?
          $sflag = is_scrap_wr_id($member["mb_id"], 'counselor', $row1["wr_id"]);
                  //202507228 스크랩 icon 변경 시작
          $scrap_img = "/img/common/list_icon_scrap.png";
          if($sflag==true){
            $scrap_img = "/img/common/list_icon_scrap_on.png";
                      //202507228 스크랩 icon 변경 마감
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
          <div class="counselor_con_right">
            <a href="../bbs/board.php?bo_table=counselor&amp;wr_id=<?=$row1["wr_id"]?>&amp;sca=<?=$row1["ca_name"]?>">
              <li>
                <div class="top">
                  <div class="counselor_con_title">
                    <?=$row["mb_nick"]?>
                    <!-- 상담사 고유번호 -->
                    <?
                    $cinfo = $row;
                    ?>
                    <?php include(G5_PATH.'/include/counselor_num_list_board.php'); ?>
                  </div>
                  <div class="counselor_con_text"><?php echo $row1['wr_8'] ?></div>
                </div>
                <div class="counselor_con_price">
                  <?=number_format($cinfo["mb_4"])?>원<span class="unit">(<?=$cinfo["mb_5"]?>초)</span>
                </div>
              </li>
            </a>
                          
            <!--상담상태 버튼 Wrap Start -->
            <?php include(G5_PATH.'/include/counselor_board_state_btn.php'); ?>
            <!--상담상태 버튼 Wrap End -->
          </div>
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
              <li class="right_item">최근 후기(<?=get_counselor_afcnt($row["mb_id"])?>)</li>
              <li class="right_item gray">|</li>
              <li class="right_item">문의<span>(<?=get_counselor_qa_new($row["mb_id"])?>)</span></li>
            </ul>
                  </a>
                  
              </summary>
      </details>
                  
      </div>

    <?php
      }
      if ($i == 0)
          echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";
      ?>




  <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>

  </div>

<?$html = ob_get_clean();
echo json_encode(['html'=>$html]);
?>