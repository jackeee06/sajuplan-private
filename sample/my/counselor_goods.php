<?php
include_once("./_common.php"); // 메뉴별 공통파일

$g5['title'] = '서비스상품';
include_once(G5_THEME_MOBILE_PATH.'/head.php');

?>


<!-- 여기 아래부터 모든 HTML 요소 구성 시작 --> 

<link rel="stylesheet" href="../theme/basic/css/mobile_shop.css">

<link rel="stylesheet" href="../theme/basic/mobile/skin/shop/basic/style.css">

<style>
.top_nav .top_nav01 { border-color: #465bf0; color: #465bf0; font-weight: 600;}
</style>

<?php include_once(G5_PATH.'/include/counselor_goods_navi.php'); ?>

<div id="sct">

    <div id="sct_hhtml"></div>
<!-- 상품분류 1 시작 { -->
<!-- } 상품분류 1 끝 -->



<?

// 스킨경로
				$skin_dir = G5_MSHOP_SKIN_PATH;

				if($ca['ca_mobile_skin_dir']) {
					if(preg_match('#^theme/(.+)$#', $ca['ca_mobile_skin_dir'], $match))
						$skin_dir = G5_THEME_MOBILE_PATH.'/'.G5_SKIN_DIR.'/shop/'.$match[1];
					else
						$skin_dir = G5_MOBILE_PATH.'/'.G5_SKIN_DIR.'/shop/'.$ca['ca_mobile_skin_dir'];

					if(is_dir($skin_dir)) {
						$skin_file = $skin_dir.'/'.$ca['ca_mobile_skin'];

						if(!is_file($skin_file))
							$skin_dir = G5_MSHOP_SKIN_PATH;
					} else {
						$skin_dir = G5_MSHOP_SKIN_PATH;
					}
				}

				$ca_id = get_cate_id($member["mb_id"]);

				if($ca_id){

					$sql = " select *
							   from {$g5['g5_shop_category_table']}
							  where ca_id = '$ca_id'
								and ca_use = '1'  ";
					$ca = sql_fetch($sql);


						// 총몇개
						$items = $ca['ca_mobile_list_mod'] * $ca['ca_mobile_list_row'];
						// 페이지가 없으면 첫 페이지 (1 페이지)
						if ($page < 1) $page = 1;
						// 시작 레코드 구함
						$from_record = ($page - 1) * $items;



						$sql_limit = " limit " . $from_record . " , " . ($ca['ca_mobile_list_mod']  * $ca['ca_mobile_list_row']);


						$sql = " select *
									from {$g5['g5_shop_item_table']}
									where ( ca_id like '$ca_id%' or ca_id2 like '$ca_id%' or ca_id3 like '$ca_id%' )
									  and it_use = '1'
									order by it_order, it_id desc
									$sql_limit ";
						
						//echo $sql;

	
						// 리스트 스킨
						$skin_file = is_include_path_check($skin_dir.'/'.$ca['ca_mobile_skin']) ? $skin_dir.'/'.$ca['ca_mobile_skin'] : $skin_dir.'/list.10.skin.php';

						//echo $skin_file;
						///home/hosting_users/dfsoft_thesaju/www/theme/basic/mobile/skin/shop/basic/list.10.skin.php



						if (file_exists($skin_file)) {

							echo '<div id="sct_sortlst">';

							$sort_skin = $skin_dir.'/list.sort.skin.php';
							if(!is_file($sort_skin))
								$sort_skin = G5_MSHOP_SKIN_PATH.'/list.sort.skin.php';
							include $sort_skin;
						
							// 상품 보기 타입 변경 버튼
							$sub_skin = $skin_dir.'/list.sub.skin.php';
							if(!is_file($sub_skin))
								$sub_skin = G5_MSHOP_SKIN_PATH.'/list.sub.skin.php';

							if(is_file($sub_skin)){
								include $sub_skin;
							}

							echo '</div>';

							


							$list = new item_list($skin_file, $ca['ca_mobile_list_mod'], $ca['ca_mobile_list_row'], $ca['ca_mobile_img_width'], $ca['ca_mobile_img_height']);
							//$list->set_category($ca['ca_id'], 1);
							//$list->set_category($ca['ca_id'], 2);
							//$list->set_category($ca['ca_id'], 3);
							
							$list->set_query($sql);

							$list->set_is_page(true);
							$list->set_mobile(true);
							$list->set_order_by($order_by);
							$list->set_from_record($from_record);
							$list->set_view('it_img', true);
							$list->set_view('it_id', false);
							$list->set_view('it_name', true);
							$list->set_view('it_price', true);
							$list->set_view('sns', true);
							$list->set_view('it_icon', true);
							echo $list->run();

							// where 된 전체 상품수
							$total_count = $list->total_count;
						}
						else
						{
							echo '<div class="sct_nofile">'.str_replace(G5_PATH.'/', '', $skin_file).' 파일을 찾을 수 없습니다.<br>관리자에게 알려주시면 감사하겠습니다.</div>';
						}


						    $qstr1 = 'ca_id='.$ca_id;
							$qstr1 .='&amp;sort='.$sort.'&amp;sortodr='.$sortodr;
							echo get_paging($config['cf_write_pages'], $page, $total_page, $_SERVER['SCRIPT_NAME'].'?'.$qstr1.'&amp;page=');

				}
	
?>


    
    <div id="sct_thtml"></div>
	

</div>




<!-- 여기 아래부터 모든 HTML 요소 구성 끝 --> 


<?php
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>