<?php


include_once('../common.php');


// 페이지 제목


$g5['title'] = "채팅상담 내역";


include_once(G5_THEME_MOBILE_PATH . '/head.php');


##############################################################


//20250716 eun $_SERVER["REQREST_URI"] -> $_SERVER["REQUEST_URI"] 수정 시작

if (!$member["mb_id"]) {

    alert('로그인하셔야합니다.', '/bbs/login.php?url=' . $_SERVER["REQUEST_URI"]);

}

//20250716 eun $_SERVER["REQREST_URI"] -> $_SERVER["REQUEST_URI"] 수정 마감


$cnum = $member["mb_1"];

//20250716 eun $_SERVER["REQREST_URI"] -> $_SERVER["REQUEST_URI"] 수정 시작


//20250728 eun 사용자 상담내역 페이지 카테고리 추가 사작

$sca = $_REQUEST["sca"];


$sql_common = " from chat_room ";


if ($member['mb_level'] == '10') {

    $sql_search = " where (1) and status='DISCONNECT'";

} else if ($member['mb_level'] == '5') {

    $sql_search = " where (1) and csr_id='{$cnum}' AND is_csr_delete = 'N'";

    $is_csr = 'Y';

} else {

    $sql_search = " where (1) and mb_id='{$cnum}' AND is_mb_delete = 'N'";

    $is_csr = 'N';

}


// TODO: N개월 보관 예정 정책이면 이 부분 수정 20250730 wb

// if($sfl=="wr_datetime"){


//  $sday = $_REQUEST["s_search_day"];


//  $eday = $_REQUEST["e_search_day"];


//  $sql_search .=" and wr_datetime between '".$sday."' and '".$eday."'";


// }


if (!$sst) {


    $sst = "chat_wdate";


    $sod = "desc";


}


$sql_order = " order by {$sst} {$sod} ";


$sql = " select count(*) as cnt {$sql_common} {$sql_search} {$sql_order} ";


$row = sql_fetch($sql);


$total_count = $row['cnt'];


$rows = $config['cf_page_rows'];


$total_page = ceil($total_count / $rows);  // 전체 페이지 계산


if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)


$from_record = ($page - 1) * $rows; // 시작 열을 구함


$sql = " select * {$sql_common} {$sql_search} {$sql_order} limit {$from_record}, {$rows} ";


// echo $sql;


$result = sql_query($sql);


?>


    <nav id="bo_cate" style="margin:10px 0;">

        <!-- <h2 class="sound_only">채팅내역 카테고리</h2> -->

    </nav>


    <!--20250728 eun 사용자 마이페이지 상담 카테고리 작업 마감-->


    <div class=" con_section_b_bot">


        <?php


        for ($i = 0; $row = sql_fetch_array($result); $i++) {


            if ($member['mb_level'] == '5') {

                $cinfo = get_csrid($row["mb_id"]);

                $img = '/img/common/logo3.png';

                $chatparam = '2';

            } else {

                $cinfo = get_csrid($row["csr_id"]);

                $chatparam = '1';

                $img = get_con_img($cinfo["mb_id"], '70', '70');

                // var_dump($cinfo);

            }


            /// 만약 상담사 정보있으면 상담사 프로필 가져오기


            if ($cinfo["mb_id"]) {

                $sql = "select * from g5_write_counselor where mb_id='" . $cinfo["mb_id"] . "'";

                $crow = sql_fetch($sql);

            }


            $minfo = get_mbid($row["mb_id"]);


            // mrtn 및 chatflag 디버깅

            $chatflag = $row['status'];

            $category_txt = ($chatflag == "DISCONNECT") ? "상담완료" : "상담중";


            $coin_sql = "SELECT no,amt,membid FROM platform_consulting WHERE roomid = '{$row['room_token']}' AND reason = 'END_CHAT'";

            $coin_row = sql_fetch($coin_sql);

            $wr_id = "";

            $wr_id = get_is_review($coin_row["no"]);


            $vsql = "select * from g5_write_c_history where wr_10='" . $coin_row["no"] . "'";


            $vrow = sql_fetch($vsql);


            ?>


            <div class="history_wrap">


                <div class="history_date"><?= $row["wr_datetime"] ?></div>


                <div class="history_con" <? if ($row['status'] != 'DISCONNECT' || (!$wr_id && $is_csr == 'Y') || $member['mb_level'] == '10') { ?> style="border-bottom:none;" <? } ?>>


                    <a href="/bbs/board.php?bo_table=counselor&wr_id=<?= $crow["wr_id"] ?>">
                        <div class="history_img" style="background-image:url(<?= $img ?>); "></div>
                    </a>


                    <div class="history_info_wrap" style="padding-left : 20px;">


                        <ul class="history_info">

                            <!--20250728 eun 상담 카테고리 추가 시작-->

                            <li class="history_info_01"><span><?= $category_txt ?></span></li>

                            <!--20250728 eun 상담 카테고리 추가 마감-->

                            <? if ($member['mb_level'] != '5') { ?>

                                <li class="history_info_02">

                                    상담사 : <?= $cinfo["mb_nick"] ?>

                                </li>

                            <? } else { ?>

                                <li class="history_info_02">

                                    상담 신청자 : <?= $cinfo["mb_nick"] ?>

                                </li>


                            <?
                            } ?>



                            <?php

                            $start = strtotime($row['chat_wdate']);

                            $end = strtotime($row['chat_edate']);

                            $usetm = $end - $start; // 상담 소요 시간 (초)


                            $usedCoin = ($coin_row['amt'] == 0) ? '-' : $coin_row['amt'];

                            ?>



                            <? if ($member['mb_level'] == '2') { ?>

                                <li class="history_info_03">시작시간 : <span class="f_600"><?= $row['chat_wdate'] ?></span>
                                </li>

                                <? if ($row['status'] == 'DISCONNECT') { ?>


                                    <li class="history_info_03">완료시간 : <span
                                                class="f_600"><?= !empty($row['chat_edate'])

                                                ? $row['chat_edate'] : "-" ?></span></li>

                                <? } ?>


                                <? if ($row['status'] == 'DISCONNECT') { ?>

                                    <li class="history_info_03">사용코인 : <span
                                                class="f_600"><?= number_format($usedCoin) . "코인" ?></span></li>

                                <? } ?>


                            <? } elseif ($member['mb_level'] == '5') { ?>

                                <li class="history_info_03">시작시간 : <span class="f_600"><?= $row['chat_wdate'] ?></span>
                                </li>

                                <? if ($row['status'] == 'DISCONNECT') { ?>

                                    <li class="history_info_03">완료시간 : <span
                                                class="f_600"><?= !empty($row['chat_edate'])

                                                ? $row['chat_edate'] : "-" ?></span></li>

                                <? } ?>

                                <? if ($row['status'] == 'DISCONNECT') { ?>

                                    <li class="history_info_03">과금코인 : <span

                                                class="f_600"><?= number_format($usedCoin) . "코인" ?></span></li>

                                <? } ?>


                            <? } elseif ($member['mb_level'] == '10') { ?>

                                <? $mbinfo = get_csrid($row["mb_id"]); ?>

                                <li class="history_info_03">상담사 : <span class="f_600"><?= $cinfo["mb_nick"] ?></span>
                                </li>

                                <li class="history_info_03">상담 신청자 : <span
                                            class="f_600"><?= htmlspecialchars($mbinfo['mb_nick'], ENT_QUOTES, 'UTF-8') ?></span>
                                </li>

                                <li class="history_info_03">시작시간 : <span class="f_600"><?= $row['chat_wdate'] ?></span>
                                </li>

                                <? if ($row['status'] == 'DISCONNECT') { ?>

                                    <li class="history_info_03">완료시간 : <span
                                                class="f_600"><?= !empty($row['chat_edate'])

                                                ? $row['chat_edate'] : $row['chat_wdate'] ?></span></li>

                                <? } ?>

                                <li class="history_info_03">과금코인 : <span

                                            class="f_600"><?= number_format($usedCoin) . "코인" ?></span></li>


                            <? } ?>


                        </ul>

                        <? if ($row['status'] == 'DISCONNECT') { ?>

                            <? if ($member['mb_level'] != '10') { ?>

                                <ul class="history_btn_wrap">

                                    <a href="#" onclick="removeChat('<?= $row['idx'] ?>','<?= $is_csr ?>')"
                                       class="history_btn">내역삭제하기</a>

                                </ul>

                            <? } ?>

                            <ul class="history_btn_wrap">
                                <a href="/counsel/chat_history.php?token=<?= $row['room_token'] ?>1"
                                   class="history_btn">채팅내역보기</a>

                            </ul>

                        <? } else { ?>

                            <!-- 수정된부분 체크 -->

                            <ul class="history_btn_wrap">
                                <a href="javascript:void(0)" onclick="goChat('<?=$row['room_token'].$chatparam?>')" class="history_btn">채팅입장하기</a>
                            </ul>

                        <? } ?>
                        <!-- 수정함 -->
                         
                        <script>

                            function goChat(room_id){

                                $.ajax({
                                    url: "/counsel/ajax.go_chat_room.php",
                                    type: "POST",
                                    data: { '' : '' },
                                    dataType: "text",
                                    success: function(){ 
                                        location.href = '/counsel/chat.php?token='+room_id; 
                                    },
                                    error: function(){ 
                                        alert('처리 실패. 다시 시도해주세요.'); 
                                    }
                                });
                            }

                            // $member["mb_id"]
                        </script>



                        <?php if (isset($member['mb_level']) && $member['mb_level'] === '5'): ?>
                            <?php if (!empty($coin_row['no'])): ?>
                                <ul class="history_btn_wrap">
                                    <?php if (empty($vrow)): ?>
                                        <li>
                                            <a class="history_btn"
                                               href="/bbs/write.php?<?= http_build_query([
                                                   'bo_table' => 'c_history',
                                                   'no'       => $coin_row['no'],
                                                   'c_url'    => 'chat',
                                                   'md'       => 'conmy',
                                               ]) ?>">
                                                상담메모작성
                                            </a>
                                        </li>
                                    <?php else: ?>
                                        <li>
                                            <a class="history_btn"
                                               href="/bbs/board.php?<?= http_build_query([
                                                   'bo_table' => 'c_history',
                                                   'wr_id'    => $vrow['wr_id'] ?? '',
                                                   'no'       => $coin_row['no'],
                                                   'c_url'    => 'chat',
                                                   'md'       => 'conmy',
                                               ]) ?>">
                                                상담메모보기
                                            </a>
                                        </li>
                                    <?php endif; ?>
                                </ul>
                            <?php endif; ?>
                        <?php endif; ?>


                    </div>


                </div>


                <div class="history_pay" style="padding-top:0px;">


                    <?


                    if ($row['status'] == 'DISCONNECT' && $is_csr == 'N') {

                        if (!$wr_id) {

                            ?>

                            <ul class="history_btn_wrap"><a
                                        href="../bbs/write.php?bo_table=review&csr_id=<?= $cinfo["mb_id"] ?>&cno=<?= $coin_row["no"] ?>"
                                        class="history_btn review_ok">후기 작성하기 <i class="xi-angle-right"></i></a></ul>

                            <?

                        } else {

                            ?>

                            <ul class="history_btn_wrap"><a href="../bbs/board.php?bo_table=review&wr_id=<?= $wr_id ?>"
                                                            class="history_btn review_no">후기 보러가기<i
                                            class="xi-angle-right"></i></a></ul>

                        <? } ?>

                        <?

                    } else if ($row['status'] == 'DISCONNECT' && $is_csr == 'Y') { ?>

                        <? if ($wr_id) { ?>

                            <ul class="history_btn_wrap"><a href="../bbs/board.php?bo_table=review&wr_id=<?= $wr_id ?>"
                                                            class="history_btn review_no">후기 답변달기<i
                                            class="xi-angle-right"></i></a></ul>

                        <? } ?>


                        <?

                    }

                    ?>


                </div>


            </div>


            <?php


        }


        if ($i == 0)


            echo "<div class='con_section empty_table'>상담내용이 없습니다.</div>";


        ?>







        <?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, '?' . $qstr . '&page='); ?>


    </div>


    <script>


        function removeChat(room_idx, is_csr) {


            if (!confirm('내역을 삭제하시겠습니까?')) return;


            $.ajax({

                url: './ajax.chat_record.php',

                type: 'POST',

                data: {act: 'removeChat', room_idx: room_idx, is_csr: is_csr},

                dataType: 'json',

                success: function (response) {


                    if (response.result == true) {

                        alert('삭제되었습니다');

                        location.reload();

                    }

                },

                error: function (xhr, status, error) {

                    console.error('에러 발생:', error);

                }

            });

        }

    </script>


<?php


include_once(G5_THEME_MOBILE_PATH . '/tail.php');


include_once(G5_THEME_MOBILE_PATH . '/tail.sub.php');


?>