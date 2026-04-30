<?php
if (!defined('_GNUBOARD_')) exit;
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
//20250909 추가
include_once(G5_LIB_PATH.'/counsel_flag.lib.php');

if (!function_exists('sql_escape_string')) {
    function sql_escape_string($s){ return addslashes($s); }
}
// 20250909 추가

// 최신글 추출
// $cache_time 캐시 갱신시간
function latest($skin_dir='', $bo_table, $rows=10, $subject_len=40, $cache_time=1, $options='')
{
    global $g5, $itab, $tindex, $member, $csr_id,$sca;

    

    /* 카테고리별 추출 가능 20270-07-02 */
    /*    list($bo_table, $category) = explode("|", $bo_table);
        if($category) $where = " AND ca_name = '".$category."' ";*/
    /* 카테고리/숨김 처리 */
    list($bo_table, $category) = explode("|", $bo_table);
    $where = ''; // 항상 초기화

    $hidden = function_exists('cs_hidden_cats') ? cs_hidden_cats() : []; // ['심리'] or []
// counselor 쿼리는 아래에서 write테이블을 a로 별칭 사용, 그 외엔 별칭 없음
    $ca_col = ($bo_table === 'counselor') ? 'a.ca_name' : 'ca_name';

// 요청 카테고리 지정
    if ($category) {
        // 요청 카테고리가 숨김이면 즉시 빈 결과(스킨만 렌더)
        if (in_array($category, $hidden, true)) {
            // 캐시/스킨 처리 루틴에 맞게 바로 빈 리스트를 출력하도록 return
            ob_start();
            include $latest_skin_path.'/latest.skin.php';
            $content = ob_get_clean();
            return $content; // 또는 return ''; (스킨에서 비었을 때 처리가 필요하면 위처럼)
        }
        $where .= " AND {$ca_col} = '".sql_escape_string($category)."' ";
    }

// 전역 스위치 OFF면 숨김 카테고리 전체 제외
    if (!empty($hidden)) {
        $hidden_escaped = array_map('sql_escape_string', $hidden);
        $where .= " AND {$ca_col} NOT IN ('".implode("','", $hidden_escaped)."') ";
    }

    if (!$skin_dir) $skin_dir = 'basic';

    $time_unit = 3600;  // 1시간으로 고정


    if(preg_match('#^theme/(.+)$#', $skin_dir, $match)) {
        if (G5_IS_MOBILE) {
            $latest_skin_path = G5_THEME_MOBILE_PATH.'/'.G5_SKIN_DIR.'/latest/'.$match[1];
            if(!is_dir($latest_skin_path))
                $latest_skin_path = G5_THEME_PATH.'/'.G5_SKIN_DIR.'/latest/'.$match[1];
            $latest_skin_url = str_replace(G5_PATH, G5_URL, $latest_skin_path);
        } else {
            $latest_skin_path = G5_THEME_PATH.'/'.G5_SKIN_DIR.'/latest/'.$match[1];
            $latest_skin_url = str_replace(G5_PATH, G5_URL, $latest_skin_path);
        }
        $skin_dir = $match[1];
    } else {
        if(G5_IS_MOBILE) {
            $latest_skin_path = G5_MOBILE_PATH.'/'.G5_SKIN_DIR.'/latest/'.$skin_dir;
            $latest_skin_url  = G5_MOBILE_URL.'/'.G5_SKIN_DIR.'/latest/'.$skin_dir;
        } else {
            $latest_skin_path = G5_SKIN_PATH.'/latest/'.$skin_dir;
            $latest_skin_url  = G5_SKIN_URL.'/latest/'.$skin_dir;
        }
    }
    

    $caches = false;

    if(G5_USE_CACHE) {
//        $cache_file_name = "latest-{$bo_table}-{$skin_dir}-{$rows}-{$subject_len}-".g5_cache_secret_key();
//        $caches = g5_get_cache($cache_file_name, (int) $time_unit * (int) $cache_time);
//        $cache_list = isset($caches['list']) ? $caches['list'] : array();
//        g5_latest_cache_data($bo_table, $cache_list);
    }

    if( $caches === false ){

        $list = array();

        $board = get_board_db($bo_table, true);

        if( ! $board ){
            return '';
        }

        $bo_subject = get_text($board['bo_subject']);
        $tmp_write_table = $g5['write_prefix'] . $bo_table; // 게시판 테이블 전체이름
        //20250727 eun 급상승 상담사 작업 시작
        $order_by = " ORDER BY IF(b.state IN ('IDLE','RDVC','CONN'), 0, 1),
                      FIELD(b.state,'IDLE','RDVC','CONN',''),
                      b.mb_nick ";

        if ($bo_table == "counselor") {
            if ($itab == "ing") { /// 상담중
                $where .= " and b.state='CONN'";
            } elseif ($itab == "rising") {// best 급상승은 관리자에서 추천한 사람
                /// $sql_common = " from {$g5['member_table']} where ev_4 = 'Y' ";
                $sql_order = " order by mb_rising asc, IF(state IN ('IDLE', 'RDVC', 'CONN'), 0, 1), FIELD (state, 'IDLE', 'RDVC', 'CONN','') ";
                /// 3일간 상담시간 top 5
                //상담 시간 많은 상담사 15명 가져오기
                //$treeday = date("Y-m-d H:i:s",strtotime("-3 days"));
                //$ssq = "SELECT csrid, SUM( usetm ) AS utm FROM `platform_consulting` where wr_datetime >='".$treeday."' GROUP BY csrid ORDER BY utm DESC LIMIT 0 , 15";
                $ssq = "SELECT * FROM {$g5['member_table']} where ( mb_rising >=1 and mb_rising <= 20 and state != 'ABSE') {$sql_order} LIMIT 0 , 15";
                // echo "latest.lib에 있는 쿼리" . $ssq;
                //echo "<br>";
                $mbids = array();
                /* $rrs = sql_query($ssq);
                 if ($rrs) {
                     while ($trow = sql_fetch_array($rrs)) {
                         //print_r($trow);
                         //echo "<br>";
                         if ($trow["csrid"]) {
                             $mm = get_csrid($trow["csrid"]);
                             $mbids[] = $mm["mb_id"];
                         }

                     }
                     sql_free_result($rrs);

                     //print_r($mbids);

                     if (count($mbids) > 0) {
                         $where .= " and b.mb_id in('" . implode("','", $mbids) . "') and (b.state='IDLE' or b.state='CONN' or b.state='RDVC')";
                     }



                 }*/
                $where .= " and ( b.mb_rising >=1 and b.mb_rising <= 20) and b.state !='ABSE'";  /// 해당부분 mb_rising으로 변경 필요
                $order_by = " ORDER BY b.mb_rising ASC, IF(b.state IN ('IDLE','RDVC','CONN'), 0, 1),
                              FIELD(b.state,'IDLE','RDVC','CONN',''), b.mb_nick ";
                //20250727 eun 급상승 상담사 작업 마감
                //20250727 eun 메인 index 스카웃, 채팅, 전체, 후기 별 쿼리 작업 시작
            } elseif ($itab == "sco") {// 스카웃
                $nn = strtotime("-6 month"); //6개월로 변경
                $where .=" and b.mb_datetime >='".date("Y-m-d",$nn)." 00:00:00"."' and (b.state='IDLE' or b.state='CONN' or b.state='RDVC') AND NOT (b.use_phone = 'N' AND b.use_chat = 'N')";
              //  $where .=" and b.mb_datetime >='".date("Y-m-d",$nn)." 00:00:00"."' and (b.state='IDLE' or b.state='CONN' or b.state='RDVC')";
            }elseif($itab=="rdvc"){ // 채팅 상담가능 켜둔 사람
                $where .=" and (b.state='IDLE' or b.state='RDVC' or b.state='CONN') and b.use_chat='Y' ";
            }elseif($itab=="all"){ // 상담 가능
                $where .=" and (b.state='IDLE' or b.state='RDVC' or b.state='CONN') AND NOT (b.use_phone = 'N' AND b.use_chat = 'N')";
            }

            //[2차 고도화 추가]
            if($sca == '타로'){
                $where .= " and a.ca_name IN ('타로')";
            }else if($sca == '신점'){
                $where .= " and a.ca_name IN ('신점')";
            }else if($sca == '사주'){
                $where .= " and a.ca_name IN ('사주')";
            }
            
            
            
            
            /*elseif($itab=="review"){ // 후기
						//$where .=" and (b.ev_4!='Y') and (b.state='IDLE' or b.state='CONN')";
					}*/
            //20250727 eun 메인 index 스카웃, 채팅, 전체, 후기별 쿼리 작업 마감

            /*20250710 eun 메인 홈 상담사 리스트 정렬 수정 시작*/
            $sql = " select a.*, b.mb_no, b.mb_level, b.mb_1, b.state, b.mb_3, b.mb_4, b.mb_5, b.mb_6, b.use_phone, b.use_chat , b.mb_rising, b.mb_id
                     from {$tmp_write_table} a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0"
                . $where . " GROUP BY a.mb_id order by case when b.state = 'IDLE' then 0  when b.state in ('CONN','RDVC') then 1 when b.state = 'ABSE' then 2 else 3 end, b.mb_nick limit 0, {$rows} ";

            
            /*20250710 eun 메인 홈 상담사 리스트 정렬 수정 마감*/

            


        }else{
            if($itab=="comment"){ /// 상담중
                $where .=" and wr_1='".$csr_id."'";
            }
            $sql = " select * from {$tmp_write_table} where wr_is_comment = 0 {$where} order by wr_datetime desc limit 0, {$rows} ";
            //echo $sql;

        }

        $result = sql_query($sql);
        for ($i=0; $row = sql_fetch_array($result); $i++) {




            try {
                unset($row['wr_password']);     //패스워드 저장 안함( 아예 삭제 )
            } catch (Exception $e) {
            }

            $row['wr_email'] = '';              //이메일 저장 안함

            if (strstr($row['wr_option'], 'secret')){           // 비밀글일 경우 내용, 링크, 파일 저장 안함



                if($row['mb_id']==$member["mb_id"] || $is_admin || $row["wr_1"]==$member["mb_id"]){
                }else{
                    $row['wr_content'] = $row['wr_link1'] = $row['wr_link2'] = '비밀글입니다.';
                    $row['file'] = array('count'=>0);
                }
            }


            $list[$i] = get_list($row, $board, $latest_skin_url, $subject_len);

            

            $list[$i]['first_file_thumb'] = (isset($row['wr_file']) && $row['wr_file']) ? get_board_file_db($bo_table, $row['wr_id'], 'bf_file, bf_content', "and bf_type between '1' and '3'", true) : array('bf_file'=>'', 'bf_content'=>'');
            $list[$i]['bo_table'] = $bo_table;
            // 썸네일 추가
            if($options && is_string($options)) {
                $options_arr = explode(',', $options);
                $thumb_width = $options_arr[0];
                $thumb_height = $options_arr[1];
                $thumb = get_list_thumbnail($bo_table, $row['wr_id'], $thumb_width, $thumb_height, false, true);
                // 이미지 썸네일
                if($thumb['src']) {
                    $img_content = '<img src="'.$thumb['src'].'" alt="'.$thumb['alt'].'" width="'.$thumb_width.'" height="'.$thumb_height.'">';
                    $list[$i]['img_thumbnail'] = '<a href="'.$list[$i]['href'].'" class="lt_img">'.$img_content.'</a>';
                    // } else {
                    //     $img_content = '<img src="'. G5_IMG_URL.'/no_img.png'.'" alt="'.$thumb['alt'].'" width="'.$thumb_width.'" height="'.$thumb_height.'" class="no_img">';
                }
            }

            if(! isset($list[$i]['icon_file'])) $list[$i]['icon_file'] = '';


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



        }
        g5_latest_cache_data($bo_table, $list);

        if(G5_USE_CACHE) {

            $caches = array(
                'list' => $list,
                'bo_subject' => sql_escape_string($bo_subject),
            );

            g5_set_cache($cache_file_name, $caches, (int) $time_unit * (int) $cache_time);
        }
    } else {
        $list = $cache_list;
        $bo_subject = (is_array($caches) && isset($caches['bo_subject'])) ? $caches['bo_subject'] : '';
    }



    ob_start();
    include $latest_skin_path.'/latest.skin.php';
    $content = ob_get_contents();
    ob_end_clean();

    return $content;
}

