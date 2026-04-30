<?php

$sub_menu = '350000';

include_once('./_common.php');





@include_once('./safe_check.php');

if(function_exists('social_log_file_delete')){

    social_log_file_delete(86400);      //소셜로그인 디버그 파일 24시간 지난것은 삭제

}



//$g5['title'] = '관리자메인 <div class="today point">2024-08-26</div>';

include_once ('./admin.head_index.php');



$new_member_rows = 5;

$new_point_rows = 5;

$new_write_rows = 5;



$sql_common = " from {$g5['member_table']} ";



$sql_search = " where (1) ";



if ($is_admin != 'super')

    $sql_search .= " and mb_level <= '{$member['mb_level']}' ";



if (!$sst) {

    $sst = "mb_datetime";

    $sod = "desc";

}



$sql_order = " order by {$sst} {$sod} ";



$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

$row = sql_fetch($sql);

$total_count = $row['cnt'];



// 탈퇴회원수

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_leave_date <> '' {$sql_order} ";

$row = sql_fetch($sql);

$leave_count = $row['cnt'];



// 탈퇴회원수 당월

$nowdays = date("Y-m")."-01 00:00:00";

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_leave_date <> '' and  mb_datetime >= '".$nowdays."'";

$row = sql_fetch($sql);

$leave_now_count = $row['cnt'];



// 차단회원수

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_intercept_date <> '' {$sql_order} ";

$row = sql_fetch($sql);

$intercept_count = $row['cnt'];





// 차단회원수 당월

$sql = " select count(*) as cnt {$sql_common} {$sql_search} and mb_intercept_date <> '' and  mb_datetime >= '".$nowdays."' ";

$row = sql_fetch($sql);

$intercept_now_count = $row['cnt'];









// 신규회원당원

$nowdays = date("Y-m")."-01 00:00:00";

$sql = " select count(*) as cnt {$sql_common} where mb_datetime >= '".$nowdays."'";

$row = sql_fetch($sql);

$nowmember_count = $row['cnt'];





$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$new_member_rows} ";

$result = sql_query($sql);

$colspan = 12;





/// 총상담 //

$sql = "select count(*) as ct, sum(amt) as tprice from platform_consulting where reason='DISCONNECT'";

//echo $sql;

$row = sql_fetch($sql);

$con_total = $row['ct'];

$con_price = $row["tprice"];



/// 070카운트

$sql2 = " select count(*) as cnt from platform_consulting  where reason='DISCONNECT' and preflag='Y'";

$row = sql_fetch($sql2);

$count_070 = $row['cnt'];





/// 060카운트

$sql3 = " select count(*) as cnt from platform_consulting  where reason='DISCONNECT' and preflag=''";

$row = sql_fetch($sql3);

$count_060 = $row['cnt'];





/// 총상담 당월//

$nowdays = date("Y-m")."-01 00:00:00";

$sql = "select count(*) as ct, sum(amt) as tmprice from platform_consulting where reason='DISCONNECT' and wr_datetime >='".$nowdays."'";

//echo $sql;

$row = sql_fetch($sql);

$ncon_total = $row['ct'];

$ncon_mprice = $row['tmprice'];



/// 070카운트 당월

$nowdays = date("Y-m")."-01 00:00:00";

$sql2 = " select count(*) as cnt , sum(amt) as tmprice from platform_consulting  where reason='DISCONNECT' and preflag='Y' and wr_datetime >='".$nowdays."'";

$row = sql_fetch($sql2);

$ncount_070 = $row['cnt'];

$mprice_070 = $row['tmprice'];



/// 060카운트 당월

$nowdays = date("Y-m")."-01 00:00:00";

$sql3 = " select count(*) as cnt, sum(amt) as tmprice from platform_consulting  where reason='DISCONNECT' and preflag='' and wr_datetime >='".$nowdays."'";

$row = sql_fetch($sql3);

$mprice_060 = $row['tmprice'];





// 주문상태에 따른 합계 금액

function get_order_status_sum($status)

{

    global $g5;



    $sql = " select count(*) as cnt,

                    sum(od_cart_price + od_send_cost + od_send_cost2 - od_cancel_price) as price

                from {$g5['g5_shop_order_table']}

                where od_status = '$status' ";

    $row = sql_fetch($sql);



    $info = array();

    $info['count'] = (int)$row['cnt'];

    $info['price'] = (int)$row['price'];

    $info['href'] = './orderlist.php?od_status='.urlencode($status);



    return $info;

}



// 일자별 주문 합계 금액

function get_order_date_sum($date)

{

    global $g5;



    $sql = " select sum(od_cart_price + od_send_cost + od_send_cost2) as orderprice,

                    sum(od_cancel_price) as cancelprice

                from {$g5['g5_shop_order_table']}

                where SUBSTRING(od_time, 1, 10) = '$date' ";

    $row = sql_fetch($sql);



    $info = array();

    $info['order'] = (int)$row['orderprice'];

    $info['cancel'] = (int)$row['cancelprice'];



    return $info;

}



// 일자별 결제수단 주문 합계 금액

function get_order_settle_sum($date)

{

    global $g5, $default;



    $case = array('신용카드', '계좌이체', '가상계좌', '무통장', '휴대폰');

    $info = array();



    // 결제수단별 합계

    foreach($case as $val)

    {

        $sql = " select sum(od_cart_price + od_send_cost + od_send_cost2 - od_receipt_point - od_cart_coupon - od_coupon - od_send_coupon) as price,

                        count(*) as cnt

                    from {$g5['g5_shop_order_table']}

                    where SUBSTRING(od_time, 1, 10) = '$date'

                      and od_settle_case = '$val' ";

        $row = sql_fetch($sql);



        $info[$val]['price'] = (int)$row['price'];

        $info[$val]['count'] = (int)$row['cnt'];

    }



    // 포인트 합계

    $sql = " select sum(od_receipt_point) as price,

                    count(*) as cnt

                from {$g5['g5_shop_order_table']}

                where SUBSTRING(od_time, 1, 10) = '$date'

                  and od_receipt_point > 0 ";

    $row = sql_fetch($sql);

    $info['포인트']['price'] = (int)$row['price'];

    $info['포인트']['count'] = (int)$row['cnt'];



    // 쿠폰 합계

    $sql = " select sum(od_cart_coupon + od_coupon + od_send_coupon) as price,

                    count(*) as cnt

                from {$g5['g5_shop_order_table']}

                where SUBSTRING(od_time, 1, 10) = '$date'

                  and ( od_cart_coupon > 0 or od_coupon > 0 or od_send_coupon > 0 ) ";

    $row = sql_fetch($sql);

    $info['쿠폰']['price'] = (int)$row['price'];

    $info['쿠폰']['count'] = (int)$row['cnt'];



    return $info;

}



function get_max_value($arr)

{

    foreach($arr as $key => $val)

    {

        if(is_array($val))

        {

            $arr[$key] = get_max_value($val);

        }

    }



    sort($arr);



    return array_pop($arr);

}




//20250731 eun RDVC 추가 시작
// 상담가능

//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and a.state='IDLE' ";
$sql = "select count(*) as cnt
        from {$g5['member_table']}
        where mb_level='5' and state in ('IDLE','RDVC')";
//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$id_count = $row["cnt"];


//20250731 EUN RDVC 추가  시작
// 부재중

//$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and a.state!='IDLE' ";
$sql = " select count(*) as cnt {$sql_common} where a.mb_level='5' and (a.state!='IDLE' and a.state!='RDVC') ";
//20250731 EUN RDVC 추가 마감

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$abs_count = $row["cnt"];





?>



    <style>

        .container_wr { background-color:#f7f7f7;}



        section.index { border:2px solid #0b20b5; background-color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.1); border-radius:20px; margin-bottom:20px;  }



        section.index h2 { margin:0; font-size: 16px; padding:15px 20px; border-bottom:1px solid #eee; font-weight:800;}

        section.index h2 .h2_text {display:inline-block; font-size:14px; margin-left:6px; font-weight:bold;}



        .today { display:inline-block; font-weight:600; color:#F00; font-size:16px; margin-left:6px; line-height: 36px;}

        .index_more { float:right; display:inline-block; background-color:#0b20b5; color:#fff; font-weight:600; font-size:11px; padding:4px 8px; border-radius:50px;}

        .index_more i { vertical-align:-1px;}



        .index_dash { padding:20px 20px 10px; }



        .index_dash h3 { font-size:14px; margin-bottom:10px;}



        .index_dash dl { padding:10px 12px; background-color:#f7f7f7; margin: 0 0 10px; border-radius:8px;}

        .index_dash dt { float:left; font-weight:700;}

        .index_dash dd { float:right; font-weight:400;}



        .index_dash .dot { position:relative; padding-left:10px; margin-top:8px;}

        .index_dash .dot:before { content:''; position:absolute; top:6px; left:0; display:inline-block; width:3px; height:3px; border-radius:50%; background-color:#000;}



        .index_flex { display:flex; justify-content: space-between; flex-wrap: wrap;}

        .index_flex .w100 { width:100%;}

        .index_flex .w50 { width:calc(50% - 10px);}

        .index_flex .w50_2 { width:50%;}

        .index_flex .w33 { width:calc(33% - 5px);}

        .index_flex .w25 { width:calc(25% - 10px);}





        .tbl_head01 tbody tr:nth-child(even) {}



        .index_title { font-size:22px; font-weight:700; margin-bottom:10px; color:#3f51b5; padding-left:20px;}



        hr { margin:20px 0 30px; border : 0px; border-top: 1px solid #eee;}





        #anc_sidx_ord { width:calc(50% - 10px);}

        #sidx_graph_area { border-top:none;}

        #sidx_graph { width: calc(100% - 20px); font-size:12px;}



        #sidx_graph_legend { left:auto; right:0;}



    </style>



    <!--

    <div>회원 현황 / 상담 현황 / 방문자 현황 / 신규가입회원 / 신규충전 / 상담사 현황 / TOP5</div>

    -->



    <div class="index_title">1. 회원현황</div>



    <section class="index">

        <h2>

            가입 현황

            <a href="./member_list_customer.php?sst=&sod=desc&sfl=mb_level&stx=2"><span class="index_more">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>



        <div class="index_dash index_flex">

            <dl class="w33">

                <dt>총 회원</dt> <dd><span class="point f_800"><?php echo number_format($total_count) ?></span>명</dd>

            </dl>

            <dl class="w33">

                <dt>차단</dt> <dd><span class="point f_800"><?php echo number_format($intercept_count) ?></span>명</dd>

            </dl>

            <dl class="w33">

                <dt>탈퇴</dt> <dd><span class="point f_800"><?php echo number_format($leave_count) ?></span>명</dd>

            </dl>

            <dl class="w33">

                <dt>신규회원(당월)</dt> <dd><span class="point f_500"><?=number_format($nowmember_count)?></span>명</dd>

            </dl>

            <dl class="w33">

                <dt>신규차단(당월)</dt> <dd><span class="point f_500"><?=number_format($intercept_now_count)?></span>명</dd>

            </dl>

            <dl class="w33">

                <dt>신규탈퇴(당월)</dt> <dd><span class="point f_500"><?=number_format($leave_now_count)?></span>명</dd>

            </dl>

        </div>

    </section>







    <section class="index">

        <h2>

            방문자 현황

            <?

            $sm = date("Y-m",time())."-01";

            $m_endday = date('t', strtotime($sm));

            //echo $m_endday;



            ?>

            <a href="./visit_date.php?fr_date=<?=date("Y-m",time())?>-01&to_date=<?=date("Y-m",time())?>-<?=$m_endday?>"><span class="index_more">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>

        <?

        preg_match("/오늘:(.*),어제:(.*),최대:(.*),전체:(.*)/", $config['cf_visit'], $visit);

        settype($visit[1], "integer");

        settype($visit[2], "integer");

        settype($visit[3], "integer");

        settype($visit[4], "integer");



        // 이번달 방문자수

        $nowdays = date("Y-m")."-01 00:00:00";

        $sql3 = " select sum(vs_count) as cnt from g5_visit_sum  where vs_date >='".$nowdays."'";

        $row = sql_fetch($sql3);

        $mnow_count = $row['cnt'];

        ?>

        <div class="index_dash index_flex">

            <dl class="w50">

                <dt>총 방문자</dt> <dd><span class="point f_800"><?php echo number_format($visit[4]) ?></span>명</dd>

            </dl>

            <dl class="w50">

                <dt>방문자(당월)</dt> <dd><span class="point f_500"><?=number_format($mnow_count)?></span>명</dd>

            </dl>

        </div>

    </section>



    <div class=" index_flex">

        <section class="index w50">

            <div class="">

                <h2>

                    신규가입회원 <!--<?php //echo $new_member_rows ?>건 목록-->

                    <a href="./member_list_customer.php?sst=&sod=desc&sfl=mb_level&stx=2"><span class="index_more">더보기 <i class="xi-angle-right"></i></span></a>

                </h2>



                <div class="index_dash">



                    <div class="tbl_head01 tbl_wrap">

                        <table>

                            <caption>신규가입회원</caption>

                            <thead>

                            <tr>

                                <th scope="col">회원아이디</th>

                                <th scope="col">이름</th>

                                <th scope="col">닉네임</th>

                                <th scope="col">권한</th>

                                <th scope="col">포인트</th>

                                <th scope="col">수신</th>

                                <!--

                                <th scope="col">공개</th>

                                <th scope="col">인증</th>

                                <th scope="col">차단</th>

                                <th scope="col">그룹</th>

                                -->

                            </tr>

                            </thead>

                            <tbody>

                            <?php

                            for ($i=0; $row=sql_fetch_array($result); $i++)

                            {

                                // 접근가능한 그룹수

                                $sql2 = " select count(*) as cnt from {$g5['group_member_table']} where mb_id = '{$row['mb_id']}' ";

                                $row2 = sql_fetch($sql2);

                                $group = "";

                                if ($row2['cnt'])

                                    $group = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'">'.$row2['cnt'].'</a>';



                                if ($is_admin == 'group')

                                {

                                    $s_mod = '';

                                    $s_del = '';

                                }

                                else

                                {

                                    $s_mod = '<a href="./member_form.php?$qstr&amp;w=u&amp;mb_id='.$row['mb_id'].'">수정</a>';

                                    $s_del = '<a href="./member_delete.php?'.$qstr.'&amp;w=d&amp;mb_id='.$row['mb_id'].'&amp;url='.$_SERVER['SCRIPT_NAME'].'" onclick="return delete_confirm(this);">삭제</a>';

                                }

                                $s_grp = '<a href="./boardgroupmember_form.php?mb_id='.$row['mb_id'].'">그룹</a>';



                                $leave_date = $row['mb_leave_date'] ? $row['mb_leave_date'] : date("Ymd", G5_SERVER_TIME);

                                $intercept_date = $row['mb_intercept_date'] ? $row['mb_intercept_date'] : date("Ymd", G5_SERVER_TIME);



                                $mb_nick = get_sideview($row['mb_id'], get_text($row['mb_nick']), $row['mb_email'], $row['mb_homepage']);



                                $mb_id = $row['mb_id'];

                                ?>

                                <tr>

                                    <td class=""><?php echo $mb_id ?></td>

                                    <td class=""><?php echo get_text($row['mb_name']); ?></td>

                                    <td class=" sv_use"><div><?php echo $mb_nick ?></div></td>

                                    <td class=""><?php echo $row['mb_level'] ?></td>

                                    <td><a href="./point_list.php?sfl=mb_id&amp;stx=<?php echo $row['mb_id'] ?>"><?php echo number_format($row['mb_point']) ?></a></td>

                                    <td class=""><?php echo $row['mb_mailling']?'예':'아니오'; ?></td>

                                    <!--

            <td class="td_boolean"><?php echo $row['mb_open']?'예':'아니오'; ?></td>

            <td class="td_boolean"><?php echo preg_match('/[1-9]/', $row['mb_email_certify'])?'예':'아니오'; ?></td>

            <td class="td_boolean"><?php echo $row['mb_intercept_date']?'예':'아니오'; ?></td>

            <td class="td_category"><?php echo $group ?></td>

            -->

                                </tr>

                                <?php

                            }

                            if ($i == 0)

                                echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';

                            ?>

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>

        </section>



        <section class="index w50">

            <div class="">

                <h2>

                    최근게시물

                    <a href="../adm/board_list.php"><span class="index_more">더보기 <i class="xi-angle-right"></i></span></a>

                </h2>



                <div class="index_dash">

                    <?php

                    $sql_common = " from {$g5['board_new_table']} a, {$g5['board_table']} b, {$g5['group_table']} c where a.bo_table = b.bo_table and b.gr_id = c.gr_id ";



                    if ($gr_id)

                        $sql_common .= " and b.gr_id = '$gr_id' ";

                    if (isset($view) && $view) {

                        if ($view == 'w')

                            $sql_common .= " and a.wr_id = a.wr_parent ";

                        else if ($view == 'c')

                            $sql_common .= " and a.wr_id <> a.wr_parent ";

                    }

                    $sql_order = " order by a.bn_id desc ";



                    $sql = " select count(*) as cnt {$sql_common} ";

                    $row = sql_fetch($sql);

                    $total_count = $row['cnt'];



                    $colspan = 5;

                    ?>



                    <div class="tbl_head01 tbl_wrap">

                        <table>

                            <caption>최근게시물</caption>

                            <thead>

                            <tr>

                                <!--<th scope="col">그룹</th>-->

                                <th scope="col">게시판</th>

                                <th scope="col">제목</th>

                                <th scope="col">이름</th>

                                <th scope="col">일시</th>

                            </tr>

                            </thead>

                            <tbody>

                            <?php

                            $sql = " select a.*, b.bo_subject, c.gr_subject, c.gr_id {$sql_common} {$sql_order} limit {$new_write_rows} ";

                            $result = sql_query($sql);

                            for ($i=0; $row=sql_fetch_array($result); $i++)

                            {

                                $tmp_write_table = $g5['write_prefix'] . $row['bo_table'];



                                if ($row['wr_id'] == $row['wr_parent']) // 원글

                                {

                                    $comment = "";

                                    $comment_link = "";

                                    $row2 = sql_fetch(" select * from $tmp_write_table where wr_id = '{$row['wr_id']}' ");



                                    $name = get_sideview($row2['mb_id'], get_text(cut_str($row2['wr_name'], $config['cf_cut_name'])), $row2['wr_email'], $row2['wr_homepage']);

                                    // 당일인 경우 시간으로 표시함

                                    $datetime = substr($row2['wr_datetime'],0,10);

                                    $datetime2 = $row2['wr_datetime'];

                                    if ($datetime == G5_TIME_YMD)

                                        $datetime2 = substr($datetime2,11,5);

                                    else

                                        $datetime2 = substr($datetime2,5,5);



                                }

                                else // 코멘트

                                {

                                    $comment = '댓글. ';

                                    $comment_link = '#c_'.$row['wr_id'];

                                    $row2 = sql_fetch(" select * from {$tmp_write_table} where wr_id = '{$row['wr_parent']}' ");

                                    $row3 = sql_fetch(" select mb_id, wr_name, wr_email, wr_homepage, wr_datetime from {$tmp_write_table} where wr_id = '{$row['wr_id']}' ");



                                    $name = get_sideview($row3['mb_id'], get_text(cut_str($row3['wr_name'], $config['cf_cut_name'])), $row3['wr_email'], $row3['wr_homepage']);

                                    // 당일인 경우 시간으로 표시함

                                    $datetime = substr($row3['wr_datetime'],0,10);

                                    $datetime2 = $row3['wr_datetime'];

                                    if ($datetime == G5_TIME_YMD)

                                        $datetime2 = substr($datetime2,11,5);

                                    else

                                        $datetime2 = substr($datetime2,5,5);

                                }

                                ?>



                                <tr>

                                    <!--<td class="td_category"><a href="<?php echo G5_BBS_URL ?>/new.php?gr_id=<?php echo $row['gr_id'] ?>"><?php echo cut_str($row['gr_subject'],10) ?></a></td>-->

                                    <!--                                    <td class=""><a href="--><?php //echo get_pretty_url($row['bo_table']) ?><!--">--><?php //echo cut_str($row['bo_subject'],20) ?><!--</a></td>-->
                                    <td class="">
                                        <a href="<?php echo ($row['bo_table'] === 'c_history')
                                            ? '/adm/coin_counsel_history.php'
                                            : get_pretty_url($row['bo_table']); ?>">
                                            <?php echo cut_str($row['bo_subject'], 20) ?>
                                        </a>
                                    </td>
                                    <td style="width:240px;">

                                        <a href="<?php echo get_pretty_url($row['bo_table'], $row2['wr_id']); ?><?php echo $comment_link ?>">

                                            <div style="width:240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align:left;"><?php echo $comment ?><?php echo conv_subject($row2['wr_subject'], 100) ?></div>

                                        </a>

                                    </td>

                                    <td class=""><div class="center"><?php echo $name ?></div></td>

                                    <td class="td_datetime2"><?php echo $datetime ?></td>

                                </tr>



                                <?php

                            }

                            if ($i == 0)

                                echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';

                            ?>

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>



        </section>

    </div>



    <hr />





    <div class="index_title pink">2. 매출현황</div>



    <section class="index pink_bo">

        <h2>

            상담 현황

            <a href="../adm/coin_counsel_history.php"><span class="index_more pink_bg">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>



        <div class="index_dash index_flex">

            <dl class="w33">

                <dt>총 상담</dt> <dd><span class="pink f_800"><?=number_format($con_total)?></span>건</dd>

            </dl>



            <dl class="w33">

                <dt>070상담</dt> <dd><span class="pink f_800"><?=number_format($count_070)?></span>건</dd>

            </dl>



            <dl class="w33">

                <dt>060상담</dt> <dd><span class="pink f_800"><?=number_format($count_060)?></span>건</dd>

            </dl>



            <dl class="w33">

                <dt>신규상담(당월)</dt> <dd><span class="pink f_500"><?=number_format($ncon_total)?></span>건</dd>

            </dl>



            <dl class="w33">

                <dt>070상담(당월)</dt> <dd><span class="pink f_500"><?=number_format($ncount_070)?></span>건</dd>

            </dl>



            <dl class="w33">

                <dt>060상담(당월)</dt> <dd><span class="pink f_500"><?=number_format($ncount_060)?></span>건</dd>

            </dl>

        </div>

    </section>



    <section class="index pink_bo">

        <h2>

            누적 매출

            <a href="../adm/coin_pay_history.php"><span class="index_more pink_bg">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>



        <div class="index_dash index_flex">

            <dl class="w33">

                <dt>총 매출(당월)</dt> <dd><span class="pink f_800"><?=number_format($ncon_mprice)?></span>원</dd>

            </dl>



            <dl class="w33">

                <dt>070상담(당월)</dt> <dd><span class="pink f_800"><?=number_format($mprice_070)?></span>원</dd>

            </dl>



            <dl class="w33">

                <dt>060상담(당월)</dt> <dd><span class="pink f_800"><?=number_format($mprice_060)?></span>원</dd>

            </dl>

        </div>

    </section>



    <div class=" index_flex ">



        <?

        function get_total_con_sum($date){



            if(!$date)return;



            $sdays = $date." 00:00:00";

            $edays = $date." 23:59:59";



            $sql2 = " select sum(amt) as tprice from platform_consulting  where reason='DISCONNECT' and wr_datetime between '".$sdays."' and '".$edays."' ";



            //echo $sql2;

            //echo "<br><br><br>";



            $row=sql_fetch($sql2);







            return Array ("order" => $row["tprice"], "cancel" =>0);





        }



        ?>



        <section id="anc_sidx_ord" class="index w50 pink_bo">

            <h2>매출현황</h2>

            <?php echo $pg_anchor; ?>



            <?php

            $arr_order = array();

            $x_val = array();

            for($i=6; $i>=0; $i--) {

                $date = date('Y-m-d', strtotime('-'.$i.' days', G5_SERVER_TIME));



                $x_val[] = $date;

                $arr_order[] = get_total_con_sum($date);

            }



            $max_y = get_max_value($arr_order);

            $max_y = ceil(($max_y) / 1000) * 1000;

            $y_val = array();

            $y_val[] = $max_y;



            for($i=4; $i>=1; $i--) {

                $y_val[] = $max_y * (($i * 2) / 10);

            }



            $max_height = 230;

            $h_val = array();

            $js_val = array();

            $offset = 10; // 금액이 상대적으로 작아 높이가 0일 때 기본 높이로 사용

            foreach($arr_order as $val) {

                if($val['order'] > 0)

                    $h1 = intval(($max_height * $val['order']) / $max_y) + $offset;

                else

                    $h1 = 0;



                if($val['cancel'] > 0)

                    $h2 = intval(($max_height * $val['cancel']) / $max_y) + $offset;

                else

                    $h2 = 0 ;



                $h_val['order'][] = $h1;

                $h_val['cancel'][] = $h2;

            }

            ?>



            <div id="sidx_graph" class="index_dash" style="min-height:300px;">

                <ul id="sidx_graph_price">

                    <?php

                    foreach($y_val as $val) {

                        ?>

                        <li><span></span><?php echo number_format($val); ?></li>

                        <?php

                    }

                    ?>

                </ul>

                <ul id="sidx_graph_area">

                    <?php

                    for($i=0; $i<count($x_val); $i++) {

                        $order_title = date("n월 j일", strtotime($x_val[$i])).' 주문: '.display_price($arr_order[$i]['order']);

                        $cancel_title = date("n월 j일", strtotime($x_val[$i])).' 취소: '.display_price($arr_order[$i]['cancel']);

                        $k = 10 - $i;

                        $li_bg = 'bg'.($i%2);

                        ?>

                        <li class="<?php echo $li_bg; ?>" style="z-index:<?php echo $k; ?>">

                            <div class="graph order" title="<?php echo $order_title; ?>">



                            </div>

                            <div class="graph cancel" title="<?php echo $cancel_title; ?>">



                            </div>

                        </li>

                        <?php

                    }

                    ?>

                </ul>

                <ul id="sidx_graph_date">

                    <?php



                    foreach($x_val as $val) {

                        ?>





                        <li><span></span><?php echo substr($val, 5, 5).' ('.get_yoil($val).')'; ?></li>





                        <?php

                    }

                    ?>

                </ul>

                <div id="sidx_graph_legend">

                    <span id="legend_order"></span> 매출

                    <span id="legend_cancel"></span> 취소

                </div>

            </div>



            <div id="sidx_graph" class="" style=" width:calc(100% - 40px); padding:10px; background-color:#f7f7f7; margin-left:20px; margin-bottom:20px; border-radius: 8px;">

                <div style="width:100%; display:flex;">

                    <ul style="width:10%; text-align:right;">신규가입</ul>

                    <ul style="width:calc(100% - 10%); display:flex; text-align:right;">



                        <?php

                        foreach($x_val as $val) {

                            ?>

                            <p style="width:100%;"><?=get_day_join_member_count($val)?>명</p>



                        <?}?>





                    </ul>

                </div>

                <div style="width:100%; display:flex; margin-top:6px;">

                    <ul style="width:10%; text-align:right; letter-spacing:-1.5px;">쿠폰다운로드</ul>

                    <ul style="width:calc(100% - 10%); display:flex; text-align:right;">

                        <?php

                        foreach($x_val as $val) {

                            ?>

                            <p style="width:100%;"><?=get_day_down_coupon_count($val)?>명</p>

                        <? }?>

                    </ul>

                </div>

            </div>

        </section>





        <section class="index w50 pink_bo">

            <div class="">

                <h2>

                    신규충전

                    <a href="../adm/coin_pay_history.php"><span class="index_more pink_bg">더보기 <i class="xi-angle-right"></i></span></a>

                </h2>



                <div class="index_dash">

                    <?

                    $psql = "select a.*, b.* from saju_payment a left join g5_member b on(a.mb_id=b.mb_id) where (1) order by od_time desc limit 0, 5";

                    $presult = sql_query($psql);

                    ?>

                    <div class="tbl_head01 tbl_wrap">

                        <table>

                            <caption>신규충전</caption>

                            <thead>

                            <tr>

                                <th scope="col">날짜</th>

                                <th scope="col">결제방법</th>

                                <th scope="col">회원아이디</th>

                                <th scope="col">결제금액</th>

                                <th scope="col">충전금액</th>

                                <th scope="col">결과</th>

                            </tr>

                            </thead>

                            <tbody>

                            <?

                            if($presult){

                                while($pres=sql_fetch_array($presult)){

                                    ?>

                                    <tr>

                                        <td class=""><?=$pres["od_time"]?></td>

                                        <td class="">

                                            <?

                                            if($pres["PayMethod"]=="DIR_CARD"){

                                                echo "카드결제";

                                            }elseif($pres["PayMethod"]=="PAYCO_PAY"){

                                                echo "페이코간편결제";

                                            }elseif($pres["PayMethod"]=="KAKAO_PAY"){

                                                echo "카카오결제";

                                            }elseif($pres["PayMethod"]=="NAVER_PAY"){

                                                echo "네이버결제";

                                            }else{

                                                //echo "무통장입금(가상결제)";

                                                echo "가상결제";

                                            }

                                            ?>

                                        </td>

                                        <td class=""><?=$pres["mb_id"]?><!--(<?=$pres["mb_email"]?>)--></td>

                                        <td class=""><?=number_format($pres["Amount"])?></td>

                                        <td><?=number_format($pres["Coin_Amount"])?></td>

                                        <td class=""><div style="width:40px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><?=$pres["ResultMsg"]?></div></td>

                                    </tr>

                                    <?

                                }

                            }

                            ?>



                            </tbody>

                        </table>

                    </div>

                </div>

            </div>



        </section>

    </div>



    <br />

    <hr />



    <div class="index_title black">3. 상담사 현황</div>



<?

$sql_common1 = " from {$g5['member_table']} a left join g5_write_counselor b on(a.mb_id=b.mb_id) ";



// 타로

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and b.ca_name='타로' ";

$row = sql_fetch($sql);

$taro_count = $row["cnt"];



// 신점

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and b.ca_name='신점' ";

$row = sql_fetch($sql);

$sin_count = $row["cnt"];



// 사주

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and b.ca_name='사주' ";

$row = sql_fetch($sql);

$saju_count = $row["cnt"];



// 심리

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and b.ca_name='심리' ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$sim_count = $row["cnt"];





/*function get_conn_state_count($state, $ca_name){

	global $g5;

	if(!$state)return;

	if(!$ca_name)return;

	$count = 0;

	$sql_common1 = " from {$g5['member_table']} a left join g5_write_counselor b on(a.mb_id=b.mb_id) ";



	$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='".$state."' and b.ca_name='".$ca_name."' ";

	echo $sql;

	//echo "<br>";

	$row = sql_fetch($sql);

	$count = $row["cnt"];



	return $count;

}*/
function get_conn_state_count($state, $ca_name){
    global $g5;
    if (empty($state) || empty($ca_name)) return 0;

    // 1) state를 배열로 정규화
    $states = is_array($state) ? $state : [$state];
    $states = array_values(array_unique(array_map(function($s){
        return strtoupper(trim($s));
    }, $states)));

    // 2) 상담가능 규칙: IDLE이 포함되면 RDVC도 자동 포함
    if (in_array('IDLE', $states, true) && !in_array('RDVC', $states, true)) {
        $states[] = 'RDVC';
    }

    // 3) SQL
    $in = "'" . implode("','", array_map('addslashes', $states)) . "'";
    $ca = addslashes($ca_name);

    $sql = "
        SELECT COUNT(*) AS cnt
        FROM {$g5['member_table']} a
        LEFT JOIN g5_write_counselor b ON a.mb_id=b.mb_id
        WHERE a.mb_level='5'
          AND a.state IN ({$in})
          AND b.ca_name='{$ca}'
    ";
    $row = sql_fetch($sql);
    return (int)$row['cnt'];
}








//상담중

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='CONN'";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$all_id_count = $row["cnt"];

// 상담가능
//20250731 EUN RDVC 추가 시작

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and (a.state='IDLE' or a.state='RDVC') ";

//20250731 EUN RDVC 추가 마감

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$all_id_count1 = $row["cnt"];



// 부재중

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='ABSE'";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$all_id_count2 = $row["cnt"];




//20250731 EUN RDVC 추가 시작
//타로 상담가능

//$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='IDLE' and b.ca_name='타로' ";
//$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and (a.state='IDLE' or a.state='RDVC') and b.ca_name='타로' ";
$sql = "SELECT COUNT(*) AS cnt FROM {$g5['member_table']} WHERE mb_level='5' AND state IN ('IDLE','RDVC')";
$id_count = (int)sql_fetch($sql)['cnt'];

$sql = "SELECT COUNT(*) AS cnt FROM {$g5['member_table']} WHERE mb_level='5' AND state NOT IN ('IDLE','RDVC')";
$abs_count = (int)sql_fetch($sql)['cnt'];

//20250731 EUN RDVC 추가 마감

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$taro_id_count = $row["cnt"];



//타로 부재중

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='ABSE' and b.ca_name='타로' ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$taro_abs_count = $row["cnt"];



//타로 상담중

$sql = " select count(*) as cnt {$sql_common1} where a.mb_level='5' and a.state='CONN' and b.ca_name='타로' ";

//echo $sql;

//echo "<br>";

$row = sql_fetch($sql);

$taro_conn_count = $row["cnt"];

// 카테고리별 상태
$taro_conn_count = get_conn_state_count('CONN', '타로');
$taro_id_count   = get_conn_state_count('IDLE', '타로');   // ← RDVC 자동 포함
$taro_abs_count  = get_conn_state_count('ABSE', '타로');

$sin_conn_count  = get_conn_state_count('CONN', '신점');
$sin_id_count    = get_conn_state_count('IDLE', '신점');   // ← RDVC 자동 포함
$sin_abs_count   = get_conn_state_count('ABSE', '신점');

$saju_conn_count = get_conn_state_count('CONN', '사주');
$saju_id_count   = get_conn_state_count('IDLE', '사주');   // ← RDVC 자동 포함
$saju_abs_count  = get_conn_state_count('ABSE', '사주');

$sim_conn_count  = get_conn_state_count('CONN', '심리');
$sim_id_count    = get_conn_state_count('IDLE', '심리');   // ← RDVC 자동 포함
$sim_abs_count   = get_conn_state_count('ABSE', '심리');


?>





    <section class="index black_bo">

        <h2>

            상담사 상태 현황



            <span class="h2_text point">

        상담중  <?=$all_id_count?>명

        /

        상담가능 <?php echo number_format($all_id_count1) ?>명

        /

        부재중<?php echo number_format($all_id_count2) ?>명

        </span>



            <a href="../adm/counselor_list.php"><span class="index_more black_bg">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>



        <div class="index_dash index_flex">

            <dl class="w25">

                <dt><span class="icon_cate tarot">타로</span></dt>

                <dd><span class=" f_800"><?=number_format($taro_count)?></span>명</dd>

                <dd class="w100 dot"><span class="f_700">상담중 <?=number_format($taro_conn_count)?>명</span></dd>

                <dd class="w100 dot">상담가능 <?=number_format($taro_id_count)?>명</dd>

                <dd class="w100 dot">부재중 <?=number_format($taro_abs_count)?>명</dd>

            </dl>

            <dl class="w25">

                <dt><span class="icon_cate sinjeom">신점</span></dt>

                <dd><span class=" f_800"><?=number_format($sin_count)?></span>명</dd>

                <dd class="w100 dot"><span class="f_700">상담중 <?=number_format($sin_conn_count)?>명</span></dd>
                <!--20250731 EUN RDVC 추가 시작-->
                <!--        <dd class="w100 dot">상담가능 --><?php //=number_format(get_conn_state_count('IDLE', '신점'))?><!--명</dd>-->
                <dd class="w100 dot">상담가능 <?=number_format($sin_id_count)?>명</dd>

                <dd class="w100 dot">부재중 <?=number_format($sin_abs_count)?>명</dd>

            </dl>

            <dl class="w25">

                <dt><span class="icon_cate saju">사주</span></dt>

                <dd><span class=" f_800"><?=number_format($saju_count)?></span>명</dd>

                <dd class="w100 dot"><span class="f_700">상담중 <?=number_format($saju_conn_count)?>명</span></dd>

                <!--            <dd class="w100 dot">상담가능 --><?php //=number_format(get_conn_state_count('IDLE', '사주'))?><!--명</dd>-->
                <dd class="w100 dot">상담가능 <?=number_format($saju_id_count)?>명</dd>

                <dd class="w100 dot">부재중 <?=number_format($saju_abs_count)?>명</dd>

            </dl>

            <dl class="w25">

                <dt><span class="icon_cate simli">심리</span></dt>

                <dd><span class=" f_800"><?=number_format($sim_count)?></span>명</dd>

                <dd class="w100 dot"><span class="f_700">상담중 <?=number_format($sim_conn_count)?>명</span></dd>

                <!--            <dd class="w100 dot">상담가능 --><?php //=number_format(get_conn_state_count('IDLE', '심리'))?><!--명</dd>-->
                <dd class="w100 dot">상담가능 <?=number_format($sim_id_count)?>명</dd>

                <dd class="w100 dot">부재중 <?=number_format($sim_abs_count)?>명</dd>
                <!--20250731 EUN RDVC 추가 마감-->

            </dl>

        </div>

    </section>



    <section class="index black_bo">

        <h2>

            TOP5

            <a href="../adm/coin_counsel_history.php"><span class="index_more black_bg">더보기 <i class="xi-angle-right"></i></span></a>

        </h2>
        <!--mb sort-->
        <?php



        $sql = "SELECT mb_id, sum( po_point ) AS tprice FROM g5_point WHERE mb_id IN (SELECT mb_id FROM g5_member WHERE mb_level = '5' ) GROUP BY mb_id ORDER BY tprice DESC LIMIT 5";

        $rst = sql_query($sql);

        ?>

        <div class="index_dash index_flex">

            <div class="w33">

                <h3 class="point">TOP5 상담사(상담금액 기준)</h3>

                <div class="tbl_head01 tbl_wrap">

                    <table>

                        <thead>

                        <tr>

                            <th scope="col">상담사</th>

                            <th scope="col">상담금액</th>

                        </tr>

                        </thead>

                        <tbody>

                        <?

                        if($rst){

                            while($res=sql_fetch_array($rst)){

                                $minfo = get_member($res["mb_id"]);

                                ?>

                                <tr>

                                    <td class=""><a href="/adm/member_form1.php?mb_id=<?=$minfo["mb_id"]?>&w=u" target="_blank"><?=$minfo["mb_nick"]?></a></td>

                                    <td class="right"><?=number_format($res["tprice"])?>원</td>

                                </tr>

                                <?

                            }

                        }

                        ?>





                        </tbody>

                    </table>

                </div>

            </div>

            <?



            $sql = "SELECT mb_id, count(*) as ct FROM `platform_consulting` where reason='DISCONNECT' and mb_id!='' group by mb_id  order by ct desc limit 5";

            $result = sql_query($sql);



            ?>

            <div class="w33">

                <h3 class="point">TOP5 상담사(상담건수 기준)</h3>

                <div class="tbl_head01 tbl_wrap">

                    <table>

                        <thead>

                        <tr>

                            <th scope="col">상담사</th>

                            <th scope="col">상담건수</th>

                        </tr>

                        </thead>

                        <tbody>

                        <?

                        if($result){

                            while($res=sql_fetch_array($result)){

                                $minfo1 = get_member($res["mb_id"]);

                                ?>

                                <tr>

                                    <td class=""><a href="/adm/member_form1.php?mb_id=<?=$minfo["mb_id"]?>&w=u" target="_blank"><?=$minfo1["mb_nick"]?></a></td>

                                    <td class="right"><?=$res["ct"]?></td>

                                </tr>

                                <?

                            }

                        }

                        ?>



                        </tbody>

                    </table>

                </div>

            </div>

            <?

            $sql = "SELECT membid, sum(amt) as price FROM `platform_consulting` where membid!='' group by membid order by price desc limit 5;";

            $result = sql_query($sql);

            ?>

            <div class="w33">

                <h3 class="point">TOP5 고객(상담금액 기준)</h3>

                <div class="tbl_head01 tbl_wrap">

                    <table>

                        <thead>

                        <tr>

                            <th scope="col">고객명</th>

                            <th scope="col">상담금액</th>

                        </tr>

                        </thead>

                        <tbody>

                        <?

                        if($result){

                            while($res=sql_fetch_array($result)){

                                $minfo = get_mbid($res["membid"]);

                                ?>



                                <tr>

                                    <td class=""><a href="/adm/member_form1.php?mb_id=<?=$minfo["mb_id"]?>&w=u" target="_blank"><?=$minfo["mb_name"]?> ( <?=$res["membid"]?> )</a.></td>

                                    <td class="right"><?=number_format($res["price"])?>원</td>

                                </tr>

                                <?

                            }

                        }?>



                        </tbody>

                    </table>

                </div>

            </div>

        </div>

    </section>



<?php

$sql_common = " from {$g5['board_new_table']} a, {$g5['board_table']} b, {$g5['group_table']} c where a.bo_table = b.bo_table and b.gr_id = c.gr_id ";



if ($gr_id)

    $sql_common .= " and b.gr_id = '$gr_id' ";

if (isset($view) && $view) {

    if ($view == 'w')

        $sql_common .= " and a.wr_id = a.wr_parent ";

    else if ($view == 'c')

        $sql_common .= " and a.wr_id <> a.wr_parent ";

}

$sql_order = " order by a.bn_id desc ";



$sql = " select count(*) as cnt {$sql_common} ";

$row = sql_fetch($sql);

$total_count = $row['cnt'];



$colspan = 5;

?>



    <section style="display:none;">

        <h2>최근게시물</h2>



        <div class="tbl_head01 tbl_wrap">

            <table>

                <caption>최근게시물</caption>

                <thead>

                <tr>

                    <th scope="col">그룹</th>

                    <th scope="col">게시판</th>

                    <th scope="col">제목</th>

                    <th scope="col">이름</th>

                    <th scope="col">일시</th>

                </tr>

                </thead>

                <tbody>

                <?php

                $sql = " select a.*, b.bo_subject, c.gr_subject, c.gr_id {$sql_common} {$sql_order} limit {$new_write_rows} ";

                $result = sql_query($sql);

                for ($i=0; $row=sql_fetch_array($result); $i++)

                {

                    $tmp_write_table = $g5['write_prefix'] . $row['bo_table'];



                    if ($row['wr_id'] == $row['wr_parent']) // 원글

                    {

                        $comment = "";

                        $comment_link = "";

                        $row2 = sql_fetch(" select * from $tmp_write_table where wr_id = '{$row['wr_id']}' ");



                        $name = get_sideview($row2['mb_id'], get_text(cut_str($row2['wr_name'], $config['cf_cut_name'])), $row2['wr_email'], $row2['wr_homepage']);

                        // 당일인 경우 시간으로 표시함

                        $datetime = substr($row2['wr_datetime'],0,10);

                        $datetime2 = $row2['wr_datetime'];

                        if ($datetime == G5_TIME_YMD)

                            $datetime2 = substr($datetime2,11,5);

                        else

                            $datetime2 = substr($datetime2,5,5);



                    }

                    else // 코멘트

                    {

                        $comment = '댓글. ';

                        $comment_link = '#c_'.$row['wr_id'];

                        $row2 = sql_fetch(" select * from {$tmp_write_table} where wr_id = '{$row['wr_parent']}' ");

                        $row3 = sql_fetch(" select mb_id, wr_name, wr_email, wr_homepage, wr_datetime from {$tmp_write_table} where wr_id = '{$row['wr_id']}' ");



                        $name = get_sideview($row3['mb_id'], get_text(cut_str($row3['wr_name'], $config['cf_cut_name'])), $row3['wr_email'], $row3['wr_homepage']);

                        // 당일인 경우 시간으로 표시함

                        $datetime = substr($row3['wr_datetime'],0,10);

                        $datetime2 = $row3['wr_datetime'];

                        if ($datetime == G5_TIME_YMD)

                            $datetime2 = substr($datetime2,11,5);

                        else

                            $datetime2 = substr($datetime2,5,5);

                    }

                    ?>



                    <tr>

                        <td class="td_category"><a href="<?php echo G5_BBS_URL ?>/new.php?gr_id=<?php echo $row['gr_id'] ?>"><?php echo cut_str($row['gr_subject'],10) ?></a></td>

                        <td class="td_category"><a href="<?php echo get_pretty_url($row['bo_table']) ?>"><?php echo cut_str($row['bo_subject'],20) ?></a></td>

                        <td><a href="<?php echo get_pretty_url($row['bo_table'], $row2['wr_id']); ?><?php echo $comment_link ?>"><?php echo $comment ?><?php echo conv_subject($row2['wr_subject'], 100) ?></a></td>

                        <td class="td_mbname"><div><?php echo $name ?></div></td>

                        <td class="td_datetime"><?php echo $datetime ?></td>

                    </tr>



                    <?php

                }

                if ($i == 0)

                    echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';

                ?>

                </tbody>

            </table>

        </div>



        <div class="btn_list03 btn_list">

            <a href="<?php echo G5_BBS_URL ?>/new.php">최근게시물 더보기</a>

        </div>

    </section>



<?php

$sql_common = " from {$g5['point_table']} ";

$sql_search = " where (1) ";

$sql_order = " order by po_id desc ";



$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";

$row = sql_fetch($sql);

$total_count = $row['cnt'];



$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$new_point_rows} ";

$result = sql_query($sql);



$colspan = 7;

?>



    <section style="display:none;">

        <h2>최근 포인트 발생내역</h2>

        <div class="local_desc02 local_desc">

            전체 <?php echo number_format($total_count) ?> 건 중 <?php echo $new_point_rows ?>건 목록

        </div>



        <div class="tbl_head01 tbl_wrap">

            <table>

                <caption>최근 포인트 발생내역</caption>

                <thead>

                <tr>

                    <th scope="col">회원아이디</th>

                    <th scope="col">이름</th>

                    <th scope="col">닉네임</th>

                    <th scope="col">일시</th>

                    <th scope="col">포인트 내용</th>

                    <th scope="col">포인트</th>

                    <th scope="col">포인트합</th>

                </tr>

                </thead>

                <tbody>

                <?php

                $row2['mb_id'] = '';

                for ($i=0; $row=sql_fetch_array($result); $i++)

                {

                    if ($row2['mb_id'] != $row['mb_id'])

                    {

                        $sql2 = " select mb_id, mb_name, mb_nick, mb_email, mb_homepage, mb_point from {$g5['member_table']} where mb_id = '{$row['mb_id']}' ";

                        $row2 = sql_fetch($sql2);

                    }



                    $mb_nick = get_sideview($row['mb_id'], $row2['mb_nick'], $row2['mb_email'], $row2['mb_homepage']);



                    $link1 = $link2 = "";

                    if (!preg_match("/^\@/", $row['po_rel_table']) && $row['po_rel_table'])

                    {

                        $link1 = '<a href="'.get_pretty_url($row['po_rel_table'], $row['po_rel_id']).'" target="_blank">';

                        $link2 = '</a>';

                    }

                    ?>



                    <tr>

                        <td class="td_mbid"><a href="./point_list.php?sfl=mb_id&amp;stx=<?php echo $row['mb_id'] ?>"><?php echo $row['mb_id'] ?></a></td>

                        <td class="td_mbname"><?php echo get_text($row2['mb_name']); ?></td>

                        <td class="td_name sv_use"><div><?php echo $mb_nick ?></div></td>

                        <td class="td_datetime"><?php echo $row['po_datetime'] ?></td>

                        <td><?php echo $link1.$row['po_content'].$link2 ?></td>

                        <td class="td_numbig"><?php echo number_format($row['po_point']) ?></td>

                        <td class="td_numbig"><?php echo number_format($row['po_mb_point']) ?></td>

                    </tr>



                    <?php

                }



                if ($i == 0)

                    echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';

                ?>

                </tbody>

            </table>

        </div>



        <div class="btn_list03 btn_list">

            <a href="./point_list.php">포인트내역 더보기</a>

        </div>

    </section>



    <script>

        $(function() {

            graph_draw();



            $("#sidx_graph_area div").hover(

                function() {

                    if($(this).is(":animated"))

                        return false;



                    var title = $(this).attr("title");

                    if(title && $(this).data("title") == undefined)

                        $(this).data("title", title);

                    var left = parseInt($(this).css("left")) + 10;

                    var bottom = $(this).height() + 5;



                    $(this)

                        .attr("title", "")

                        .append("<div id=\"price_tooltip\"><div></div></div>");

                    $("#price_tooltip")

                        .find("div")

                        .html(title)

                        .end()

                        //                .css({ left: left+"px", bottom: bottom+"px" })

                        .show(200);

                },

                function() {

                    if($(this).is(":animated"))

                        return false;



                    $(this).attr("title", $(this).data("title"));

                    $("#price_tooltip").remove();

                }

            );

        });



        function graph_draw()

        {

            var g_h1 = new Array("<?php echo implode('", "', $h_val['order']); ?>");

            var g_h2 = new Array("<?php echo implode('", "', $h_val['cancel']); ?>");

            var duration = 600;



            var $el = $("#sidx_graph_area li");

            var h1, h2;

            var $g1, $g2;



            $el.each(function(index) {

                h1 = g_h1[index];

                h2 = g_h2[index];



                $g1 = $(this).find(".order");

                $g2 = $(this).find(".cancel");



                $g1.animate({ height: h1+"px" }, duration);

                $g2.animate({ height: h2+"px" }, duration);

            });

        }

    </script>



<?php

include_once ('./admin.tail.php');