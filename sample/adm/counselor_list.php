<?php

$sub_menu = "350120";

include_once('./_common.php');



auth_check_menu($auth, $sub_menu, 'r');





$fr_date = (isset($_GET['fr_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['fr_date'])) ? $_GET['fr_date'] : '';

$to_date = (isset($_GET['to_date']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $_GET['to_date'])) ? $_GET['to_date'] : '';





$sql_common = " from {$g5['member_table']} a left join (select mb_id, ca_name, wr_id from g5_write_counselor group by mb_id) b on(a.mb_id=b.mb_id) ";



$sql_search = " where (1) and a.mb_level = '5'  ";

if ($stx) {

    $sql_search .= " and ( ";

    switch ($sfl) {

        case 'a.mb_point' :

            $sql_search .= " ({$sfl} >= '{$stx}') ";

            break;

        case 'a.mb_level' :

            $sql_search .= " ({$sfl} = '{$stx}') ";

            break;

        case 'a.mb_tel' :

        case 'a.mb_hp' :

            $sql_search .= " ({$sfl} like '%{$stx}') ";

            break;

        case 'a.state' :


//20250731 eun RDVC 추가
            if($stx=="IDLE" or $stx=="RDVC" or $stx=="RDCH"){
//		if($stx=="IDLE"){
//20250731 eun RDVC 추가

                $sql_search .= " ({$sfl} like '%{$stx}') ";

            }else{

                $sql_search .= " ({$sfl} !='IDLE' and {$sfl} !='RDVC' and {$sfl} !='RDCH') ";
//			$sql_search .= " ({$sfl} !='IDLE') ";

            }

            break;

        default :

            $sql_search .= " ({$sfl} like '{$stx}%') ";

            break;

    }

    $sql_search .= " ) ";

}











if (!$sst) {

    $sst = "a.mb_no";

    $sod = "asc";

}





$sql_order = " order by {$sst} {$sod} ";



$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

$row = sql_fetch($sql);

$total_count = $row['cnt'];



$rows = $config['cf_page_rows'];

$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산

if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)

$from_record = ($page - 1) * $rows; // 시작 열을 구함









/*$sql_main = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";*/
$sql_main = "select a.*, b.ca_name, b.wr_id, a.mb_id as a_mb_id {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows}";




$result = sql_query($sql_main);



$colspan = 16;





// 탈퇴회원수

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_leave_date <> '' {$sql_order} ";

$row = sql_fetch($sql);

$leave_count = $row['cnt'];







// 차단회원수

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_intercept_date <> '' {$sql_order} ";

$row = sql_fetch($sql);

$intercept_count = $row['cnt'];





// 타로

$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='타로' ";

$row = sql_fetch($sql);

$taro_count = $row["cnt"];



// 신점

$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='신점' ";

$row = sql_fetch($sql);

$sin_count = $row["cnt"];



// 사주

$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='사주' ";

$row = sql_fetch($sql);

$saju_count = $row["cnt"];



// 심리

$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and b.ca_name='심리' ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$sim_count = $row["cnt"];





// 상담가능

$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state='IDLE' or a.state='RDVC' or a.state='RDCH') ";
//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state='IDLE') ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$id_count = $row["cnt"];



// 부재중

//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and a.state!='IDLE' ";
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state!='IDLE' and a.state!='RDVC') ";
//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state!='IDLE') ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$abs_count = $row["cnt"];









$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';



$g5['title'] = '상담사 리스트';

include_once('./admin.head.php');

include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');









$qstr = "$qstr&amp;sort1=$sort1&amp;sort2=$sort2&amp;page=$page&fr_date=".$fr_date."&to_date=".$to_date;





//echo $sql_main;





?>



    <style>

        .gray_bg { background-color:#FC0 !important;}

    </style>



    <div class="local_ov01 local_ov">

        <?php echo $listall ?>

        <span class="btn_ov01"><span class="ov_txt">총건수 </span><span class="ov_num"> <?php echo number_format($total_count) ?>건 </span></span>

        <!--

    <a href="?sst=mb_intercept_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" data-tooltip-text="차단된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">차단 </span><span class="ov_num"><?php echo number_format($intercept_count) ?>명</span></a>

    <a href="?sst=mb_leave_date&amp;sod=desc&amp;sfl=<?php echo $sfl ?>&amp;stx=<?php echo $stx ?>" class="btn_ov01" data-tooltip-text="탈퇴된 순으로 정렬합니다.&#xa;전체 데이터를 출력합니다."> <span class="ov_txt">탈퇴  </span><span class="ov_num"><?php echo number_format($leave_count) ?>명</span></a>

    -->

        <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>



        <span class="btn_ov01"><span class="ov_txt02">타로 </span><span class="ov_num"><a href="?sfl=b.ca_name&stx=타로"> <?php echo number_format($taro_count) ?>명 </a></span></span>

        <span class="btn_ov01"><span class="ov_txt02">신점 </span><span class="ov_num"><a href="?sfl=b.ca_name&stx=신점"> <?php echo number_format($sin_count) ?>명 </a></span></span>

        <span class="btn_ov01"><span class="ov_txt02">사주 </span><span class="ov_num"><a href="?sfl=b.ca_name&stx=사주"> <?php echo number_format($saju_count) ?>명 </a></span></span>

        <span class="btn_ov01"><span class="ov_txt02">심리 </span><span class="ov_num"><a href="?sfl=b.ca_name&stx=심리"> <?php echo number_format($sim_count) ?>명 </a></span></span>



        <span style="display:inline-block; padding:0 10px; line-height:30px; color:#ddd; font-size: 16px; font-weight:100; ">|</span>


        <!--20250731 eun RDVC 추가 시작-->
        <!--	<span class="btn_ov01"><span class="ov_txt03">상담가능 </span><span class="ov_num"><a href="?sfl=a.state&stx=IDLE"> --><?php //echo number_format($id_count) ?><!--명 </a></span></span>-->
        <span class="btn_ov01"><span class="ov_txt03">상담가능 </span><span class="ov_num"><a href="?sfl=a.state&stx=IDLE,RDVC,RDCH"> <?php echo number_format($id_count) ?>명 </a></span></span>
        <!--20250731 eun RDVC 추가 마감-->


        <span class="btn_ov01"><span class="ov_txt03">부재중 </span><span class="ov_num"><a href="?sfl=a.state&stx=ABSE"> <?php echo number_format($abs_count) ?>명 </a></span></span>

    </div>





    <div class="sch_text_date_wrap">

        <form id="fsearch" name="fsearch" class="local_sch01 local_sch" method="get">

            <div class="sch_text_date">

                <label for="sfl" class="sound_only">검색대상</label>

                <select name="sfl" id="sfl">

                    <option value="a.mb_id"<?php echo get_selected($sfl, "a.mb_id"); ?>>회원아이디</option>

                    <option value="a.mb_nick"<?php echo get_selected($sfl, "a.mb_nick"); ?>>닉네임</option>

                    <option value="a.mb_name"<?php echo get_selected($sfl, "a.mb_name"); ?>>이름</option>

                    <option value="a.mb_level"<?php echo get_selected($sfl, "a.mb_level"); ?>>권한</option>

                    <option value="a.mb_email"<?php echo get_selected($sfl, "a.mb_email"); ?>>E-MAIL</option>

                    <option value="a.mb_tel"<?php echo get_selected($sfl, "a.mb_tel"); ?>>전화번호</option>

                    <option value="a.mb_hp"<?php echo get_selected($sfl, "a.mb_hp"); ?>>휴대폰번호</option>

                    <option value="a.mb_point"<?php echo get_selected($sfl, "a.mb_point"); ?>>포인트</option>

                    <option value="a.mb_datetime"<?php echo get_selected($sfl, "a.mb_datetime"); ?>>가입일시</option>

                    <option value="a.mb_ip"<?php echo get_selected($sfl, "a.mb_ip"); ?>>IP</option>

                    <option value="a.mb_recommend"<?php echo get_selected($sfl, "a.mb_recommend"); ?>>추천인</option>

                </select>

                <label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>

                <input type="text" name="stx" value="<?php echo $stx ?>" id="stx" class="frm_input">

                <input type="submit" class="btn_submit" value="검색">



                <div style=" display:inline-block; padding: 0 20px; font-weight:200; font-size:18px; "> |</div>



                <div class="sch_last" style=" margin:0; ">

                    <strong>기간별 검색</strong>

                    <input type="text" name="fr_date" value="<?php echo $fr_date ?>" id="fr_date" class="frm_input" size="11" maxlength="10">

                    <label for="fr_date" class="sound_only">시작일</label>

                    ~

                    <input type="text" name="to_date" value="<?php echo $to_date ?>" id="to_date" class="frm_input" size="11" maxlength="10">

                    <label for="to_date" class="sound_only">종료일</label>

                    <input type="submit" value="검색" class="btn_submit">

                </div>







            </div>

        </form>



        <script>

            $(function(){

                $("#fr_date, #to_date").datepicker({ changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd", showButtonPanel: true, yearRange: "c-99:c+99", maxDate: "+0d" });

            });

        </script>



        <a href="#none;" onclick="window.open('counselor_list_excel.php?<?=$qstr?>')"><input type="submit" name="" value="엑셀다운로드" onclick="" class="btn btn_excel" style=" float:right;"></a>



    </div>







    <form name="fmemberlist" id="fmemberlist" action="./counselor_list_update.php" onsubmit="return fmemberlist_submit(this);" method="post">

        <input type="hidden" name="sst" value="<?php echo $sst ?>">

        <input type="hidden" name="sod" value="<?php echo $sod ?>">

        <input type="hidden" name="sfl" value="<?php echo $sfl ?>">

        <input type="hidden" name="stx" value="<?php echo $stx ?>">

        <input type="hidden" name="page" value="<?php echo $page ?>">

        <input type="hidden" name="token" value="">



        <div class="tbl_head01 tbl_wrap">

            <div class="tbl_head01 tbl_wrap">

                <table>

                    <caption><?php echo $g5['title']; ?> 목록</caption>

                    <thead>

                    <tr>

                        <th scope="col" id="mb_list_chk" >선택</th>

                        <th scope="col" id="mb_list_chk" ><?php echo subject_sort_link('mb_datetime', '', 'desc') ?>가입일시</th>

                        <th scope="col" id="mb_list_id"><?php echo subject_sort_link('a.mb_id', '', 'desc') ?>회원ID</th>

                        <th scope="col" id="mb_list_id"><?php echo subject_sort_link('mb_name', '', 'desc') ?>이름</th>

                        <th scope="col" id="mb_list_auth"><?php echo subject_sort_link('mb_nick', '', 'desc') ?>닉네임</th>

                        <th scope="col" id="mb_list_chk" class="" ><?php echo subject_sort_link('ca_name', '', 'desc') ?>분야</th>

                        <th scope="col" id="mb_list_auth"><?php echo subject_sort_link('mb_hp', '', 'desc') ?>휴대폰</th>

                        <th scope="col" id="mb_list_auth"><?php echo subject_sort_link('mb_no', '', 'desc') ?>번호</th>

                        <th scope="col" id="mb_list_auth"><?php echo subject_sort_link('mb_1', '', 'desc') ?>mnet<span style="display:inline-block; text-decoration: underline;">번호</span></th>

                        <th scope="col" id="mb_list_auth">권한</th>

                        <th scope="col" id="mb_list_chk" class="" >누적<span style="display:inline-block;">후기</span></th>

                        <!--20250710 eun 상담사 추천 순서 시작-->
                        <th scope="col" class="" ><?php echo subject_sort_link('mb_sort', '', 'desc') ?>사주플랜<br/>추천<span style="display:inline-block;">순서</span></th>
                        <!--20250710 eun 상담사 추천 순서 마감-->

                        <th scope="col" id="mb_list_grp">누적<span style="display:inline-block;">상담수</span></th>

                        <th scope="col" id="mb_list_grp" class="" >누적<span style="display:inline-block;">상담시간</span></th>

                        <th scope="col" id="mb_list_grp" class="" >단골수</th>

                        <th scope="col" id="mb_list_auth" ><?php echo subject_sort_link('mb_point', '', 'desc') ?>포인트</th>

                        <th scope="col" id="mb_list_grp" class="" >지난달매출<br />(070)</th>

                        <th scope="col" id="mb_list_grp" class="" >지난달매출<br />(060)</th>

                        <th scope="col" id="mb_list_grp" class="" ><?php echo subject_sort_link('mb_20', '', 'desc') ?>로열티</th>

                        <th scope="col" id="mb_list_grp">상태</th>
                        <!--20250727 eun AI 추천에서  급상승 상담사로 변경 시작-->
                        <th scope="col" id="mb_list_grp"><?php echo subject_sort_link('mb_rising', '', 'desc') ?>급상승<br />상담사</th>
                        <!--20250727 eun AI 추천에서  급상승 상담사로 변경 마감-->
                        <th scope="col" id="mb_list_grp">이벤트</th>

                        <th scope="col" id="mb_list_mng">관리</th>

                        <!--<th scope="col" id="mb_list_grp">상담사번호</th>-->

                    </tr>

                    </thead>

                    <tbody>



                    <?php



                    for ($i=0; $row=sql_fetch_array($result); $i++) {



                        //print_r($row);



                        // 접근가능한 그룹수

                        $sql2 = " select count(*) as cnt from {$g5['group_member_table']} where mb_id = '{$row['mb_id']}' ";

                        $row2 = sql_fetch($sql2);

                        $group = '';

                        if ($row2['cnt'])

                            $group = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'">'.$row2['cnt'].'</a>';



                        if ($is_admin == 'group') {

                            $s_mod = '';

                        } else {

                            //$s_mod = '<a href="./member_form.php?'.$qstr.'&amp;w=u&amp;mb_id='.$row['mb_id'].'" class="btn btn_03">등록하기</a>';

                            $s_mod = '<a href="../bbs/write.php?w=u&bo_table=counselor&wr_id=21" target="_blank" class="btn btn_03">등록하기</a>';

                        }

                        $s_grp = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'" class="btn btn_02">그룹</a>';



                        $leave_date = $row['mb_leave_date'] ? $row['mb_leave_date'] : date('Ymd', G5_SERVER_TIME);

                        $intercept_date = $row['mb_intercept_date'] ? $row['mb_intercept_date'] : date('Ymd', G5_SERVER_TIME);



                        $mb_nick = get_sideview($row['mb_id'], get_text($row['mb_nick']), $row['mb_email'], $row['mb_homepage']);



                        //  $mb_id = $row['mb_id']; //0811
                        $mb_id = $row['a_mb_id'];

                        $leave_msg = '';

                        $intercept_msg = '';

                        $intercept_title = '';

                        if ($row['mb_leave_date']) {

                            $mb_id = $mb_id;

                            $leave_msg = '<span class="mb_leave_msg">탈퇴함</span>';

                        }

                        else if ($row['mb_intercept_date']) {

                            $mb_id = $mb_id;

                            $intercept_msg = '<span class="mb_intercept_msg">차단됨</span>';

                            $intercept_title = '차단해제';

                        }

                        if ($intercept_title == '')

                            $intercept_title = '차단하기';



                        $address = $row['mb_zip1'] ? print_address($row['mb_addr1'], $row['mb_addr2'], $row['mb_addr3'], $row['mb_addr_jibeon']) : '';



                        $bg = 'bg'.($i%2);



                        ?>


                        <!--20250801 eun 한 줄 클릭하면 해당 줄 체크박스 선택 시작-->
                        <tr class="<?php echo $bg; ?>" data-index="<?php echo $i; ?>">
                            <!--20250801 eun 한 줄 클릭하면 해당 줄 체크박스 선택 마감-->

                            <td class="td_num">

                                <?//=$row["mb_no"]?>

                                <!--			<input type="hidden" name="mb_id[--><?php //echo $i ?><!--]" value="--><?php //echo $row['mb_id'] ?><!--" id="mb_id_--><?php //echo $i ?><!--">-->
                                <input type="hidden" name="mb_id[<?php echo $i ?>]" value="<?php echo $row['a_mb_id'] ?>" id="mb_id_<?php echo $i ?>">



                                <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo get_text($row['mb_name']); ?> <?php echo get_text($row['mb_nick']); ?>님</label>

                                <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">

                            </td>

                            <td class=""><!--가입일--><?//=$row["mb_datetime"]?> <?php //echo date("Y-m-d", strtotime($row['mb_datetime'])) ?> <?php echo substr($row['mb_datetime'],2,18); ?></td>

                            <td headers="mb_list_id"><!--아이디--><?php echo $mb_id ?></td>

                            <td headers="mb_list_id"><!--이름--><?php echo get_text($row['mb_name']); ?></td>

                            <td headers="mb_list_id"><!--닉네임--><?php echo get_text($row['mb_nick']); ?></td>

                            <td><!--분야--><?=$row["ca_name"]?></td>

                            <td headers="mb_list_id"><?php echo get_text($row['mb_hp']); ?></td>

                            <td headers="mb_list_id"><!--상담사 번호--><?php echo $row['mb_no']; ?></td>

                            <td headers="mb_list_id"><!--mnet 번호--><?php echo $row['mb_1']; ?></td>

                            <td headers="mb_list_auth" style="    min-width: 50px;">

                                <!--권한--><?php echo get_member_level_select("mb_level[$i]", 1, $member['mb_level'], $row['mb_level']) ?>

                            </td>

                            <!--<td headers="mb_list_grp" class="">상담사번호<?=$row["mb_no"]?></td>-->

                            <td><!--누적후기--><?=get_counselor_afcnt($row["mb_id"])?></td>


                            <!-- 20250710 eun 상담사 추천 순서 작업 시작-->
                            <td headers="mb_list_order"><!--상담사 추천 순서--><input type="number" name="mb_sort[<?php echo $i; ?>]"  max="20" style="width:40px; text-align:center;"
                                                                               value="<?php echo $row['mb_sort'] ? $row['mb_sort'] : ''; ?>" placeholder="-"></td>
                            <!-- 20250711 eun 상담사 추천 순서 작업 마감-->

                            <td><!--누적상담건수--><?=get_counselor_counter_all($row["mb_id"])?></td>

                            <td><!--누적상담시간--><?=gmdate("H:i:s", get_counselor_sum_time($row["mb_id"]));?></td>

                            <td><!--단골수--><?=get_counselor_scrap_count($row["wr_id"])?></td>

                            <td headers="mb_list_auth">

                                <!--포인트--><?php echo number_format($row['mb_point']) ?>

                            </td>

                            <td><!--지난달매출(070)--><?=number_format(get_con_total_account_befre_mode($row["mb_id"], "070"))?></td>

                            <td><!--지난달매출(060)--><?=number_format(get_con_total_account_befre_mode($row["mb_id"], "060"))?></td>



                            <td headers="mb_list_grp" class="" style="width:70px;">



                                <?php if ($row['mb_20']) { ?>

                                    <?php echo number_format($row['mb_20']) ?>%

                                <?php } ?>

                            </td>

                            <td headers="mb_list_grp" class="" style="width:70px;">

                                <!--상담상태-->

                                <?

                                //IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비

                                //echo $s_state[$row["state"]] ;

                                ?>

                                <div style="display:block;">



                                    <?

                                    $qry = "select * from member_status_history where mb_id='".$row["mb_id"]."'";

                                    $rrs = sql_fetch($qry);

                                    if($rrs["status"]=="ABSE"){

                                        echo  $s_state[$rrs["status"]];

                                        echo "<br>";

                                        ?>

                                        (<?= diff_time($rrs["wr_datetime"], date("Y-m-d H:i:s",time()));?>)

                                    <?}?>

                                </div>

                            </td>
                            <!-- 20250731 eun 실시간 급상승 상담사 작업 시작-->
                            <td headers="mb_list_grp">

                                <!--AI추천에서 급상승 상담사로 변경-->

                                <!--<label for="ev_4">

            	<input id="ev_4" type="checkbox" name="ev_4[<?php /*echo $i */?>]" value="Y" <?/*if($row["ev_4"]=="Y"){echo "checked";}*/?>/>

            </label>-->
                                <label for="mb_rising">
                                    <input type="number" name="mb_rising[<?php echo $i; ?>]"  max="20" style="width:40px; text-align:center;"
                                           value="<?php echo $row['mb_rising'] ? $row['mb_rising'] : ''; ?>" placeholder="-"></label>
                            </td>
                            <!-- 20250731 eun 실시간 급상승 상담사 작업 마감-->

                            <td headers="mb_list_grp">

                                <!--이벤트-->

                                <label for="event1">

                                    <input id="event1" type="checkbox" name="ev_1[<?php echo $i ?>]" value="Y" <?if($row["ev_1"]=="Y"){echo "checked";}?>/>

                                    <span>1</span>

                                </label>

                                <label for="event2" style="display:inline-block; margin-left:10px;">

                                    <input id="event2" type="checkbox" name="ev_2[<?php echo $i ?>]" value="Y" <?if($row["ev_2"]=="Y"){echo "checked";}?>/>

                                    <span>2</span>

                                </label>

                                <label for="event3" style="display:inline-block; margin-left:10px;">

                                    <input id="event3" type="checkbox" name="ev_3[<?php echo $i ?>]" value="Y" <?if($row["ev_3"]=="Y"){echo "checked";}?>/>

                                    <span>3</span>

                                </label>

                            </td>



                            <td headers="mb_list_mng" class=" _m">

                                <?

                                /// 해당 프로필이있는지 확인

                                $sql1 = "select * from g5_write_counselor where mb_id='".$row["mb_id"]."'";

                                //echo $sql1;

                                //echo "<br>";

                                $mrow=sql_fetch($sql1);

                                $purl = "";

                                $w = "";

                                if($mrow["wr_id"]){

                                    $purl = "&wr_id=".$mrow["wr_id"]."&tmb_id=".$row["mb_id"];

                                    $w= "u";

                                }else{

                                    $purl = "&tmb_id=".$row["mb_id"];

                                    $w = "";

                                }



                                ?>
                                <!--			<a href="./member_form1.php?sst=&sod=&sfl=&stx=&page=&w=u&mb_id=--><?php //=$row["mb_id"]?><!--"  target="_blank" class="btn btn_03" style="min-width:85px;">상담사 정보</a>-->
                                <a href="./member_form1.php?<?=$qstr?>&w=u&mb_id=<?=rawurlencode($row['a_mb_id'])?>"
                                   target="_blank" class="btn btn_03" style="min-width:85px;">상담사 정보</a>

                        </tr>









                        <?php

                    }

                    if ($i == 0)

                        echo "<tr><td colspan=\"".$colspan."\" class=\"empty_table\">자료가 없습니다.</td></tr>";

                    ?>

                    </tbody>

                </table>

            </div>

        </div>



        <div class="btn_fixed_top">





            <?php if ($is_admin == 'super') { ?>

                <input type="submit" name="act_button" value="일괄저장" onclick="document.pressed=this.value" class="btn btn_02">

            <?php } ?>

            <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">

            <input type="submit" name="act_button" value="완전삭제" onclick="document.pressed=this.value" class="btn btn_02">

            <?php if ($is_admin == 'super') { ?>
                <!--20250811 eun 회원 추가 수정-->
                <!--    <a href="./member_form1.php" id="member_add" class="btn btn_01">회원추가</a>-->
                <a href="./member_form1.php" id="member_add" class="btn btn_01">회원추가</a>

            <?php } ?>

        </div>





        </div>





    </form>



<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?'.$qstr.'&amp;page='); ?>



    <script>

        function fmemberlist_submit(f)

        {



            if (!is_checked("chk[]")) {

                alert(document.pressed+" 하실 항목을 하나 이상 선택하세요.");

                return false;

            }

            return true;



        }
        //<!--20250801 eun 한 줄 클릭하면 해당 줄 체크박스 선택 시작-->
        $(function(){
            // tr 클릭시 체크박스 토글
            $(".tbl_wrap table tbody tr").click(function(e){
                // 만약 클릭이 label/input 위라면 중복체크 방지
                if ($(e.target).is("input, label, a")) return;

                var idx = $(this).data("index");
                var $chk = $("#chk_" + idx);

                if($chk.length){
                    $chk.prop("checked", !$chk.prop("checked"));
                }
            });
        });
        //<!--20250801 eun 한 줄 클릭하면 해당 줄 체크박스 선택 마감-->



    </script>



<?php

include_once ('./admin.tail.php');