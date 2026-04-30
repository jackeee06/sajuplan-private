<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 분류 사용 여부
$is_category = false;
$category_option = '';
if ($board['bo_use_category']) {
    $is_category = true;
    $category_href = get_pretty_url($bo_table);
	
	
    $category_option .= '<li><a href="'.$category_href.'"';
    if ($sca=='')
        $category_option .= ' id="bo_cate_on"';
    $category_option .= '>전체</a></li>';
	
/*	
if ($bo_table != 'counselor') {
    $category_option .= '<li><a href="'.$category_href.'"';
    if ($sca=='')
        $category_option .= ' id="bo_cate_on"';
    $category_option .= '>전체</a></li>';
}
*/
    $categories = explode('|', $board['bo_category_list']); // 구분자가 , 로 되어 있음
    for ($i=0; $i<count($categories); $i++) {
        $category = trim($categories[$i]);
        if ($category=='') continue;
        $category_option .= '<li><a href="'.(get_pretty_url($bo_table,'','sca='.urlencode($category))).'"';
        $category_msg = '';
        if ($category==$sca) { // 현재 선택된 카테고리라면
            $category_option .= ' id="bo_cate_on"';
            $category_msg = '<span class="sound_only">열린 분류 </span>';
        }
        $category_option .= '>'.$category_msg.$category.'</a></li>';
    }
}

$sop = strtolower($sop);
if ($sop != 'and' && $sop != 'or')
    $sop = 'and';

// 분류 선택 또는 검색어가 있다면
$stx = trim($stx);
//검색인지 아닌지 구분하는 변수 초기화
$is_search_bbs = false;


if($state){
		$ss = "select mb_id from g5_member  where state='".$state."' and mb_level='5'";
		$rst = sql_query($ss);
		if($rst){
			$mbid = array();
			while($rrs=sql_fetch_array($rst)){
					$mbid[] = $rrs["mb_id"];
			}	
		}
}


if ($sca || $stx || $stx === '0') {     //검색이면
    $is_search_bbs = true;      //검색구분변수 true 지정
    $sql_search = get_sql_search($sca, $sfl, $stx, $sop);

    // 가장 작은 번호를 얻어서 변수에 저장 (하단의 페이징에서 사용)
    $sql = " select MIN(wr_num) as min_wr_num from {$write_table} ";
    $row = sql_fetch($sql);
    $min_spt = (int)$row['min_wr_num'];

    if (!$spt) $spt = $min_spt;

    $sql_search .= " and (wr_num between {$spt} and ({$spt} + {$config['cf_search_part']})) ";

	
	if(count($mbid)>0){
			$sql_search .=" and mb_id in('".implode("','",$mbid)."')";
	}

	if($bo_table=="counselor"){ /////////////////////////// 상담 게시판일때 상담중 , 상담준비 상담사만 가져오기.

		
		if($s_wr_5){
			$sql_search .=" and wr_5 like '%".$s_wr_5."%'";
		}
		if($s_wr_6){
			$sql_search .=" and wr_6 like '%".$s_wr_6."%'";
		}
		
		$imss = "";
		if($s_mb_10){ /// 성별검색 //
				$imss = " and mb_10='".$s_mb_10."'";
		}

		if(!$state){
			// 기본값 가져오기
			$mb_ids = array();
			//$qs = "select mb_id from g5_member where 1=1 and mb_level='5' and (state='IDLE' or state='CONN'){$imss}";
			$qs = "select mb_id from g5_member where 1=1 and mb_level='5'{$imss}";
			//echo $qs;
			//echo "<br>";
			$qr = sql_query($qs);
			if($qr){
				while($qrow=sql_fetch_array($qr)){
					$mb_ids[] = $qrow["mb_id"];
				}
			}
			if(count($mb_ids)>0){
				$sql_search .=" and mb_id in('".implode("','",$mb_ids)."')";
			}else{
			}
		}

	}
	//////////////// 상담 게시판일때 , 상담중, 상담준비 상담사만 가져오기 끝 ...


	if($bo_table=="wish"){
		if($member["mb_level"]=="2"){
			$sql_search .=" and mb_id='".$member["mb_id"]."'";
		}elseif($member["mb_level"]=="5"){
			
		}
	}

	if($bo_table=="review" && $mymbid){
		$sql_search .=" and mb_id='".$member["mb_id"]."'";
	}

	if(!$is_admin){
		if(($bo_table=="review" && $csrid) || ($bo_table=="qa" && $csrid)){
			$sql_search .=" and wr_1='".$csrid."'";
		}

		if($bo_table=="qa" && !$crsid && !$member["mb_id"]){
			alert('로그인 하셔야합니다!','/');
		}elseif($bo_table=="qa" && $crsid){
			$sql_search .=" and wr_1='".$csrid."'";
		}elseif($bo_table=="qa" && $member["mb_id"] && !$csrid){
			if($member["mb_level"]=='5'){
				$sql_search .=" and wr_1='".$member["mb_id"]."'";
			}else{
				$sql_search .=" and mb_id='".$member["mb_id"]."'";
			}
		}
	}


	if($bo_table=="review" && $photo_view=="Y"){
		$sql_search .=" and wr_file > '0'";
	}

	if($bo_table=="review" && $re_counsel=="Y"){
		$sql_search .=" and wr_comment ='0'";
	}

    // 원글만 얻는다. (코멘트의 내용도 검색하기 위함)
    // 라엘님 제안 코드로 대체 http://sir.kr/g5_bug/2922
	$sql = " SELECT COUNT(DISTINCT `wr_parent`) AS `cnt` FROM {$write_table} WHERE {$sql_search} ";   
	$row = sql_fetch($sql);
    $total_count = $row['cnt'];
    


} else {
    $sql_search = "";
	if(count($mbid)>0){
			$sql_search .=" and mb_id in('".implode("','",$mbid)."')";
	}


	if($bo_table=="wish"){
		if($member["mb_level"]=="2"){
			$sql_search .=" and mb_id='".$member["mb_id"]."'";
		}elseif($member["mb_level"]=="5"){
			
		}
	}

	if($bo_table=="review" && $mymbid){
		$sql_search .=" and mb_id='".$member["mb_id"]."'";
	}

	if(!$is_admin){

		if(($bo_table=="review" && $csrid) || ($bo_table=="qa" && $csrid)){
			$sql_search .=" and wr_1='".$csrid."'";
		}

		if($bo_table=="qa" && !$crsid && !$member["mb_id"]){
			alert('로그인 하셔야합니다!','/');
		}elseif($bo_table=="qa" && $crsid){
			$sql_search .=" and wr_1='".$csrid."'";
		}elseif($bo_table=="qa" && $member["mb_id"] && !$csrid){
			if($member["mb_level"]=='5'){
				$sql_search .=" and wr_1='".$member["mb_id"]."'";
			}else{
				$sql_search .=" and mb_id='".$member["mb_id"]."'";
			}
		}

	}

	if($bo_table=="review" && $photo_view=="Y"){
		$sql_search .=" and wr_file > '0'";
	}

	if($bo_table=="review" && $re_counsel=="Y"){
		$sql_search .=" and wr_comment ='0'";
	}




		
	if($bo_table=="counselor"){ /////////////////////////// 상담 게시판일때 상담중 , 상담준비 상담사만 가져오기.
		if($s_wr_5){
			$sql_search .=" and wr_5 like '%".$s_wr_5."%'";
		}
		if($s_wr_6){
			$sql_search .=" and wr_6 like '%".$s_wr_6."%'";
		}

		$imss = "";
		if($s_mb_10){ /// 성별검색 //
				$imss = " and mb_10='".$s_mb_10."'";
		}

		if(!$state){
			// 기본값 가져오기
			$mb_ids = array();
			//$qs = "select mb_id from g5_member where 1=1 and mb_level='5' and (state='IDLE' or state='CONN'){$imss}";
			$qs = "select mb_id from g5_member where 1=1 and mb_level='5' {$imss}";
			//echo $qs;
			//echo "<br>";
			$qr = sql_query($qs);
			if($qr){
				while($qrow=sql_fetch_array($qr)){
					$mb_ids[] = $qrow["mb_id"];
				}
			}
			if(count($mb_ids)>0){
				$sql_search .=" and mb_id in('".implode("','",$mb_ids)."')";
			}
		}



	}
	//////////////// 상담 게시판일때 , 상담중, 상담준비 상담사만 가져오기 끝 ...




	$sql = " SELECT COUNT(DISTINCT `wr_parent`) AS `cnt` FROM {$write_table} WHERE 1=1 {$sql_search} ";


	$row = sql_fetch($sql);
    $total_count = $row['cnt'];
    
	
	//$total_count = $board['bo_count_write'];
}

if(G5_IS_MOBILE) {
    $page_rows = $board['bo_mobile_page_rows'];
    $list_page_rows = $board['bo_mobile_page_rows'];
} else {
    $page_rows = $board['bo_page_rows'];
    $list_page_rows = $board['bo_page_rows'];
}

if ($page < 1) { $page = 1; } // 페이지가 없으면 첫 페이지 (1 페이지)

// 년도 2자리
$today2 = G5_TIME_YMD;

$list = array();
$i = 0;
$notice_count = 0;
$notice_array = array();

// 공지 처리
if (!$is_search_bbs) {
    $arr_notice = explode(',', trim($board['bo_notice']));
    $from_notice_idx = ($page - 1) * $page_rows;
    if($from_notice_idx < 0)
        $from_notice_idx = 0;
    $board_notice_count = count($arr_notice);

    for ($k=0; $k<$board_notice_count; $k++) {
        if (trim($arr_notice[$k]) == '') continue;

        $row = sql_fetch(" select * from {$write_table} where wr_id = '{$arr_notice[$k]}' ");

        if (!isset($row['wr_id']) || !$row['wr_id']) continue;

        $notice_array[] = $row['wr_id'];

        if($k < $from_notice_idx) continue;

        $list[$i] = get_list($row, $board, $board_skin_url, G5_IS_MOBILE ? $board['bo_mobile_subject_len'] : $board['bo_subject_len']);
        $list[$i]['is_notice'] = true;
        $list[$i]['num'] = 0;
        $i++;
        $notice_count++;

        if($notice_count >= $list_page_rows)
            break;
    }
}

$total_page  = ceil($total_count / $page_rows);  // 전체 페이지 계산
$from_record = ($page - 1) * $page_rows; // 시작 열을 구함

// 공지글이 있으면 변수에 반영
if(!empty($notice_array)) {
    $from_record -= count($notice_array);

    if($from_record < 0)
        $from_record = 0;

    if($notice_count > 0)
        $page_rows -= $notice_count;

    if($page_rows < 0)
        $page_rows = $list_page_rows;
}

// 관리자라면 CheckBox 보임
$is_checkbox = false;
if ($is_member && ($is_admin == 'super' || $group['gr_admin'] == $member['mb_id'] || $board['bo_admin'] == $member['mb_id']))
    $is_checkbox = true;

// 정렬에 사용하는 QUERY_STRING
$qstr2 = 'bo_table='.$bo_table.'&amp;sop='.$sop;

// 0 으로 나눌시 오류를 방지하기 위하여 값이 없으면 1 로 설정
$bo_gallery_cols = $board['bo_gallery_cols'] ? $board['bo_gallery_cols'] : 1;
$td_width = (int)(100 / $bo_gallery_cols);

// 정렬
// 인덱스 필드가 아니면 정렬에 사용하지 않음
//if (!$sst || ($sst && !(strstr($sst, 'wr_id') || strstr($sst, "wr_datetime")))) {
if (!$sst) {
    if ($board['bo_sort_field']) {
        $sst = $board['bo_sort_field'];
    } else {
        $sst  = "wr_num, wr_reply";
        $sod = "";
    }
} else {
    $board_sort_fields = get_board_sort_fields($board, 1);
    if (!$sod && array_key_exists($sst, $board_sort_fields)) {
        $sst = $board_sort_fields[$sst];
    } else {
        // 게시물 리스트의 정렬 대상 필드가 아니라면 공백으로 (nasca 님 09.06.16)
        // 리스트에서 다른 필드로 정렬을 하려면 아래의 코드에 해당 필드를 추가하세요.
        // $sst = preg_match("/^(wr_subject|wr_datetime|wr_hit|wr_good|wr_nogood)$/i", $sst) ? $sst : "";
        $sst = preg_match("/^(wr_datetime|wr_hit|wr_good|wr_nogood)$/i", $sst) ? $sst : "";
    }
}

if(!$sst)
    $sst  = "wr_num, wr_reply";

if ($sst) {
    $sql_order = " order by {$sst} {$sod} ";
}


if($bo_table=="review"){
	$sql_order = " order by wr_datetime desc";
}

if($bo_table=="counselor"){
	$sql_order = " order by rand()";

	if($s_desc=="wr_datetime"){
		$sql_order = " order by wr_datetime desc";
	}elseif($s_desc=="aft"){
		$sql_order = " order by aft desc";
	}elseif($s_desc=="fat"){
		$sql_order = " order by fat desc";
	}elseif($s_desc=="amt"){
		$sql_order = " order by amt asc";
	}elseif($s_desc=="damt"){
		$sql_order = " order by amt desc";
	}
}

if ($is_search_bbs) {

    $sql = " select distinct wr_parent from {$write_table} where {$sql_search} {$sql_order} limit {$from_record}, $page_rows ";
} else {
    $sql = " select * from {$write_table} where wr_is_comment = 0 {$sql_search} ";
    if(!empty($notice_array))
        $sql .= " and wr_id not in (".implode(', ', $notice_array).") ";
    $sql .= " {$sql_order} limit {$from_record}, $page_rows ";
}


//echo $sql;
//echo "<br>";


// 페이지의 공지개수가 목록수 보다 작을 때만 실행
if($page_rows > 0) {
    $result = sql_query($sql);

    $k = 0;

    while ($row = sql_fetch_array($result))
    {
        // 검색일 경우 wr_id만 얻었으므로 다시 한행을 얻는다
        if ($is_search_bbs)
            $row = sql_fetch(" select * from {$write_table} where wr_id = '{$row['wr_parent']}' ");

        $list[$i] = get_list($row, $board, $board_skin_url, G5_IS_MOBILE ? $board['bo_mobile_subject_len'] : $board['bo_subject_len']);
        if (strstr($sfl, 'subject')) {
            $list[$i]['subject'] = search_font($stx, $list[$i]['subject']);
        }
        $list[$i]['is_notice'] = false;
        $list_num = $total_count - ($page - 1) * $list_page_rows - $notice_count;
        $list[$i]['num'] = $list_num - $k;



		/// 게시글 신고, 차단 기능
		$rsql ="select * from g5_board_singo where mb_id='".$member["mb_id"]."' and bo_table='".$bo_table."' and wr_id='".$list[$i]["wr_id"]."'";
		$rrt = sql_fetch($rsql);
		if($rrt["no"]){ /// 신고, 차단 내역이 있으면/
			if($rrt["mode"]=="1"){ /// 신고글
//				$list[$i]["subject"] = "회원님이 신고하신 글입니다";
//				$list[$i]["wr_subject"] = "회원님이 신고하신 글입니다";
//				$list[$i]["wr_content"] = "회원님이 신고하신 글입니다";
//				$list[$i]["href"] ="";
//				$list[$i]["sing_flag"] =true;

			}elseif($rrt["mode"]=="2"){// 차단글
				$list[$i]["subject"] = "회원님이 차단하신 글입니다";
				$list[$i]["wr_subject"] = "회원님이 차단하신 글입니다";
				$list[$i]["wr_content"] = "회원님이 차단하신 글입니다";
				$list[$i]["href"] ="";
				$list[$i]["sing_flag"] =true;
			}
		}
		/// 게시글 신고, 차단기능 끝


        $i++;
        $k++;
    }
}

g5_latest_cache_data($board['bo_table'], $list);

$write_pages = get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, get_pretty_url($bo_table, '', $qstr.'&amp;page='));

$list_href = '';
$prev_part_href = '';
$next_part_href = '';
if ($is_search_bbs) {
    $list_href = get_pretty_url($bo_table);

    $patterns = array('#&amp;page=[0-9]*#', '#&amp;spt=[0-9\-]*#');

    //if ($prev_spt >= $min_spt)
    $prev_spt = $spt - $config['cf_search_part'];
    if (isset($min_spt) && $prev_spt >= $min_spt) {
        $qstr1 = preg_replace($patterns, '', $qstr);
        $prev_part_href = get_pretty_url($bo_table,0,$qstr1.'&amp;spt='.$prev_spt.'&amp;page=1');
        $write_pages = page_insertbefore($write_pages, '<a href="'.$prev_part_href.'" class="pg_page pg_search pg_prev">이전검색</a>');
    }

    $next_spt = $spt + $config['cf_search_part'];
    if ($next_spt < 0) {
        $qstr1 = preg_replace($patterns, '', $qstr);
        $next_part_href = get_pretty_url($bo_table,0,$qstr1.'&amp;spt='.$next_spt.'&amp;page=1');
        $write_pages = page_insertafter($write_pages, '<a href="'.$next_part_href.'" class="pg_page pg_search pg_next">다음검색</a>');
    }
}





$write_href = '';
if ($member['mb_level'] >= $board['bo_write_level']) {
    $write_href = short_url_clean(G5_BBS_URL.'/write.php?bo_table='.$bo_table);
}

$nobr_begin = $nobr_end = "";
if (preg_match("/gecko|firefox/i", $_SERVER['HTTP_USER_AGENT'])) {
    $nobr_begin = '<nobr>';
    $nobr_end   = '</nobr>';
}

// RSS 보기 사용에 체크가 되어 있어야 RSS 보기 가능 061106
$rss_href = '';
if ($board['bo_use_rss_view']) {
    $rss_href = G5_BBS_URL.'/rss.php?bo_table='.$bo_table;
}

$stx = get_text(stripslashes($stx));
include_once($board_skin_path.'/list.skin.php');