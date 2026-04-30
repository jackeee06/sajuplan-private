<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
$state = $_GET["state"];

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
if($_SERVER['REMOTE_ADDR'] == "115.93.39.5" and $stx){
    // echo "분류 또는 검색어" .$stx;
}
//검색인지 아닌지 구분하는 변수 초기화
$is_search_bbs = false;

$mbid = array();
if($state){
    //$ss = "select m.mb_id from g5_member as m where state='".$state."' and mb_level='5'"; //20250715 정렬 및 페이징 테이블 alias 작업 시작
    $ss = "select mb_id from g5_member where state='".$state."' and mb_level='5'"; //20250721 정렬 및 페이징 테이블 alias 작업 시작
    $rst = sql_query($ss);
    if($rst){
        while($rrs=sql_fetch_array($rst)){
            $mbid[] = $rrs["mb_id"];
        }
    }
}
//20250727 eun 상담 가능만 보기 + 페이지네이션 오류 수정 시작
$mb_ids = array();

$sql_search_count = ''; // count 쿼리용 조건 (alias 없음)
$sql_search_list  = ''; // list 쿼리용 조건 (alias 있음)
//윗 부분 추가

if ($sca || $stx || $stx === '0') {     //검색이면
    $is_search_bbs = true;      //검색구분변수 true 지정
    $sql_search = get_sql_search($sca, $sfl, $stx, $sop);
    $sql_search_count = get_sql_search($sca, $sfl, $stx, $sop, false);
    $sql_search_list  = get_sql_search($sca, $sfl, $stx, $sop, true);

    if(count($mbid)>0){
        $sql_search_count .= " and mb_id in('".implode("','",$mbid)."')";
        $sql_search_list  .= " and m.mb_id in('".implode("','",$mbid)."')";
    }


    // 가장 작은 번호를 얻어서 변수에 저장 (하단의 페이징에서 사용)
    $sql = " select MIN(wr_num) as min_wr_num from {$write_table} ";
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
        // echo "[검색, 가장 작은 번호 74열] $sql\n";
    }
    $row = sql_fetch($sql);
    $min_spt = (int)$row['min_wr_num'];

    if (!$spt) $spt = $min_spt;

    $sql_search .= " and (wr_num between {$spt} and ({$spt} + {$config['cf_search_part']})) ";
//20250727 eun 상담 가능만 보기 + 페이지네이션 오류 수정 마감

    //20250714 eun 상담사 리스트 > 카테고리 적용 상태값에 따라 정렬 작업 시작 (join 위해 alias 필요)
    // mb_id 필터용 SQL 조각
    $mb_id_in = "";
    if (count($mb_ids) > 0) {
        $mb_id_in_count = " and mb_id in ('" . implode("','", $mb_ids) . "')";
        $mb_id_in_list  = " and m.mb_id in ('" . implode("','", $mb_ids) . "')";
    } else {
        $mb_id_in_count = "";
        $mb_id_in_list  = "";
    }
    /*원래코드if(count($mbid)>0){
            $sql_search .=" and mb_id in('".implode("','",$mbid)."')";   //0715
    }*/


// 상담사 리스트 조건 조립
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
//20250715 eun 상담사 부재중 정렬 작업 시작
        if(!$state){
            // 기본값 가져오기
            $mb_ids = array();
            $qs = "select m.mb_id from g5_member as m where 1=1 and mb_level='5' and (state='IDLE' or state='CONN' or state='ABSE' or state ='RDVC'){$imss} order by 
                   if(state in ('IDLE','RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (state, 'IDLE','RDVC', 'CONN', 'ABSE','')";
            //$qs = "select mb_id from g5_member where 1=1 and mb_level='5'{$imss}";
            if($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
                // echo $qs;
                // echo "<br>";
            }
//20250715 eun 상담사 부재중 정렬 작업 마감

            $qr = sql_query($qs);
            if($qr){
                while($qrow=sql_fetch_array($qr)){
                    $mb_ids[] = $qrow["mb_id"];
                }
            }
            // 원래 쿼리
//			if(count($mb_ids)>0){
//				$sql_search .=" and mb_id in('".implode("','",$mb_ids)."')";  //0715 m.mb_id -> mb_id (주석 정리하기) - alias가 없으면 페이지가 뜨고, 있으면 페이지가 안 뜨는 문제.
//			}
            $mb_id_in_count = "";
            $mb_id_in_list  = "";
            if(count($mb_ids)>0){
                // 0720 alias 없애 봄 $mb_id_in_count = " and m.mb_id in('".implode("','",$mb_ids)."')";
                $mb_id_in_count = " and mb_id in('".implode("','",$mb_ids)."')";
                $mb_id_in_list  = " and m.mb_id in('".implode("','",$mb_ids)."')";
            }
            else{
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
    // eun 페이지 안 나오는 거 수정 중 시작 - 완료되면 주석 '작업 시작'으로 바꾸기
    $sql = " SELECT COUNT(DISTINCT `wr_parent`) AS `cnt` FROM {$write_table} WHERE {$sql_search} ";
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
        //  echo "[상담사 리스트 검색 o 전체 count 쿼리 193열] $sql\n";
    }
    $row = sql_fetch($sql);
    $total_count = $row['cnt'];

    // eun 페이지 안 나오는 거 수정 중 끝 - 완료되면 주석 '작업 시작'으로 바꾸기


} else {
    //20250727 eun 수정 시작
    $sql_search_count = "";
    $sql_search_list  = "";
    if(count($mbid)>0){
        $sql_search_count .= " and mb_id in('".implode("','",$mbid)."')";      // ★수정: alias 없음
        $sql_search_list  .= " and m.mb_id in('".implode("','",$mbid)."')";    // ★수정: alias 있음
    }

    //20250727 eun 수정 마감

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




    // 상담사 리스트 정렬
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
        // 20250714 eun 상담사 리스트 부재중 가장 뒤 정렬 수정 시작

        if(!$state){
            // 기본값 가져오기
            $mb_ids = array();
            //$qs = "select mb_id from g5_member where 1=1 and mb_level='5' and (state='IDLE' or state='CONN' or state='ABSE'){$imss} order by FIELD (state, 'IDLE', 'CONN', 'ABSE')";
            $qs = "select m.mb_id from {$write_table} as gwc left join g5_member as m on gwc.mb_id = m.mb_id where m.mb_level='5' 
                and (m.state='IDLE' or m.state='CONN' or m.state='ABSE' or m.state='RDVC'){$imss} order by 
                if(state in ('IDLE','RDVC', 'CONN', 'ABSE'), 0, 1), FIELD (m.state, 'IDLE','RDVC', 'CONN', 'ABSE','')";

            if($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
                // echo "state 없을 때" .$qs;
                // echo "<br>";
            }
            $qr = sql_query($qs);
            // 20250714 eun 상담사 리스트 부재중 가장 뒤 정렬 수정 마감

            if($qr){
                while($qrow=sql_fetch_array($qr)){
                    $mb_ids[] = $qrow["mb_id"];
                }
            }
            $mb_id_in_count = "";
            $mb_id_in_list = ""; //원래 없었음
//			if(count($mb_ids)>0){
//				$sql_search .=" and mb_id in('".implode("','",$mb_ids)."')";
//			}
            if(count($mb_ids)>0){
                $mb_id_in_count = " and mb_id in('" . implode("','", $mb_ids) . "')";
                $mb_id_in_list  = " and m.mb_id in('" . implode("','", $mb_ids) . "')";
            }
        }
    }
    //////////////// 상담 게시판일때 , 상담중, 상담준비 상담사만 가져오기 끝 ...




    //원래쿼리2. $sql = " SELECT COUNT(DISTINCT `wr_parent`) AS `cnt` FROM {$write_table} WHERE 1=1 {$sql_search} "; //전체보기로 들어왔을 때
    $sql = "SELECT COUNT(DISTINCT wr_parent) AS cnt FROM {$write_table} WHERE 1=1 {$mb_id_in_count} {$sql_search_count}"; // 2025 ★수정
    // $sql = "SELECT COUNT(DISTINCT wr_parent) AS cnt FROM {$write_table} WHERE 1=1 {$mb_id_in_count} {$sql_search}";
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
        //  echo "전체COUNT 쿼리 검색 X 305열 : ". $sql;
    }
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
        $sst  = "order by wr_num, wr_reply";
        $sod = "";
    }
} else {
    $board_sort_fields = get_board_sort_fields($board, 1);
    if ($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
        //   echo "[DEBUG] get_board_sort_fields() 함수에 진입<br>";
        //   print_r($board_sort_fields); // 배열 내용까지 보고 싶으면 추가
    }
    if (!$sod && array_key_exists($sst, $board_sort_fields)) {
        $sst = $board_sort_fields[$sst];
    } else {
        // 게시물 리스트의 정렬 대상 필드가 아니라면 공백으로 (nasca 님 09.06.16)
        // 리스트에서 다른 필드로 정렬을 하려면 아래의 코드에 해당 필드를 추가하세요.
        // $sst = preg_match("/^(wr_subject|wr_datetime|wr_hit|wr_good|wr_nogood)$/i", $sst) ? $sst : "";
        // $sst = preg_match("/^(wr_datetime|wr_hit|wr_good|wr_nogood)$/i", $sst) ? $sst : ""; 20250715 16시07분에 필터링 작업하느라고 주석처리함
        $sst = preg_match("/^(wr_datetime|aft|fat|mb_4)$/i", $sst) ? $sst : "";
    }
}
//20250715 eun 디버깅용 코드 추가
if ($_SERVER['REMOTE_ADDR'] == "115.93.39.5" && $sst) {
    // echo "sst있음: " . $sst;
}
//20250715 eun 디버깅용 코드 추가 끝

if(!$sst)
    $sst  = "wr_num, wr_reply";

if ($sst) {
    $sql_order = "   {$sst} {$sod} ";
}


if($bo_table=="review"){
    $sql_order = " order by  wr_datetime desc";
}

//  20250722 eun  동일 인물 안 나오게 수정 중
// 상담사 전체보기 조건
if($bo_table=="counselor"){
    $sql_order = $sql_order_state;

    if($s_desc=="wr_datetime"){
        //$sql_order = " order by IF(state IN ('IDLE', 'CONN', 'ABSE'), 0, 1), FIELD (m.state, 'IDLE', 'CONN', 'ABSE',''),wr_datetime desc";
        $sql_order = "  group by gwc.wr_parent order by IF(m.state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1), FIELD(m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE',''), wr_datetime desc";
    }elseif($s_desc=="aft"){
        $sql_order = "  group by gwc.wr_parent order by CASE WHEN m.state IN ('IDLE', 'RDVC', 'CONN') THEN 0 WHEN m.state = 'ABSE' THEN 1 ELSE 2 END, afcnt desc";
    }elseif($s_desc=="fat"){
        $sql_order = "  group by gwc.wr_parent order by IF(state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE',''), fat desc";
    }elseif($s_desc=="amt"){
        $sql_order = "  group by gwc.wr_parent order by IF(state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE',''),m.mb_4 asc";

    }elseif($s_desc=="damt"){
        $sql_order = "  group by gwc.wr_parent order by IF(state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE',''), m.mb_4 desc";
    }
    else {
        $sql_order = "  group by gwc.wr_parent order by IF(state IN ('IDLE', 'RDVC', 'CONN', 'ABSE'), 0, 1),  FIELD (m.state, 'IDLE', 'RDVC', 'CONN', 'ABSE','')";
    }
}
//  20250722 eun 동일 인물 안 나오게 수정 마감

//  eun 페이지 나오게 수정 중 시작 완료되면 주석 수정
if ($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
    //  echo '<pre style="background:#fee;">[DEBUG] COUNT SQL: ' . htmlspecialchars($sql) . '</pre>';
}
//  eun 페이지 나오게 수정 중 끝 완료되면 주석 수정

// 20250714 상담사 리스트 전체보기 정렬 시작
if ($is_search_bbs) {

    $sql = " select distinct gwc.wr_parent, (select count(*) from g5_write_review r where r.wr_1 = gwc.mb_id) as afcnt
                 from {$write_table} as gwc left join g5_member as m on gwc.mb_id = m.mb_id where {$sql_search} {$sql_order} limit {$from_record}, {$page_rows} ";
    // 퍼블이 하드코딩이면 지울 것 $sql = " select distinct gwc.wr_parent,  gwc.mb_id, m.mb_4 from {$write_table} as gwc left join g5_member as m on gwc.mb_id = m.mb_id where {$sql_search} {$sql_order} limit {$from_record}, $page_rows ";
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
        // echo "[실제목록 SELECT 검색 O $sql \n";
    }
} else {
    // 원래 쿼리 3 $sql = " select * from {$write_table} as gwc left join g5_member as m on gwc.mb_id = m.mb_id where gwc.wr_is_comment = 0 {$sql_search}";
    // 후기 많은 순 작업 전 쿼리 $sql = "select * from {$write_table} as gwc left join g5_member as m on gwc.mb_id = m.mb_id where gwc.wr_is_comment = 0 {$mb_id_in_list} {$sql_search}";
    /*$sql = " select gwc.*, m.*, (select count(*) from g5_write_review r where r.wr_1 = gwc.mb_id) as afcnt from {$write_table} as gwc
            left join g5_member as m on gwc.mb_id = m.mb_id where gwc.wr_is_comment = 0 {$mb_id_in_list} {$sql_search}";*/

    $sql = "SELECT gwc.*, m.*, (select count(*) from g5_write_review r where r.wr_1 = gwc.mb_id) as afcnt 
        FROM {$write_table} as gwc
        LEFT JOIN g5_member as m on gwc.mb_id = m.mb_id
        WHERE gwc.wr_is_comment = 0 {$mb_id_in_list} {$sql_search_list}";
    // 20250727 eun 마감
    if(!empty($notice_array))
        $sql .= " and wr_id not in (".implode(', ', $notice_array).") ";
    $sql .= " {$sql_order} limit {$from_record}, $page_rows ";
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5") {
        //  echo "실제목록 select 검색 x $sql \n";
    }
}

//echo "<br>";
//20250714 eun 상담사 리스트 > 카테고리 적용 상태값에 따라 정렬 작업 마감


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
    $write_href = short_url_clean(G5_BBS_URL . '/write.php?bo_table=' . $bo_table);
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