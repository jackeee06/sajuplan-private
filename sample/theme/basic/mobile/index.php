<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
@include_once(G5_LIB_PATH.'/thumbnail.lib.php');
@include_once(G5_LIB_PATH.'/common.lib.php');
if(G5_COMMUNITY_USE === false) {
    include_once(G5_THEME_MSHOP_PATH.'/index.php');
    return;
}



include_once(G5_THEME_MOBILE_PATH.'/head_index.php');
?>


    <!-- 하단 메뉴 HOVER -->
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_home.css" type="text/css">
    <!-- HEAD 회색으로 변경 -->
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/mobile_shop.css">
    <!-- 메인 슬라이드 CSS -->
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.min.css">
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/swiper.css">
    <!-- HEAD 회색으로 변경
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_head.css">
    -->
    <!-- BODY 회색으로 변경
    <link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/gray_body.css">
    -->

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;700&display=swap');


        /* 메인섹션 타이틀 공통CSS */
        .main_title {width:100%; float:left; font-size:18px; color:#000; line-height:1.3; padding:15px 15px 0; font-weight:600;}
        .main_title span {color:#13a89e;}
        .main_title p { font-size:14px; color:#999;font-weight:400;}

        .main_slide {width:100%; float:left;}
        .main_slide ul.main_slide_ul {position:relative; width:100%; float:left; padding-bottom:30px;}

        /* 메인 배너 페이지네이션: dot -> 1/10 형태 */
        /* .main_slide_pagination.main_slide_fraction {
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:2px;
            min-width:44px;
            height:22px;
            padding:0 8px;
            border-radius:12px;
            background:rgba(0,0,0,.45);
            color:#fff;
            font-size:12px;
            font-weight:600;
        }
        .main_slide_pagination.main_slide_fraction .swiper-pagination-bullet {
            width:0 !important;
            height:0 !important;
            margin:0 !important;
            opacity:0 !important;
        }
        .main_slide_pagination.main_slide_fraction .main_slide_fraction_text {
            line-height:1;
        } */

        .main_01 {width:100%; float:left;}
        .main_01 ul {width:100%; float:left;}
        .main_01 ul.con {font-size:16px; color:#777; padding:45px 15px 15px 15px;}
        .main_01 ul.con li {width:calc(50% - 7px); float:left; padding:20px; border-radius:15px; padding:20px; background-color:#fff; float:left; box-shadow:5px 5px 15px rgba(0,0,0,.1);}
        .main_01 ul.con a:last-child li { margin-left:14px;}

        .main_01 ul.con li p.icon {width:80px; height:80px; padding:20px; background-color:#829cf0; border-radius:100%; margin-top:-65px;}
        .main_01 ul.con li p.icon img {width:100%;}
        .main_01 ul.con li p.title {color:#4a69c8; font-size:18px; font-weight:600; margin-top:15px;}
        .main_01 ul.con li p.text {color:#777; font-size:14px; line-height:1.3; margin-top:5px;}

        .main_01 ul.con a:last-child li p.icon {background-color:#7dc8bd !important;}
        .main_01 ul.con a:last-child li p.title { color:#459084 !important;}

        .main_02 {width:100%; float:left; padding:0 15px 15px;}
        .main_02 ul { padding:15px; border:2px solid #ddd; border-radius:10px; position:relative; min-height:75px;}
        .main_02 ul p.icon {position:absolute; left:10px; top:10px; width:50px; height:50px; padding:10px; border-radius:100%; background-color:#fff; box-shadow:0 0 10px rgba(0,0,0,.1);}
        .main_02 ul p.icon img {width:100%;}
        .main_02 ul p.more {position:absolute; right:15px; top:50%; height:100%; vertical-align:middle; margin-top:-10px;}
        .main_02 ul p.more span {color:#fff; background-color:#ddd; border:1px solid #d5d5d5; border-radius:30px; font-size:13px; padding:0 6px;}
        .main_02 ul li {width:calc(100% - 40px); padding-left:55px; color:#000; font-size:14px;}
        .main_02 ul li span {color: #2b3990; text-decoration: underline; font-weight:600;}


        .main_03 {width:100%; float:left; width:100%; float:left; padding:15px; }
        .main_03 ul {width:100%; float:left;}

        .main_03 ul.main_title { padding:0 0 15px 0;}

        .main_03 ul.con { padding:20px; background-color:#fff; border-radius:20px; position:relative;  box-shadow:0 0 20px rgba(0,0,0,.1);}
        .main_03 ul.con li {width:100%; float:left; border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:15px; min-height:95px; position:relative;}
        .main_03 ul.con li:last-child { padding-bottom:0 !important; margin-bottom:0px !important; border-bottom:none !important; }

        .main_03 ul.con li img {width:75px; border-radius:25px; position:absolute; left:0; top:0;}
        .main_03 ul.con li p.text {width:calc(100% - 50px); padding-left:90px; color:#000;}
        .main_03 ul.con li p.text span {display:block;}
        .main_03 ul.con li p.text span.name {font-size:18px; font-weight:600; }
        .main_03 ul.con li p.text span.sub_text_01 {font-size:13px; display:block;}
        .main_03 ul.con li p.text span.sub_text_02 {font-size:15px; color:#52b0ee; font-weight:600; display:block; margin-top:6px;}
        .main_03 ul.con li p.main_03_btn {position:absolute; right:0px; top:50%; vertical-align:middle; margin-top:-12px;}
        .main_03 ul.con li p.main_03_btn span {color:#fff; background-color:#3a54ab; border-radius:30px; font-size:13px; padding:2px 10px;}

        .main_login {width:100%; float:left; font-size:18px; color:#000; padding:15px 15px 20px; font-weight:600; margin-top: 10px; line-height: 1.6; border-bottom: 15px solid #e9e9e9;}
        .main_login .main_login_info {position:relative;}
        .main_login .main_login_info .mem_info {position:relative; font-size: 18px; color: #000;}
        .main_login .main_login_info .mem_info span {font-weight: 700;}
        .main_login .main_login_info .mem_info i {vertical-align:-1px;}
        .main_login .main_login_info .mem_info_btn {display: inline-block; margin-top: 20px; color: #fff; padding:0px 10px;}
        .main_login .main_login_info .car_btn { background-color:#2b3990; border-radius:50px; margin-right:6px; font-size: 14px; line-height:30px; }
        .main_login .main_login_info .manager_btn { background-color:#000; border-radius:4px; text-align:center; font-size: 16px; line-height:36px; width:calc(50% - 5px); float:left;}
        .main_login .main_login_info .manager_btn:last-child { margin-left:10px;}

        .main_state_wrap {
            display: flex;
            justify-content: flex-start;
            padding: 20px 15px;
            gap: 8px;
        }
        .main_state {
            width: 100%;
            padding: 12px 10px;
            border-radius: 12px;
            border: 2px solid #8259f5;
            text-align: left;
            box-sizing: border-box;
            min-width: 0;
        }
        .main_state .main_state_name {
            font-size: 14px;
            color: #000;
            font-weight: 500;
            text-align: left;
            width: 100%;
        }
        .main_state .main_state_name p {display:block; font-weight:500;}
        /*20250805 eun 메인 상담  건수, 상담사 폰트 크기 15 -> 17 확대 시작*/
        /* 숫자(카운터) 스타일 조정 위치: 크기/두께/색상 */
        .main_state .main_state_name .conuter span{font-size:16px; font-weight:700; color : #8259f5; font-family:'Pretendard', sans-serif;}
        /*20250805 eun 메인 상담  건수, 상담사 폰트 크기 15 -> 17 확대 마감*/
        .main_state .main_state_con {font-size:18px; font-weight:800;}

        .main_state_name.main_state_online {
            display:flex;
            align-items:center;
            justify-content:center;
            gap:4px;
            width:100%;
            flex-wrap:wrap;
        }
        .main_state_name.main_state_online .online_label {
            order:1;
        }
        .main_state_name.main_state_online .conuter {
            order:2;
            justify-content:center;
        }
        .main_state_name.main_state_online .online_label {
            margin:0;
            display:inline-flex;
            align-items:center;
            white-space:nowrap;
        }

        #container_title{
            border-bottom : 0px;
        }

        .counselor_tap_title {width: 100%; float: left; text-align:center; padding: 20px 20px 0; font-size:16px;}
        /*20250724 eun 상단 평균연결시간 띠배너 작업 시작*/
        /* 위에서 아래로 스크롤 인/아웃 애니메이션 */
        @keyframes scrollInOut {
            0%   { transform: translateY(0%); opacity: 1; }
            70%  { transform: translateY(0);    opacity: 1; }
            100% { transform: translateY(100%);opacity: 0; }
        }
        #waiting.animate {
            display: inline-block;
            animation: scrollInOut 1s ease-in-out;
        }


        .conuter{
            display: flex;
            align-items: center;
            gap: 2px;
            justify-content: flex-start;
        }
        .conuter #count{
            display: flex;
            align-items: center;
            justify-content: flex-start;

        }

        /* ================================
        ANDROID WEBVIEW ONLY FIX
        ================================ */
        /* ===== COUNT SLOT FINAL FIX ===== */

        .conuter{
            display:flex !important;
            align-items:center !important;
        }

        #count{
            display:flex !important;
            align-items:center !important;
        }

        .slot-wrap{
            display:flex !important;
            align-items:center !important;
        }

        .slot-digit{
            height:24px !important;
        }

        .slot-track div{
            height:24px !important;
            line-height:24px !important;
        }

        /* 건 */
        .unit-slot{
            display:flex;
            align-items:stretch;
            height:24px;
        }

        .unit-slot span{
            display:flex;
            align-items:center;
            height:100%;
            line-height:normal;
        }

        /* 단위(건/명) 전용 슬롯 */
        .slot-digit.unit{
            width:15px;
        }

    </style>

    <!-- 해당부분  상담사 수가 변경이되면 -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <!--
    <div class="waiting_counselor">
        <?php
        $sql = "select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id)
            where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state in ('IDLE', 'RDVC', 'CONN')";
        $rst = sql_fetch($sql);
        $ct = $rst["ct"];
        ?>
        <p id="waiting">🔥지금 <?=$ct?>명의 상담사 대기 중, 평균연결시간 9초</p>
    </div>
    -->
    <script>
        // 최초 PHP에서 받아온 ct 값을 전역 변수에 저장
        var lastCt = <?=$ct?>;

        // function updateText(ct) {
        //     // avg: 8초 or 9초 랜덤
        //     var avg = Math.random() < 0.5 ? 8 : 9;
        //     var text = `🔥지금 ${ct}명의 상담사 대기 중, 평균연결시간 ${avg}초`;
        //     var $p = $('#waiting');

        //     // 1. 애니메이션 트리거 (위로 사라지게)
        //     $p.removeClass('animate');
        //     void $p[0].offsetWidth; // 리플로우 유도
        //     $p.addClass('animate');

        //     // 2. 애니메이션 끝나면 텍스트 바꾸고 다시 멈춘 상태로
        //     $p.one('animationend', function() {
        //         $p.removeClass('animate');
        //         $p.text(text);
        //         // (원한다면 나타나는 애니메이션도 줄 수 있음)
        //     });
        // }
        // function refreshWaiting() {
        //     $.getJSON('/sub/main_waiting.php')
        //         .done(function(res) {
        //             console.log('AJAX res:', res);
        //             console.log('typeof res:', typeof res);
        //             console.log('res.ct:', res.ct);
        //             console.log('typeof res.ct:', typeof res.ct);

        //             if (res.ct != lastCt) {
        //                 lastCt = res.ct;
        //                 updateText(res.ct);
        //             }
        //         })
        //         .fail(function(jqXHR, status, err) {
        //             console.error('AJAX error:', status, err);
        //         });
        // }

        // // 1) 페이지 로드 직후 한 번, PHP ct로 세팅
        // updateText(lastCt);
        // 2) 5초마다 DB에서 최신 ct 체크 후 변경 시 업데이트
        // setInterval(refreshWaiting, 5000);
    </script>
    <!--        20250723 대기 중 상담사, 평균연결시간 작업 마감-->
    <?

    echo display_banner('메인-비주얼', 'mainbanner.10.skin.php');

    ?>

    <ul class="main_state_wrap" >
        <li class="main_state" >
            <div class="main_state_name main_state_online">
                <p class="online_label"><span style="font-weight:600">총 상담 건</span></p>
                <div class="conuter"><span id="count"></span></div>
            </div>
        </li>

        <li class="main_state" >
            <div class="main_state_name main_state_online">
                <p class="online_label"><span style="font-weight:600;">접속 중 상담사</span></p>
                <div class="conuter"><span id="mcount"></span></div>
            </div>
        </li>
    </ul>

<?
$wcount = get_week_con_num();  // 2,570,919
//$mcount = get_now_conn_con();
$mcount = $ct;
?>
    <script>
        // let wcount = "<?=$wcount?>";
        // let mcount = "<?=$mcount?>";
        // // new RollingNum('mcount',mcount,'slide');
        // // new RollingNum('count',wcount,'slide');
        // function RollingNum(id, number, type) {
        //     var $cntBox = document.getElementById(id);
        //     var $cntNum = number;
        //     var $cntLen = $cntNum.length;
        //     var $numArr=$cntNum.split('');
        //     var delay = 300;
        //     var speed = 50;


        //     // 카운트
        //     for ( var i=0; i<$cntLen; i++){
        //         var bckI = ($cntLen - i*1) -1;
        //         var num = document.createElement('span');
        //         num.classList.add('num', 'idx'+bckI);
        //         num.setAttribute('data-num',$numArr[i]);

        //         $cntBox.append(num);
        //         setNum (num, i);
        //     }
        //     //,처리
        //     if ($cntLen>3) {
        //         for (var i=1; i<=Math.floor($cntLen/3); i++) {
        //             var idx3n = $cntBox.querySelector('.idx'+i*3);
        //             var count_dotEl = document.createElement('span');
        //             count_dotEl.classList.add('count_dot');
        //             idx3n.after(count_dotEl);
        //         }
        //         setTimeout(function(){
        //             var count_dot = $cntBox.querySelectorAll('.count_dot');
        //             count_dot.forEach(el => {
        //                 el.innerText=','
        //             });
        //         },(speed*10) + ($cntLen * delay) + speed);
        //     };

        //     function setNum (el, n){
        //         if (type == 'slide') {
        //             setTimeout(function(){
        //                 var no=0;
        //                 var numHeight = 30;
        //                 // style 추가
        //                 var style = document.createElement('style');
        //                 style.innerHTML=
        //                     ".num, .count_dot {display: inline-block;vertical-align: middle;}\
        //                     .num {overflow: hidden;}\
        //                     .numList {display: inline-block;margin-top:0;text-align: center;transition: all "+(speed/1000)+"s;}"
        //                 document.body.appendChild(style);

        //                 var numbersDiv = document.createElement('span');
        //                 var numbers = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9';
        //                 el.style='height:'+numHeight+'px;line-height:'+numHeight+'px;';
        //                 numbersDiv.classList.add('numList');
        //                 numbersDiv.innerText = numbers;
        //                 el.append(numbersDiv);

        //                 var intervalNo = setInterval(function(){
        //                     no++;
        //                     numbersDiv.style='margin-top:'+(no * numHeight * -1)+'px;';
        //                     if(no == 10) {
        //                         clearInterval(intervalNo);
        //                         numbersDiv.style='margin-top:'+(el.getAttribute('data-num') * numHeight * -1)+'px';
        //                     }
        //                 },speed);
        //             }, delay*i);
        //         }else {
        //             setTimeout(function(){
        //                 var no=0;
        //                 var intervalNo = setInterval(function(){
        //                     el.innerText = no++;
        //                     if(no == 10) {
        //                         clearInterval(intervalNo);
        //                         el.innerText = el.getAttribute('data-num');
        //                     }
        //                 },speed);
        //             }, delay*i);
        //         }
        //     }
        // }
    </script>


    <!-- 최근 상담사 -->
    <!--
    <div class="recent_counselor">
        <div class="top">
            <img src="../../../img/main/heart_icon.png">
            <p><span class="counselor_name"><?php echo $member['mb_id'] ? $member['mb_nick'] : 'OOO'; ?></span>님의 최근 상담사</p>
        </div>
        <?php
        $membid = $member['mb_1'];
        $sql = "select * from platform_consulting where membid = '{$membid}' and (reason= 'DISCONNECT' or reason='END_CHAT') group by csrid order by wr_datetime desc limit 3";
        $result = sql_query($sql);

        $recent_list =[];
        while($row = sql_fetch_array($result)){
            $recent_list[] = $row;
        }
        ?>
        <?php if ((count($recent_list) == 0) or !$member['mb_id'] or $member['mb_level'] == 10) { ?>
            <div class="first_consultation">
                <a href="/bbs/recommend_list.php">
                    <p><span style="font-weight:600;">첫 상담 만족도가 높은 상담사</span>를 추천해드려요!</p>
                    <img src="../../../img/main/right_ar.svg" >
                </a>
            </div>
        <?php } ?>

        <?php if ((count($recent_list) > 0) and $member['mb_id'] and  $member['mb_level'] != 10) { ?>
            <div class="swiper recent_counselor_slide">
                <ul class="swiper-wrapper" id="recent-counselor-list">
                </ul>
            </div>
            <script>
                var swiper = new Swiper(".recent_counselor_slide", {
                    slidesPerView: "auto",
                    spaceBetween: 6,
                });

                function reloadRecentCounselors() {
                    $.ajax({
                        url: '/sub/recent_counselor_ajax.php',
                        type: 'GET',
                        success: function(html) {
                            $('#recent-counselor-list').html(html);
                        }
                    });
                }
                setInterval(reloadRecentCounselors, 30000);
                reloadRecentCounselors();
            </script>
        <?php } ?>
    </div>
     -->


    <!-- 이벤트베너 // 관리자에서 이벤트 가져오면 됩니다. -->
    <!--20250805 eun 중간 배너 클릭 시 쿠폰 다운 화면으로 이동 작업 시작-->
    <div class="main-event">
        <?php
        // if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
        //     echo display_banner('메인-상단띠배너', 'mainbanner.event.skin.php');
        // }else{
        // echo display_banner('이벤트1', 'mainbanner.event.skin.php');
        // }
        // echo display_banner('이벤트1', 'mainbanner.event.skin.php');
        // echo display_banner('메인-상단띠배너', 'mainbanner.event.skin.php');

        ?>
    </div>
    <!--20250805 eun 중간 배너 클릭 시 쿠폰 다운 화면으로 이동 작업 마감-->

    <div class="recommend">
        <div class="top">
            <div class="flex align-items-center justify-content-between">
                <div class="flex align-items-center">
                    <img src="../../../img/main/star_icon.png" style="width:20px; margin-bottom:4px">
                    <p style="font-size: 16px">사주 추천</p>
                </div>
                <a href="/bbs/recommend_list.php">더보기 <img src="../../../img/main/right_g_ar.svg"></a>
            </div>
        </div>

        <div class="swiper recommend-slide" style="padding-left:20px">
            <ul class="swiper-wrapper">
                <?php
                $sql = "SELECT mb_id, mb_nick,mb_4,mb_5, mb_sort,state FROM {$g5['member_table']}
                    WHERE mb_sort >= 1 AND mb_sort <= 20 and state != 'ABSE' ORDER BY IF(state IN ('IDLE', 'CONN'), 0, 1),  FIELD (state, 'IDLE', 'CONN',''), mb_sort ASC, mb_nick ASC;";
                $result = sql_query($sql);
                //echo $sql;
                while ($row = sql_fetch_array($result)) {
                    // 1. mb_id별 wr_id(상담사 대표글) 한 개 추출
                    $wr = sql_fetch("SELECT wr_id, ca_name FROM g5_write_counselor WHERE mb_id = '{$row['mb_id']}' ORDER BY wr_num ASC LIMIT 1");
                    $wr_id = $wr['wr_id'];
                    $ca_name = $wr['ca_name'];
                    $cate_bg = array('타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli');

                    // 2. 썸네일
                    if ($wr_id) {
                        $thumb = get_list_thumbnail('counselor', $wr_id, 116,120, false, true);
                        $thumb_src = $thumb['src'] ? $thumb['src'] : '/img/common/noimage.png';
                    } else {
                        $thumb_src = '/img/common/noimage.png';
                    }

                    // 3. 후기 개수 (함수는 mb_id 또는 wr_id, 실제 wr_1에 mb_id가 저장됨)
                    $review_cnt = get_counselor_afcnt($row['mb_id']);


                    //4. 분야
                    //g5_write_counselor 에 ca_name으로 저장된 거 불러와야 함
                    ?>
                    <li class="swiper-slide">
                        <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$wr_id?>">
                            <div class="proflie">
                                <img width="60" height="60" src="<?= $thumb_src ?>" alt="프로필"></img>

                            </div>
                            <div class="counselor_s_info">
                                <div class="top">
                                    <p>
                                      <?=($row['mb_nick'])?>
                                                  <span class="icon_cate_rec <?= $cate_bg[$ca_name] ?? '' ?>" style="position:relative; top:-2px;"><?=($ca_name)?></span>
                                   </p>
                                </div>
                                <div class="bottom">
                                    <p><span><?= number_format($row['mb_4']) ?>원</span> <p style="margin-left:5px;"><?= ($row['mb_5']) ?>초당</p></p>
                                    <span class="g-line"></span>
                                </div>
                                <div class="bottom">
                                    <p style="font-size: 14px; color: #757e9c; margin-top: 2px; padding-top: 0;">
                                        <i class="xi-star" style="margin-right:2px;"></i>
                                        <?php
                                          $dangol_cnt =  get_dangol_cnt($wr_id);
                                        ?>
                                        <span style="color: #757e9c;"><?= number_format($dangol_cnt) ?></span>
                                    </p>
                                </div>
                            </div>
                        </a>
                    </li>
                <?php } ?>
            </ul>
            <!--<li class="swiper-slide">
                <div class="proflie">
                    <img src="">
                </div>
                <div class="counselor_s_info">
                    <div class="top">
                        <span class="icon_cate saju">사주</span>
                        <p>복숭아생성</p>
                    </div>
                    <div class="bottom">
                        <p><span>1,200원</span> 분당</p>
                        <span class="g-line"></span>
                        <div class="flex align-items-center gap_02">
                            <img src="../../../img/main/ic_star.svg">
                            <p>후기 개수</p>
                        </div>
                    </div>
                </div>
            </li>
            <li class="swiper-slide">
                <div class="proflie">
                    <img src="">
                </div>
                <div class="counselor_s_info">
                    <div class="top">
                        <span class="icon_cate saju">사주</span>
                        <p>복숭아생성</p>
                    </div>
                    <div class="bottom">
                        <p><span>1,200원</span> 분당</p>
                        <span class="g-line"></span>
                        <div class="flex align-items-center gap_02">
                            <img src="../../../img/main/ic_star.svg">
                            <p>4.8</p>
                        </div>
                    </div>
                </div>
            </li>-->
        </div>
        <script>
            var swiper = new Swiper(".recommend-slide", {
                slidesPerView: "auto",
                spaceBetween: 10,
            });
        </script>
    </div>



    <div class="page_tap sub_section_100">
        <!--<input type="radio" name="tabmenu" id="tab01" checked>-->
        <input type="radio" name="tabmenu" id="tab02" value="rising">
        <input type="radio" name="tabmenu" id="tab03" value="sco" >
        <input type="radio" name="tabmenu" id="tab04" value="rdvc">
        <input type="radio" name="tabmenu" id="tab05" value="all" checked>
        <input type="radio" name="tabmenu" id="tab06" value="rev">

        <!-- 전체 인기 사주 타로  -->

        <div class="btn_wrap counselor_list_btn" style="background-color: #f8f8f8;">
            <!-- <span class="hot_new">HOT</span> -->
            <!-- <span class="hot_new">NEW</span> -->
            <label for="tab05" style="font-size: 16px;">전체</label>
            <label for="tab02" style="font-size: 16px;">인기</label>
            <!-- <label for="tab03" style="font-size: 16px;">스카웃</label> -->
            <label for="tab04" style="font-size: 16px;">채팅</label>
            <label for="tab06" style="font-size: 16px;">후기</label>
        </div>

        <input type="hidden" id="sca" value=""/>
        <!-- 260219 2단 탭 추가 -->
        <div id="scaTab">
            <!-- <input type="radio" value=""    name="tabmenu_2dep" id="tab_2dep01" class="tabmenu_2dep_rd" checked> -->
            <input type="radio" value="타로" name="tabmenu_2dep" id="tab_2dep02" class="tabmenu_2dep_rd" checked>
            <input type="radio" value="신점" name="tabmenu_2dep" id="tab_2dep03" class="tabmenu_2dep_rd">
            <input type="radio" value="사주" name="tabmenu_2dep" id="tab_2dep04" class="tabmenu_2dep_rd">
            <div class="btn_wrap counselor_list_btn list_2dep" style="border:0px;">
                <!-- <label for="tab_2dep01" style="font-size: 16px;">전체</label> -->
                <label for="tab_2dep02" style="font-size: 16px;">타로</label>
                <label for="tab_2dep04" style="font-size: 16px;">사주</label>
                <label for="tab_2dep03" style="font-size: 16px;">신점</label>

            </div>
        </div>

        <div class="indicator" style="display:none; align-items: center; justify-content: center;">
            <i class="xi-spinner-3 xi-spin"></i>
        </div>


        <div class="conbox con1" id="mtab1" style=" display:none;">
            <?php
            $sql = "select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state='CONN'";
            $rst = sql_fetch($sql);
            $ct = $rst["ct"];
            ?>
            <div class="counselor_tap_title">현재 <span class="orange" style="font-weight:700;"><?=$ct?>명</span>이 상담 진행 중입니다.</div>

            <div class="latest_wr">
                <?php
                $itab = "ing";
                echo latest('theme/counselor_latest', 'counselor',13, 23);		//13명, 최소설치시 자동생성되는 갤러리게시판

                ?>
            </div>
            <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
        </div>

        <!--20250723 eun ajax 요청 api 작업 시작-->
        <!-- 상담중 불러오기 -->
        <!-- <script>
             function rd_main_1(){
                 $.ajax({
                     url: "/sub/main_tab1.php",
                     type:"POST",
                     data:{},
                     timeout: 1000 * 120,
                     contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                     success: function(data) {
                         if(data){
                             $("#mtab1").html(data)
                         }
                     },
                     error: function(e) {
                         //alert(JSON.stringify(e));
                     },
                     timeout: 5000
                 });
             }

             setInterval(function(){
                 rd_main_1();
             }, 2000)
         </script>-->
        <!--20250723 eun ajax 요청 api 작업 종료-->


        <!-- 급상승 tab2 -->
        <div class="conbox con2">
            <!-- <div class="counselor_tap_title" >3일간 상담시간 <span class="orange" style="font-weight:700;">TOP 5</span></div> -->
            <div class="latest_wr" id="tab2-list-area">
                <!-- 사진 최신글2 { -->
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                $itab = "rising";
                //echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
                include_once('./main_tab2.php');
                ?>
                <!-- } 사진 최신글2 끝 -->
            </div>
            <div class="counselor_more"><a href="/bbs/rising_counselor_list.php"><span>급상승 상담사 전체보기</span></a></div>
        </div>
        <script>


            $(document).on('change', 'input[name="tabmenu_2dep"]', function() {
                    let sca = $(this).val();
                    $("#sca").val(sca);

                    // 현재 활성화된 1단 탭 찾기
                    let activeTab = $('input[name="tabmenu"]:checked').val();
                    console.log('활성화된 탭:', activeTab, '2단 탭 sca:', sca);
                    // 활성화된 탭에 따라 해당 탭만 갱신
                    if (activeTab === 'rising') {
                        pollStatesAndUpdate("tab2-list-area", "/sub/main_tab2.php", {'act': 'rising', 'sca': sca}, false);
                    } else if (activeTab === 'sco') {
                        pollStatesAndUpdate("tab3-list-area", "/sub/main_tab3.php", {'act': 'sco', 'sca': sca}, false);
                    } else if (activeTab === 'rdvc') {
                        pollStatesAndUpdate("tab4-list-area", "/sub/main_tab4.php", {'act': 'rdvc', 'sca': sca}, false);
                    } else if (activeTab === 'all') {
                        pollStatesAndUpdate("tab5-list-area", "/sub/main_tab5.php", {'act': 'all', 'sca': sca}, false);
                    }
            });

            $(document).on('change', 'input[name="tabmenu"]', function() {
                    let itab = $(this).val();
                    if(itab == "rev"){
                        $("#scaTab").hide();
                    }else{
                        $("#scaTab").show();
                    }
            });


            let prevStatesTab2;

            function pollStatesAndUpdate(areaId, url, postData, showIndicator = true) {
                $.post(url, postData, function (html) {
                    let tempDiv = $("<div>").html(html);
                    let newStates = [];
                    let hasUndefined = false;

                    tempDiv.find(".counselor_list_item").each(function() {
                        let mb_id = $(this).data("mb_id");
                        let state = $(this).data("state");
                        if (mb_id === undefined || state === undefined || mb_id === "" || state === "") {
                            hasUndefined = true;
                        }
                        newStates.push({mb_id, state});
                    });

                    // 이전 상태가 undefined라면 indicator 없이 갱신(최초 1회)
                    if (typeof prevStatesTab2 === "undefined") {
                        prevStatesTab2 = newStates;
                        $("#" + areaId).html(html); // indicator 없이 바로 목록만
                        return;
                    }

                    // 이후에는 상태가 바뀐 경우에만 indicator
                    if (JSON.stringify(prevStatesTab2) !== JSON.stringify(newStates)) {
                        prevStatesTab2 = newStates;

                        if (!hasUndefined && showIndicator) {
                            $("#" + areaId).html(
                                `<div class="indicator" style="display: flex; align-items: center; justify-content: center;height: 100px; width: 100%;">
                                    <i class="xi-spinner-3 xi-spin" style="font-size: 54px; color: #999;"></i>
                                </div>`
                            );
                            setTimeout(function(){
                                $("#" + areaId).html(html);
                            }, 1000);
                        } else {
                            $("#" + areaId).html(html);
                        }
                    }
                });
            }


            var sca = $("#sca").val();
            // 자동 polling(주기적 업데이트)에서는 showIndicator를 false로 해도 됩니다.
            setInterval(function() {
                sca = $("#sca").val();
                pollStatesAndUpdate("tab2-list-area", "/sub/main_tab2.php", {'act': 'rising','sca' : sca}, false);
            }, 15000);

            // 최초 1회(페이지 로딩 시)도 indicator 없이
            pollStatesAndUpdate("tab2-list-area", "/sub/main_tab2.php", {'act': 'rising','sca' : sca}, false);

            // 새로고침 버튼(예시) - indicator O
            $("#tab5-refresh-btn").on("click", function() {
                pollStatesAndUpdate("tab2-list-area", "/sub/main_tab2.php", {'act': 'rising','sca' : sca}, true);
            });

        </script>
        <!-- 스카웃 tab3-->
        <div class="conbox con3">
            <div class="latest_wr" id="tab3-list-area">
                <!-- 사진 최신글2 { -->
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                $itab = "sco";
                //echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
                include_once('./main_tab3.php');
                ?>
                <!-- } 사진 최신글2 끝 -->
            </div>
            <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
        </div>
        <script>
            let prevStatesTab3;

            function pollStatesAndUpdate(areaId, url, postData, showIndicator = true) {
                $.post(url, postData, function (html) {
                    let tempDiv = $("<div>").html(html);
                    let newStates = [];
                    let hasUndefined = false;

                    tempDiv.find(".counselor_list_item").each(function() {
                        let mb_id = $(this).data("mb_id");
                        let state = $(this).data("state");
                        if (mb_id === undefined || state === undefined || mb_id === "" || state === "") {
                            hasUndefined = true;
                        }
                        newStates.push({mb_id, state});
                    });

                    // 이전 상태가 undefined라면 indicator 없이 갱신(최초 1회)
                    if (typeof prevStatesTab3 === "undefined") {
                        prevStatesTab3 = newStates;
                        $("#" + areaId).html(html); // indicator 없이 바로 목록만
                        return;
                    }

                    // 이후에는 상태가 바뀐 경우에만 indicator
                    if (JSON.stringify(prevStatesTab3) !== JSON.stringify(newStates)) {
                        prevStatesTab3 = newStates;

                        if (!hasUndefined && showIndicator) {
                            $("#" + areaId).html(
                                `<div class="indicator" style="display: flex; align-items: center; justify-content: center;height: 100px; width: 100%;">
                        <i class="xi-spinner-3 xi-spin" style="font-size: 54px; color: #999;"></i>
                    </div>`
                            );
                            setTimeout(function(){
                                $("#" + areaId).html(html);
                            }, 1000);
                        } else {
                            $("#" + areaId).html(html);
                        }
                    }
                });
            }

            var sca = $("#sca").val();

            // 자동 polling(주기적 업데이트)에서는 showIndicator를 false로 해도 됩니다.
            setInterval(function() {
                sca = $("#sca").val();
                pollStatesAndUpdate("tab3-list-area", "/sub/main_tab3.php", {'act': 'sco','sca':sca}, false);
            }, 15000);

            // 최초 1회(페이지 로딩 시)도 indicator 없이
            pollStatesAndUpdate("tab3-list-area", "/sub/main_tab3.php", {'act': 'sco','sca':sca}, false);

            // 새로고침 버튼(예시) - indicator O
            $("#tab5-refresh-btn").on("click", function() {
                pollStatesAndUpdate("tab3-list-area", "/sub/main_tab3.php", {'act': 'sco','sca':sca}, true);
            });
        </script>
        <!-- 채팅 tab4 : 채팅을 활성화한 상담사 리스트가 분야별 상관없이 보여짐-->
        <div class="conbox con4">
            <div class="latest_wr" id="tab4-list-area">
                <!-- 사진 최신글2 { -->
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                //$itab = "idle";
                $itab = "rdvc";
                //echo latest('theme/counselor_latest', 'counselor', 7, 23);		// 최소설치시 자동생성되는 갤러리게시판
                include_once('./main_tab4.php');
                ?>
                <!-- } 사진 최신글2 끝 -->
            </div>
            <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
        </div>
        <script>
            let prevStatesTab4;

            function pollStatesAndUpdate(areaId, url, postData, showIndicator = true) {
                $.post(url, postData, function (html) {
                    let tempDiv = $("<div>").html(html);
                    let newStates = [];
                    let hasUndefined = false;

                    tempDiv.find(".counselor_list_item").each(function() {
                        let mb_id = $(this).data("mb_id");
                        let state = $(this).data("state");
                        if (mb_id === undefined || state === undefined || mb_id === "" || state === "") {
                            hasUndefined = true;
                        }
                        newStates.push({mb_id, state});
                    });

                    // 이전 상태가 undefined라면 indicator 없이 갱신(최초 1회)
                    if (typeof prevStatesTab4 === "undefined") {
                        prevStatesTab4 = newStates;
                        $("#" + areaId).html(html); // indicator 없이 바로 목록만
                        return;
                    }

                    // 이후에는 상태가 바뀐 경우에만 indicator
                    if (JSON.stringify(prevStatesTab4) !== JSON.stringify(newStates)) {
                        prevStatesTab4 = newStates;

                        if (!hasUndefined && showIndicator) {
                            $("#" + areaId).html(
                                `<div class="indicator" style="display: flex; align-items: center; justify-content: center;height: 100px; width: 100%;">
                        <i class="xi-spinner-3 xi-spin" style="font-size: 54px; color: #999;"></i>
                    </div>`
                            );
                            setTimeout(function(){
                                $("#" + areaId).html(html);
                            }, 1000);
                        } else {
                            $("#" + areaId).html(html);
                        }
                    }
                });
            }

            var sca = $("#sca").val();
            // 자동 polling(주기적 업데이트)에서는 showIndicator를 false로 해도 됩니다.
            setInterval(function() {
                sca = $("#sca").val();
                pollStatesAndUpdate("tab4-list-area", "/sub/main_tab4.php", {'act': 'rdvc','sca':sca}, false);
            }, 15000);

            // 최초 1회(페이지 로딩 시)도 indicator 없이
            pollStatesAndUpdate("tab4-list-area", "/sub/main_tab4.php", {'act': 'rdvc','sca':sca}, false);

            // 새로고침 버튼(예시) - indicator O
            $("#tab4-refresh-btn").on("click", function() {
                pollStatesAndUpdate("tab4-list-area", "/sub/main_tab4.php", {'act': 'rdvc','sca':sca}, true);
            });

        </script>
        <!-- 전체 tab5 -->
        <div class="conbox con5">
            <div class="latest_wr"  id="tab5-list-area">
                <!-- 사진 최신글2 { -->
                <?php
                // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
                // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
                // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
                $itab = "all";
                echo latest('theme/counselor_latest', 'counselor', 13, 23);		//13명 최소설치시 자동생성되는 갤러리게시판
                ?>
                <!-- } 사진 최신글2 끝 -->
            </div>
            <div class="counselor_more"><a href="/bbs/board.php?bo_table=counselor"><span>상담사 전체보기</span></a></div>
        </div>
        <script>
            let prevStatesTab5; // 선언만 하고 undefined로 시작!

            function pollStatesAndUpdate(areaId, url, postData, showIndicator = true) {
                $.post(url, postData, function (html) {
                    let tempDiv = $("<div>").html(html);
                    let newStates = [];
                    let hasUndefined = false;

                    tempDiv.find(".counselor_list_item").each(function() {
                        let mb_id = $(this).data("mb_id");
                        let state = $(this).data("state");
                        if (mb_id === undefined || state === undefined || mb_id === "" || state === "") {
                            hasUndefined = true;
                        }
                        newStates.push({mb_id, state});
                    });

                    // 이전 상태가 undefined라면 indicator 없이 갱신(최초 1회)
                    if (typeof prevStatesTab5 === "undefined") {
                        prevStatesTab5 = newStates;
                        $("#" + areaId).html(html); // indicator 없이 바로 목록만
                        return;
                    }

                    // 이후에는 상태가 바뀐 경우에만 indicator
                    if (JSON.stringify(prevStatesTab5) !== JSON.stringify(newStates)) {
                        prevStatesTab5 = newStates;

                        if (!hasUndefined && showIndicator) {
                            $("#" + areaId).html(
                                `<div class="indicator" style="display: flex; align-items: center; justify-content: center;height: 100px; width: 100%;">
                        <i class="xi-spinner-3 xi-spin" style="font-size: 54px; color: #999;"></i>
                    </div>`
                            );
                            setTimeout(function(){
                                $("#" + areaId).html(html);
                            }, 1000);
                        } else {
                            $("#" + areaId).html(html);
                        }
                    }
                });
            }

            var sca = $("#sca").val();
            // 자동 polling(주기적 업데이트)에서는 showIndicator를 false로 해도 됩니다.
            setInterval(function() {
                sca = $("#sca").val();
                pollStatesAndUpdate("tab5-list-area", "/sub/main_tab5.php", {'act': 'all','sca':sca}, false);
            }, 15000);

            // 최초 1회(페이지 로딩 시)도 indicator 없이
            pollStatesAndUpdate("tab5-list-area", "/sub/main_tab5.php", {'act': 'all','sca':sca}, false);

            // 새로고침 버튼(예시) - indicator O
            $("#tab5-refresh-btn").on("click", function() {
                pollStatesAndUpdate("tab5-list-area", "/sub/main_tab5.php", {'act': 'all','sca':sca}, true);
            });
        </script>
        <!-- 후기 06-->
        <div class="conbox con6">
            <?php
            // 후기 13개만 최신순으로 가져옴
            $sql = "SELECT * FROM g5_write_review WHERE wr_is_comment = 0 ORDER BY wr_datetime DESC LIMIT 13";
            $result = sql_query($sql);

            if (!function_exists('sql_escape_string')) {
                function sql_escape_string($s){ return addslashes($s); }
            }

            $review_cnt = 0;
            while ($row = sql_fetch_array($result)) {

                /* =========================
                   1) 상담 유형 판별
                   ========================= */
                $consult_type = '상담'; // 기본
                $guess_csrid  = '';     // wr_1 비었을 때 보강용

                // 1-1) wr_10 직접 매핑
                if (!empty($row['wr_10'])) {
                    $no = sql_escape_string($row['wr_10']);
                    $c  = sql_fetch("SELECT roomid, reason, csrid FROM platform_consulting WHERE no = '{$no}'");
                    if ($c) {
                        if (!empty($c['roomid']) || $c['reason'] === 'END_CHAT') $consult_type = '(채팅)상담';
                        else $consult_type = '(전화)상담';
                        $guess_csrid = $c['csrid'] ?? '';
                    }
                }

                // 1-2) wr_10 없으면 추정 매칭 (리뷰일 ±1일, 종료 레코드 위주)
                if ($consult_type === '상담') {
                    $writer_mb      = get_member($row['mb_id']);          // 리뷰 작성자
                    $writer_membid  = $writer_mb['mb_1'] ?? '';
                    $counselor_mb   = get_member($row['wr_1']);           // wr_1: 상담사 g5 회원아이디(없을 수 있음)
                    $counselor_csrid= $counselor_mb['mb_1'] ?? '';
                    $review_dt      = $row['wr_datetime'];

                    if ($writer_membid) {
                        $where = [];
                        $where[] = "membid = '".sql_escape_string($writer_membid)."'";
                        if ($counselor_csrid) $where[] = "csrid = '".sql_escape_string($counselor_csrid)."'";
                        $where[] = "start BETWEEN DATE_SUB('{$review_dt}', INTERVAL 1 DAY)
                              AND   DATE_ADD('{$review_dt}', INTERVAL 1 DAY)";
                        $where[] = "reason IN ('DISCONNECT','END_CHAT')";

                        $sql_guess = "
                            SELECT roomid, reason, start, csrid
                            FROM platform_consulting
                            WHERE ".implode(' AND ', $where)."
                            ORDER BY ABS(TIMESTAMPDIFF(SECOND, start, '{$review_dt}')) ASC
                            LIMIT 1
                        ";
                        $g = sql_fetch($sql_guess);
                        if ($g) {
                            if (!empty($g['roomid']) || $g['reason'] === 'END_CHAT') $consult_type = '(채팅)상담';
                            else $consult_type = '(전화)상담';
                            $guess_csrid = $g['csrid'] ?? '';
                        }
                    }
                }

                // 1-3) 뱃지 텍스트/클래스
                $consult_badge = '상담';
                $badge_class   = 'badge';
                if ($consult_type === '(채팅)상담') { $consult_badge = '채팅상담'; $badge_class .= ' chat'; }
                elseif ($consult_type === '(전화)상담') { $consult_badge = '전화상담'; $badge_class .= ' call'; }
                else{$consult_badge = '전화상담'; $badge_class .= ' call'; }

                /* =========================
                   2) 상담사/프로필/카테고리
                   ========================= */
                $wmb = get_member($row['mb_id']);       // 글쓴이(회원)
                $mb  = get_member($row['wr_1']);        // 상담사 회원 (없을 수 있음)

                // wr_1 비어있으면 csrid 역추적으로 상담사 회원 찾기
                if ((!$mb || empty($mb['mb_id'])) && !empty($guess_csrid)) {
                    $esc_csrid = sql_escape_string($guess_csrid);
                    $mb = sql_fetch("SELECT * FROM {$g5['member_table']} WHERE mb_1 = '{$esc_csrid}' LIMIT 1");
                }

                // 상담사 대표글/카테고리
                $crow = ['wr_id'=>null,'ca_name'=>''];
                if ($mb && !empty($mb['mb_id'])) {
                    $sql2 = "SELECT wr_id, ca_name FROM g5_write_counselor WHERE mb_id = '".$mb["mb_id"]."' ORDER BY wr_num ASC LIMIT 1";
                    $crow = sql_fetch($sql2);
                }

                $ca_name = $crow['ca_name'] ?? '';
                $mb_nick = $mb['mb_nick'] ?? '';

                // 썸네일 (wr_id 없을 때 안전가드)
                $img = G5_IMG_URL.'/no_img.png';
                if (!empty($crow['wr_id'])) {
                    $thumb1 = get_list_thumbnail('counselor', $crow['wr_id'], 48, 48, false, true);
                    if (!empty($thumb1['src'])) $img = $thumb1['src'];
                }

                /* =========================
                   3) 비밀글/작성자 마스킹/상담시간
                   ========================= */
                $is_secret = ($row['wr_option'] && strstr($row['wr_option'], 'secret'));
                $is_mine   = ($member['mb_id'] == $row['mb_id']) || $is_admin || ($row['wr_1'] == $member['mb_id']);

                // 신고/차단
                ob_start();
                include(G5_PATH.'/include/singo_wrap.php');
                $singo_html = ob_get_clean();

                // 작성자명 마스킹
                $masked_name = preg_replace("/(^.)./u", "$1*", $row['wr_name']);

                // 상담시간 표기
                $consult_info = '00시12분28초';
                if (!empty($row['wr_10'])) {
                    $no = sql_escape_string($row['wr_10']);
                    $sa_info = sql_fetch("SELECT usetm FROM platform_consulting WHERE no = '{$no}'");
                    if ($sa_info && (int)$sa_info['usetm'] > 0) {
                        $consult_info = gmdate('H시i분s초', (int)$sa_info['usetm']);
                    } elseif (!empty($row['wr_2'])) {
                        $consult_info = $row['wr_2'];
                    }
                } elseif (!empty($row['wr_2'])) {
                    $consult_info = $row['wr_2'];
                }

                // 상담일자
                $date = substr($row['wr_datetime'],0,10);
                ?>
                <div class="review_wrap">
                    <!-- 상단: 상담사 프로필 -->
                    <ul class="review_user counsel_info">
                        <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                            <li class="review_user_img type_bg <?=$ca_name?>">
                                <p class="review_user_img_item" style="background-image:url('<?=$img?>');"></p>
                            </li>
                        </a>
                        <li class="review_user_score">
                            <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                                <p class="review_user_id">
                                    <span class="cate point" style="border-bottom: none;"><?=$ca_name?></span>
                                    <?=$mb_nick?>
                                    <?php
                                    ob_start();
                                    include(G5_PATH.'/include/counselor_num.php');
                                    echo ob_get_clean();
                                    ?>
                                </p>
                            </a>
                            <?=$singo_html?>
                        </li>
                    </ul>

                    <!-- 중간: 작성자/날짜/상담내역 -->
                    <ul class="review_user">
                        <li class="review_user_score">
                            <p class="review_user_id"><?=$masked_name?> <img src="/img/common/icon_mem_ok.png" /></p>
                        </li>
                        <li class="review_user_score">
                            <span class="review_info <?=$badge_class?>"><?=$consult_badge?></span>
                            <span class="review_info"><?=$date?></span>
                            <span class="review_info"><?=$consult_info?></span>
                        </li>
                    </ul>

                    <!-- 하단: 후기내용 -->
                    <ul class="review_con">
                        <li class="review_con_text">
                            <div class="review_text">
                                <ul class="review_title">
                                    <?php if($is_secret) { ?>
                                        <i class="fa fa-lock"></i> 비밀글 입니다.
                                    <?php } else { ?>
                                        <?=htmlspecialchars($row['wr_subject'])?>
                                    <?php } ?>
                                </ul>
                                <ul class="review_txt" style="word-break: initial;">
                                    <?php
                                    if($is_secret && !$is_mine) echo "비밀글 입니다.";
                                    else echo nl2br(strip_tags($row['wr_content']));
                                    ?>
                                </ul>
                            </div>
                        </li>
                    </ul>

                    <!-- 상담주제 -->
                    <ul class="review_con" style="min-height:0;">
                        <li class="review_con_text">
                            <div class="review_text">
                                <ul>
                                    <span class="review_topic">상담주제: <?=$ca_name?></span>
                                </ul>
                            </div>
                        </li>
                    </ul>
                </div>
                <?php
                $review_cnt++;
            } // while

            if ($review_cnt == 0) echo '<div class="empty_table">작성된 후기가 없습니다.</div>';
            ?>

            <div class="review_wrap">
                <!-- 상단: 상담사 프로필 -->
                <ul class="review_user counsel_info">
                    <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                        <li class="review_user_img type_bg <?=$ca_name?>">
                            <p class="review_user_img_item" style="background-image:url('<?=$img?>');"></p>
                        </li>
                    </a>
                    <li class="review_user_score">
                        <a href="/bbs/board.php?bo_table=counselor&wr_id=<?=$crow["wr_id"]?>">
                            <p class="review_user_id">
                                <span class="cate point" style="border-bottom: none;"><?=$ca_name?></span>
                                <?=$mb_nick?>
                                <?=$counselor_num?>
                            </p>
                        </a>
                        <?=$singo_html?>
                    </li>
                </ul>
                <!-- 중간: 작성자/날짜/상담내역 -->
                <ul class="review_user">
                    <li class="review_user_score">
                        <p class="review_user_id"><?=$masked_name?> <img src="/img/common/icon_mem_ok.png" /></p>
                    </li>
                    <li class="review_user_score">
                        <span class="review_info <?=$badge_class?>"><?=$consult_badge?></span>
                        <span class="review_info"><?=$date?></span>
                        <span class="review_info"><?=$consult_info?></span>
                    </li>
                </ul>

                <!-- 하단: 후기내용 -->
                <ul class="review_con">
                    <li class="review_con_text">
                        <div class="review_text">
                            <ul class="review_title">
                                <? if($is_secret) { ?>
                                    <i class="fa fa-lock"></i> 비밀글 입니다.
                                <? } else { ?>
                                    <?=htmlspecialchars($row['wr_subject'])?>
                                <? } ?>
                            </ul>
                            <ul class="review_txt" style="word-break: initial;">
                                <?
                                if($is_secret && !$is_mine) {
                                    echo "비밀글 입니다.";
                                } else {
                                    echo nl2br(strip_tags($row['wr_content']));
                                }
                                ?>
                            </ul>
                        </div>
                    </li>
                </ul>
                <!-- 상담주제 -->
                <ul class="review_con" style="min-height:0;">
                    <li class="review_con_text">
                        <div class="review_text">
                            <ul>
                                <span class="review_topic">상담주제: <?=$ca_name?></span>
                            </ul>
                        </div>
                    </li>
                </ul>
            </div>

            <div class="counselor_more" style="margin-top: 20px;">
                <a href="/bbs/board.php?bo_table=review"><span>후기 전체보기</span></a>
            </div>
        </div>
    </div>


    <div style="position:relative; width:100%; float:left; ">
        <?php echo display_banner('메인-중앙배너', 'mainbanner.20.skin.php'); ?>
    </div>
    <!---->
<?php ////if($is_member){ ?>
    <!---->
    <!--<div class="counselor_list_wrap" >-->
    <!--        	-->
    <!-- <h2 style=" width:100%; float:left; font-size:20px; font-weight:600; padding:20px 20px 0;">-->
    <!---->
    <!--	<div class="counselor_list bo_none" >-->
    <!--       --><?php
//	    // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
//	    // 사용방법 : latest(스킨, 게시판아이디, 출력라인, 글자수);
//	    // 테마의 스킨을 사용하려면 theme/basic 과 같이 지정
//		$itab="ai";
//	    echo latest('theme/counselor_latest_02', 'counselor', 2, 23);		// 최소설치시 자동생성되는 갤러리게시판
//	    ?>
    <!--    </div>-->
    <!--            -->
    <!--</div>            -->
    <!---->
<?php //} ?>

    <link href="https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.css" rel="stylesheet" type="text/css"/>

    <div class="main_footer">
        <div class="main_footer_manu">
            <!--
            <p class="sns">
                <a href="https://instagram.com/the.saju" target="_blank">
                    <span><img src="../img/tail/sns_instagram.png" alt="인스타그램" /></span>
                </a>

                <a href="http://pf.kakao.com/_gLTVX" target="_blank">
                    <span><img src="../img/tail/sns_kakao.png" alt="카카오톡" /></span>
                </a>

                <a href="https://m.blog.naver.com/fbtjrwns2" target="_blank">
                    <span><img src="../img/tail/sns_blog.png" alt="블로그" /></span>
                </a>

                <a href="https://youtube.com/@TheSaju" target="_blank">
                    <span><img src="../img/tail/sns_youtube.png" alt="유튜브" /></span>
                </a>

                <a href="https://www.tiktok.com/@thesaju" target="_blank">
                    <span><img src="../img/tail/sns_tiktok.png" alt="틱톡" /></span>
                </a>
            </p>
            -->

            <a href="../etc/provision.php"><span class="policy">이용약관</span></a>
            <span class="dot">·</span>
            <a href="../etc/privacy.php"><span class="point">개인정보취급방침</span></a>
        </div>
        <details class="company company_more" open="open">
            <summary class="company_title">
                <span>사업자정보</span>
            </summary>
            <div class="company_info" style="line-height:1.8; font-size:12px; color:#888; word-break:break-all;">
                <span style="font-size:13px; font-weight:700; color:#555;">대표자</span> <?php echo $default ['de_admin_company_owner'] ?> <span style="font-size:13px; font-weight:700; color:#555;">주소</span> <?php echo $default ['de_admin_company_addr'] ?><br />
                <span style="font-size:13px; font-weight:700; color:#555;">사업자등록번호</span> <?php echo $default ['de_admin_company_saupja_no'] ?> 
                <!-- <span style="font-size:13px; font-weight:700; color:#555;">통신판매자신고번호</span> <?php echo $default ['de_admin_tongsin_no'] ?> -->
                <br />
                <span style="font-size:13px; font-weight:700; color:#555;">대표전화</span> <?php echo $default ['de_admin_company_tel'] ?> <span style="font-size:13px; font-weight:700; color:#555;">이메일</span> <?php echo $default ['de_admin_info_email'] ?><br />
                <span style="font-size:13px; font-weight:700; color:#555;">제휴 및 상담사 채용 문의</span> <?php echo $default ['de_admin_info_email'] ?>
            </div>
        </details>

        <div class="main_footer_copy">Copyrightⓒ 사주플랜. All Rights Reserved.</div>
    </div>

    <!-- <details class="company company_more" open="open">
            <summary class="company_title">
                <span>사업자정보</span>
            </summary>
            <div class="company_info">
                <span>대표자</span> <?php echo $default ['de_admin_company_owner'] ?><br />
                <span>주소</span> <?php echo $default ['de_admin_company_addr'] ?><br />
                <span>사업자등록번호</span> <?php echo $default ['de_admin_company_saupja_no'] ?><br />
                <span>통신판매자신고번호</span> <?php echo $default ['de_admin_tongsin_no'] ?><br />
                <span>대표전화</span> <?php echo $default ['de_admin_company_tel'] ?><br />
                <span>이메일</span> <?php echo $default ['de_admin_info_email'] ?><br />
                <span>제휴 및 상담사 채용 문의</span> <?php echo $default ['de_admin_info_email'] ?><br />
            </div>
        </details> -->

<!-- 메인화면 최신글 시작
<?php
    //  최신글
    $sql = " select bo_table
            from `{$g5['board_table']}` a left join `{$g5['group_table']}` b on (a.gr_id=b.gr_id)
            where a.bo_device <> 'pc' ";
    if(!$is_admin) {
        $sql .= " and a.bo_use_cert = '' ";
    }
    $sql .= " order by b.gr_order, a.bo_order ";
    $result = sql_query($sql);
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        // 이 함수가 바로 최신글을 추출하는 역할을 합니다.
        // 스킨은 입력하지 않을 경우 관리자 > 환경설정의 최신글 스킨경로를 기본 스킨으로 합니다.

        // 사용방법
        // latest(스킨, 게시판아이디, 출력라인, 글자수);
        //echo latest('theme/basic', $row['bo_table'], 12, 25);
    }
    ?>
    메인화면 최신글 끝 -->

        <!-- 메뉴 링크 -->
        <!-- <div class="con_section sub_section_100 main_navi" >
            <ul class="main_navi_item" >
                <a href="../bbs/board.php?bo_table=counselor&sca=타로">
                <img src="../../../img/main/main_menu_01.png" alt="타로" />
                <p class="main_navi_name" >타로</p>
                </a>
            </ul>
            <ul class="main_navi_item" >
                <a href="../bbs/board.php?bo_table=counselor&sca=신점">
                <img src="../../../img/main/main_menu_02.png" alt="신점" />
                <p class="main_navi_name" >신점</p>
                </a>
            </ul>
            <ul class="main_navi_item" >
                <a href="../bbs/board.php?bo_table=counselor&sca=사주">
                <img src="../../../img/main/main_menu_03.png" alt="사주" />
                <p class="main_navi_name" >사주</p>
                </a>
            </ul>
            <ul class="main_navi_item" >
                <a href="../bbs/board.php?bo_table=counselor&sca=심리">
                <img src="../../../img/main/main_menu_04.png" alt="심리" />
                <p class="main_navi_name" >심리</p>
                </a>
            </ul>
            <ul class="main_navi_item" >
                <a href="../bbs/board.php?bo_table=review">
                <img src="../../../img/main/main_menu_05.png" alt="후기" />
                <p class="main_navi_name" >후기</p>
                </a>
            </ul>
        </div>
     -->
<style>
/* ===== SLOT NUMBER BASE ===== */
.slot-wrap{
    display:flex;
    align-items:center;
    justify-content:center;
}

.slot-digit{
    position:relative;
    width:10px;
    height:24px;
    overflow:hidden;
}


.slot-track{
    position:absolute;
    top:0;
    left:0;
    width:100%;
    transform:translateY(0);
}

/* 슬롯 숫자 글자체/크기/색상 조정 위치 */
.slot-track div{
    height:24px;
    line-height:24px;
    text-align:center;
    font-size:14px;
    font-weight:700;
    color:#8259f5;
    font-family:'Pretendard', sans-serif !important;
}

/* 콤마 */
.slot-comma{
    font-size:14px;
    margin:0 1px;
    font-family:'Pretendard', sans-serif !important;
}

/* ANDROID WEBVIEW FIX */
body.android-webview .slot-digit,
body.android-webview .slot-track div{
    height:24px;
    line-height:24px;
}

/* 360px 이하 소형 모바일 대응 */
@media screen and (max-width:360px){
    .main_state_wrap { padding:15px 10px; gap:6px; }
    .main_state { padding:10px 8px; }
    .main_state .main_state_name { font-size:12px; }
    .main_state_name.main_state_online { gap:2px; }
    .slot-digit { width:9px; height:20px; }
    .slot-track div { height:20px; line-height:20px; font-size:12px; }
    .slot-comma { font-size:12px; }
    .main_state .main_state_name .conuter span { font-size:14px; }
}
</style>

<script>
/* ===================================
   ANDROID WEBVIEW DETECT
=================================== */
(function(){
    const ua = navigator.userAgent.toLowerCase();
    if(window.ReactNativeWebView || ua.indexOf("wv")>-1){
        document.body.classList.add("android-webview");
    }
})();

/* ===================================
   SLOT MACHINE COUNTER
=================================== */
function createSlotNumber(elId, number, unitText){
    const el = document.getElementById(elId);
    el.innerHTML = '';
    el.classList.add("slot-wrap");

    number = number.toString();

    // =====================
    // 숫자 슬롯 생성
    // =====================
    for(let ch of number){

        // 콤마
        if(ch === ","){
            const comma = document.createElement("span");
            comma.className = "slot-comma";
            comma.innerText = ",";
            el.appendChild(comma);
            continue;
        }

        const digitBox = document.createElement("div");
        digitBox.className = "slot-digit";

        const track = document.createElement("div");
        track.className = "slot-track";

        // 0~9 두 바퀴
        for(let i=0;i<20;i++){
            const d = document.createElement("div");
            d.innerText = i % 10;
            track.appendChild(d);
        }

        digitBox.appendChild(track);
        el.appendChild(digitBox);

        if(!isNaN(ch)){
            animateDigit(track, parseInt(ch));
        }
    }

    // =====================
    // 단위 슬롯 (안 도는 슬롯)
    // =====================
    if(unitText){
        const unitBox = document.createElement("div");
        unitBox.className = "slot-digit unit";

        const unitTrack = document.createElement("div");
        unitTrack.className = "slot-track";

        const d = document.createElement("div");
        d.innerText = unitText;

        unitTrack.appendChild(d);
        unitBox.appendChild(unitTrack);
        el.appendChild(unitBox);
    }
}
/* 각 자리 애니메이션 */
function animateDigit(track, target){
    const digitHeight = 24;
    const totalRounds = 10 + target;
    const targetY = -(totalRounds * digitHeight);

    let start = null;
    const duration = 3500;

    function easeOut(t){
        return 1 - Math.pow(1-t,3);
    }

    function step(ts){
        if(!start) start = ts;
        const progress = Math.min((ts-start)/duration,1);
        const eased = easeOut(progress);
        const y = targetY * eased;
        track.style.transform = `translateY(${y}px)`;

        if(progress < 1){
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

/* ===================================
   INIT
=================================== */

let rawW = "<?=$wcount?>".replace(/[^0-9]/g, '');
let rawM = "<?=$mcount?>".replace(/[^0-9]/g, '');

let wcount = Number(rawW).toLocaleString();
let mcount = Number(rawM).toLocaleString();

if (document.getElementById('count')) {
    createSlotNumber("count", wcount, "건");
}
if (document.getElementById('mcount')) {
    createSlotNumber("mcount", mcount, "명");
}
$(document).ready(function (){
  set_member_push_update();
});

</script>

<?php

include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>