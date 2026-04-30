<?php

include_once('./_common.php');



// 테마에 mypage.php 있으면 include

if(defined('G5_THEME_SHOP_PATH')) {

    $theme_mypage_file = G5_THEME_MSHOP_PATH.'/mypage.php';

    if(is_file($theme_mypage_file)) {

        include_once($theme_mypage_file);

        return;

        unset($theme_mypage_file);

    }

}



$g5['title'] = '마이페이지';





// 쿠폰

$cp_count = get_shop_member_coupon_count($member['mb_id'], true);

?>

<style>
   .set_div{
      border-bottom: 0px solid #f5f5f5;
   }
</style>

<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>



    <?php include_once(G5_THEME_PATH.'/mobile/head_point.php'); ?>

    <style>

        /*.haed_menu.counselor .home { display:none !important;}*/

    </style>



<? } else { ?>

    <?php include_once(G5_THEME_PATH.'/mobile/head.php'); ?>

<?php } ?>



<!-- 하단 메뉴 HOVER -->

<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_my.css" type="text/css">


<style>

    body { background-color:#f5f5f5;}

    #container { padding:0;}



    .sticky {position: sticky; top: 70px;}

    .con_section.my_state { border-top:1px solid rgba(255,255,255,.2);}



    .my_c_state_wrap {width: 100%; float: left;}

    .my_c_state_wrap .my_c_state_title { font-size: 14px; margin-bottom: 4px; font-weight: 300; text-align: left; color:#fff;}

    .my_c_state_wrap .my_c_state {display:flex; justify-content: space-between; margin-bottom:10px; padding:0;}

    .my_c_state_wrap .my_c_state .c_state { width:calc(50% - 5px); height:45px; border-radius:3px; text-align:center; font-size:16px; font-weight:600;}

    .my_c_state_wrap .my_c_state .c_state i { font-size:20px; vertical-align:-3px;}

    .my_c_state_wrap .my_c_state .c_state.go { background-color:#000; color:#fff;}

    .my_c_state_wrap .my_c_state .c_state.stop { background-color:#d9d9d9; color:#999;}

    .my_c_state_wrap .my_c_state .c_state.on { background-color:#fff; color:#000;}

    .my_c_state_wrap .my_c_state .c_state.on i { color:#000;}

    .my_c_state_wrap .my_c_state .c_state.off {background-color:#d3d3d3; color:#999;}

    .my_c_state_wrap .my_c_state .c_state.off i { color:#999;}



    .my_c_state_wrap .my_c_state_noti { font-size:14px; color:#fff; text-align:left; padding:0px;}

    .my_c_state_wrap .my_c_state_noti .my_c_state_noti_item { line-height:1.4; position:relative; padding-left:10px;}

    .my_c_state_wrap .my_c_state_noti .my_c_state_noti_item:before { content:''; position:absolute; top:8px; left:0; width:2px; height:2px; border-radius:50%; display:inline-block; background-color:#fff;}



    #main_bn { width: 100%; float: left; margin-top:20px;}

</style>
<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

    <style>

        .con_section.c_profile { background-color:#8259f5; color:#fff;}

        .my_profile .my_info .my_name,

        .my_profile .my_info .my_name i,

        .my_profile .my_info .my_name .my_id,

        .my_profile .my_info .my_edit {color:#fff;}



        .my_profile .my_info .my_name i { opacity:.5;}
        .con_section.c_profile.my_state{
            position: relative;
            z-index: 99999;
        }
    </style>

<?php } ?>





<div class="my_wrap ">





    <div class="con_section c_profile">

        <?php if($is_member){ ?>



            <ul class="my_profile">

                <li class="my_img">

                    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

                        <!--

				<?php $mb_icon_url  = G5_DATA_URL.'/member_image/'.substr($member['mb_id'],0,2).'/'.$member['mb_id'].'.gif'; ?>



				<img class="mem_img" src="<?php echo $mb_icon_url ?>" alt="회원아이콘">

                -->

                        <span class="mem_img"><?php echo get_member_profile_img($member['mb_id']); ?></span>

                    <? } else { ?>

                        <img src="../img/common/logo3.png"/>

                    <?php } ?>

                </li>

                <li class="my_info">

                    <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form.php">

                        <ul class="my_name">

                            <?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?> <i class="xi-angle-right-min"></i>

                            <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '비회원'; ?></p>

                        </ul>

                    </a>



                    <p style=" display: flex; align-items: center;">

                        <!--

				<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

                <a href="../bbs/write.php?bo_table=counselor" style="display:inline-block; padding:6px 10px; background-color:#fff; color:#fff; margin-right:10px; color:#000; border-radius:4px; font-weight:600;">프로필 등록</a>

	            <a href="../etc/set.php">

                <?php } ?>

                -->



                        <a href="../etc/set.php">

    	        <span class="my_edit">

        	    	<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?><img src="../img/head/edit_w.png"><? } else { ?><img src="../img/head/edit.png"><?php } ?>

            	    앱설정

	            </span>

                        </a>

                    </p>

                </li>

            </ul>





        <? } else { ?>



            <ul class="my_profile">

                <a href="<?php echo G5_BBS_URL; ?>/login.php">

                    <li class="my_img"><img src="../img/common/logo3.png"/></li>

                </a>

                <li class="my_info">

                    <a href="<?php echo G5_BBS_URL; ?>/login.php">

                        <ul class="my_name">

                            <?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>

                            <p class="my_id"><?php echo $member['mb_id'] ? $member['mb_id'] : '로그인이 필요합니다.'; ?></p>

                        </ul>

                    </a>



                    <!--

                    <a href="../etc/set.php">

                    <span class="my_edit">

                        <img src="../img/head/edit.png">

                        앱설정

                    </span>

                    </a>

                    -->

                    <a href="<?php echo G5_BBS_URL; ?>/login.php">

                        <span class="pink pink_bo" style=" display: inline-block; padding: 6px 20px; border-radius: 50px; margin-left: 10px; position: absolute; top: 50%; right: 0px; font-size: 14px; transform: translateY(-50%); width:auto; border:1px solid #000; color:#000;">로그인</span>

                    </a>



                </li>

            </ul>



        <?php } ?>

    </div>



    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

        <div class="con_section c_profile my_state">



            <div class="my_c_state_wrap">

                <!--<p class="my_c_state_title">상담 상태</p>-->



                <style>
                    /* 상담 상태 라디오 세그먼트 */
                    .con_seg {
                        display: flex;
                        background: rgba(255,255,255,.15);
                        border-radius: 10px;
                        padding: 4px;
                        gap: 4px;
                        margin-bottom: 12px;
                    }
                    .con_seg label {
                        flex: 1;
                        text-align: center;
                        padding: 10px 0;
                        border-radius: 7px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        color: rgba(255,255,255,.6);
                        transition: background .2s, color .2s;
                        user-select: none;
                    }
                    .con_seg input[type=radio] { display: none; }
                    .con_seg input#seg_on:checked  ~ label[for=seg_on],
                    .con_seg input#seg_off:checked ~ label[for=seg_off] {
                        background: #fff;
                        color: #ff0000;
                        box-shadow: 0 2px 8px rgba(0,0,0,.15);
                    }

                    .con_seg input#seg_on:checked  ~ label[for=seg_on]{
                        background: #fff;
                        color: #8259f5;
                        box-shadow: 0 2px 8px rgba(0,0,0,.15);
                    }

                    /* 토글 스위치 */
                    .con_toggle_row {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        background: rgba(255,255,255,.12);
                        border-radius: 10px;
                        padding: 12px 16px;
                        margin-bottom: 8px;
                    }
                    .con_toggle_label {
                        font-size: 15px;
                        font-weight: 600;
                        color: #fff;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .con_toggle_label i { font-size: 18px; }
                    .toggle_sw {
                        position: relative;
                        width: 52px;
                        height: 28px;
                        flex-shrink: 0;
                    }
                    .toggle_sw input { display: none; }
                    .toggle_sw .slider {
                        position: absolute;
                        inset: 0;
                        background: rgba(255,255,255,.3);
                        border-radius: 28px;
                        cursor: pointer;
                        transition: background .25s;
                    }
                    .toggle_sw .slider:before {
                        content: '';
                        position: absolute;
                        top: 3px; left: 3px;
                        width: 22px; height: 22px;
                        background: #fff;
                        border-radius: 50%;
                        transition: transform .25s;
                        box-shadow: 0 1px 4px rgba(0,0,0,.2);
                    }
                    .toggle_sw input:checked + .slider { background: #4cd964; }
                    .toggle_sw input:checked + .slider:before { transform: translateX(24px); }
                </style>

                <?
                $st_flag = in_array($member["state"], array('RDVC','RDCH','IDLE'));
                ?>

                <!-- 상담가능 / 상담불가능 라디오 세그먼트 -->
                <div class="con_seg">
                    <input type="radio" id="seg_on"  name="con_seg" <?=$st_flag ? 'checked' : ''?>>
                    <input type="radio" id="seg_off" name="con_seg" <?=!$st_flag ? 'checked' : ''?>>
                    <label for="seg_on"  onclick="chg_con('Y', '<?=$member["mb_id"]?>')">상담 가능</label>
                    <label for="seg_off" onclick="chg_con('N', '<?=$member["mb_id"]?>')">상담 불가능</label>
                </div>

                <!-- 전화 토글 -->
                <div class="con_toggle_row">
                    <span class="con_toggle_label"><i class="xi-call"></i> 전화 상담</span>
                    <label class="toggle_sw">
                        <input type="checkbox" <?=($member["use_phone"]=="Y") ? 'checked' : ''?>
                               onchange="chg_use_phone(this.checked ? 'Y' : 'N', '<?=$member["mb_id"]?>'); return false;">
                        <span class="slider"></span>
                    </label>
                </div>

                <!-- 채팅 토글 -->
                <div class="con_toggle_row">
                    <span class="con_toggle_label"><i class="xi-forum-o"></i> 채팅 상담</span>
                    <label class="toggle_sw">
                        <input type="checkbox" <?=($member["use_chat"]=="Y") ? 'checked' : ''?>
                               onchange="chg_use_chat(this.checked ? 'Y' : 'N', '<?=$member["mb_id"]?>'); return false;">
                        <span class="slider"></span>
                    </label>
                </div>

                <script>

                    /* function chg_con(mode, mb_id){

                         var msg = "";

                         if(mode=="Y"){

                             msg = "상담 설정을 사용으로 변경합니다.";

                         }else{

                             msg = "상담 설정을 사용안함으로 변경합니다.";

                         }

                         var cfm = confirm(msg);



                         if(cfm==true){

                             // $.ajax({
                             //
                             //     url: "/mobile/shop/ajax.chg_use_con.php",
                             //
                             //     type: "POST",
                             //
                             //     data: {
                             //
                             //         "mb_id": mb_id, "mode":mode,
                             //
                             //     },
                             //
                             //     dataType: "html",
                             //
                             //     success: function(data) {
                             //
                             //         window.location.reload();
                             //
                             //     }
                             //
                             // });
                             $.ajax({
                                 url: "/mobile/shop/ajax.chg_use_con.php",
                                 type: "POST",
                                 data: { "mb_id": mb_id, "mode": mode },
                                 dataType: "html",
                                 success: function(data) {
                                     if (window.__dbglog) window.__dbglog('AJAX OK chg_con status=200 len=' + (data ? data.length : 0));

                                     // ✅ 디버그 중에는 새로고침 막기(로그가 안 사라지게)
                                     if (window.__DBG_BLOCK_RELOAD__) return;

                                     // 또는 1.5초 뒤에 새로고침(로그 볼 시간 주기)
                                     setTimeout(function(){ location.reload(); }, 1500);
                                 },
                                 error: function(xhr) {
                                     if (window.__dbglog) window.__dbglog('AJAX FAIL chg_con status=' + xhr.status);
                                 }

                             });


                         }



                     }





                     function chg_use_phone(mode, mb_id){

                         var msg = "";

                         if(mode=="Y"){

                             msg = "전화상담 설정을 사용으로 변경합니다.";

                         }else{

                             msg = "전화상담 설정을 사용안함으로 변경합니다.";

                         }

                         var cfm = confirm(msg);



                         if(cfm==true){

                             $.ajax({

                                 url: "/mobile/shop/ajax.chg_use_phone.php",

                                 type: "POST",

                                 data: {

                                     "mb_id": mb_id, "mode":mode,

                                 },

                                 dataType: "html",

                                 success: function(data) {

                                     window.location.reload();

                                 }

                             });

                         }



                     }



                     function chg_use_chat(mode, mb_id){

                         var msg = "";

                         if(mode=="Y"){

                             msg = "채팅상담 설정을 사용으로 변경합니다.";

                         }else{

                             msg = "채팅상담 설정을 사용안함으로 변경합니다.";

                         }

                         var cfm = confirm(msg);



                         if(cfm==true){

                             $.ajax({

                                 url: "/mobile/shop/ajax.chg_use_chat.php",

                                 type: "POST",

                                 data: {

                                     "mb_id": mb_id, "mode":mode,

                                 },

                                 dataType: "html",

                                 success: function(data) {

                                     window.location.reload();

                                 }

                             });

                         }



                     }*/
                    let __ajaxLock = false;

                    function chg_con(mode, mb_id){
                        if (__ajaxLock) return;
                        __ajaxLock = true;

                        $.ajax({
                            url: "/mobile/shop/ajax.chg_use_con.php",
                            type: "POST",
                            data: { mb_id: mb_id, mode: mode },
                            dataType: "text",
                            complete: function(){
                                __ajaxLock = false;
                            },
                            success: function(){
                                window.location.reload();
                            },
                            error: function(){
                                alert('처리 실패. 다시 시도해주세요.');
                            }
                        });
                    }
                    function chg_use_phone(mode, mb_id){
                        if (__ajaxLock) return;
                        __ajaxLock = true;

                        $.ajax({
                            url: "/mobile/shop/ajax.chg_use_phone.php",
                            type: "POST",
                            data: { mb_id: mb_id, mode: mode },
                            dataType: "text",
                            complete: function(){ __ajaxLock = false; },
                            success: function(){ window.location.reload(); },
                            error: function(){ alert('처리 실패. 다시 시도해주세요.'); }
                        });
                    }

                    function chg_use_chat(mode, mb_id){
                        if (__ajaxLock) return;
                        __ajaxLock = true;

                        $.ajax({
                            url: "/mobile/shop/ajax.chg_use_chat.php",
                            type: "POST",
                            data: { mb_id: mb_id, mode: mode },
                            dataType: "text",
                            complete: function(){ __ajaxLock = false; },
                            success: function(){ window.location.reload(); },
                            error: function(){ alert('처리 실패. 다시 시도해주세요.'); }
                        });
                    }

                </script>

                <!-- 
                <ul class="my_c_state_noti">
                    <li class="my_c_state_noti_item">상담이 들어오면 3분 이내에 응대해 주세요.</li>
                    <li class="my_c_state_noti_item">허위로 상담을 켜두시는 경우 서비스 이용이 제한됩니다.</li>
                </ul> 
                -->

            </div>

        </div>

    <?php } ?>



    <div class="con_section">



        <ul class="level_info">

            <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

                <p class="level_info_title c_info">보유금액</p>

                <!--<li class="my_levelup counselor">-->

                <li class="my_levelup c_info">

                    <p>

                        <span class="point"><?=number_format(get_con_total_account($member["mb_id"]))?></span>원

                    </p>

                    <!--<a href="#" class="point_bg white btn" onclick="account_pay_end('<?=$member["mb_id"]?>');">정산</a>-->

                    <a href="/my/counselor_settlement.php" class="point_bg white btn">정산</a>

                    <script>

                        function account_pay_end(mb_id){

                            var cfm = confirm('전월 보유금액이 정산처리 됩니다.');

                            if(cfm){

                                location.href='/my/account_pay_end.php?mb_id='+mb_id;

                            }

                        }

                    </script>

                </li>







            <? } else { ?>

                <p class="level_info_title">보유포인트</p>

                <li class="my_levelup">

                    <p>

                        <span class="point"><?php echo number_format($member['mb_point']); ?></span>ⓟ

                    </p>

                    <a href="../coin/coin_fill.php" class="point_bg white btn">충전</a>

                </li>

            <?php } ?>







            <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

                <li class="mem_state counselor">

                    <p class="mem_state_title">전월</p>

                    <p class="mem_state_con"><?=number_format(get_con_total_account_befre($member["mb_id"]))?>원</p>

                    <p class="mem_state_title">당월</p>

                    <p class="mem_state_con"><?=number_format(get_con_total_account($member["mb_id"]))?>원</p>

                </li>

            <?php } ?>



        </ul>







        <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

        <? } else { ?>



            <?php

            $today_list = get_today_my_fortune($member["mb_id"]);

            ?>

            <!-- 
            <ul class="mem_state">

                <?

                if(count($today_list)>0){

                ?>

                <a href="../bbs/board.php?bo_table=fortune&wr_id=<?=$today_list["wr_id"]?>">

                    <?

                    }else{

                    ?>

                    <a href="#none;" onclick="mv_notlogin();">

                        <?php

                        }

                        ?>



                        <li class="mem_state_title"><img src="../../img/common/icon_date.png" />오늘의 운세 </li>

                        <?php
                        if(count($today_list)>0){
                            ?>
                            <li class="mem_state_con"><?=$today_list["wr_content"]?></li>
                            <?php
                        }?>
                        <li class="mem_state_more point">상세보기<i class="xi-angle-right"></i></li>
                    </a>
            </ul>
            -->

        <?php } ?>



    </div>

    <?

    $mbirth= $member["mb_birth"];

    $mb_id = $member["mb_id"];

    ?>

    <script>

        function mv_notlogin(){

            var birth = "<?=$mbirth?>";

            var mb = "<?=$mb_id?>";

            if(!mb){

                alert('로그인해주세요!');

                location.href='/bbs/login.php';

            }else if(!birth){

                alert('회원정보를 확인해주세요!');

                location.href='/bbs/register_form.php?w=u';

            }

        }

    </script>



    <div class="con_section con_section_b_bot_02">

        <h3 class="con_title">

            <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

                상담사 전용

            <? } else { ?>

                마이페이지

            <?php } ?>



        </h3>



        <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

            <ul class="set_div">
                <li style="background-image:url(../../img/my/my_menu_07.png);">
                    <a href="/bbs/board.php?bo_table=qa&csrid=<?=$member["mb_id"]?>">1:1문의 관리</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_01.png);">
                    <a href="../my/counselor_history.php">전화상담내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_24.png);">
                    <a href="<?php echo G5_URL; ?>/my/chat_record.php">채팅상담 내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_08.png);">
                    <a href="/bbs/board.php?bo_table=review&csrid=<?=$member["mb_id"]?>">후기관리</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_09.png);">
                    <a href="../my/counselor_settlement.php">정산내역</a>
                </li>
                
                <li style="background-image:url(../../img/my/my_menu_06.png);">
                    <a href="../my/counselor_goods.php">서비스상품</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_05.png);">
                    <a href="../bbs/board.php?bo_table=c_notice">공지사항</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_04.png);">
                    <a href="../bbs/board.php?bo_table=c_tip">알짜 정보</a>
                </li>
                <!-- 
                <li style="background-image:url(../../img/my/my_menu_03.png);">
                    <a href="../bbs/board.php?bo_table=c_benefits">선생님 혜택</a>
                </li> 
                -->
                <!--
                <li style="background-image:url(../../img/my/my_menu_16.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=wish">소원다락방</a>
                </li> 
                -->
                <li style="background-image:url(../../img/my/my_menu_02.png);">
                    <a href="../bbs/qalist.php">문의하기</a>
                </li>
                
            </ul>



        <? } else { ?>

            <ul class="set_div">
                <li style="background-image:url(../../img/my/my_menu_13.png);">
                    <a href="<?php echo G5_URL; ?>/shop/coupon.php">쿠폰함</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_23.png);">
                    <a href="<?php echo G5_URL; ?>/coin/coin_history.php">결제내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_12.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/point.php">포인트내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_01.png);">
                    <a href="<?php echo G5_URL; ?>/my/history_call.php">전화상담내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_11.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=review&mymbid=<?=$member["mb_id"]?>">나의 상담후기</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_02.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=qa">나의 상담문의</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_10.png);">
                    <a href="<?php echo G5_URL; ?>/shop/orderinquiry.php">상품구매내역</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_24.png);">
                    <a href="<?php echo G5_URL; ?>/my/chat_record.php">채팅상담내역</a>
                </li>
            </ul>



        <?php } ?>



    </div>



    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>





    <? } else { ?>

        <div class="con_section con_section_b_bot_02">







            <h3 class="con_title">추가메뉴</h3>



            <ul class="set_div">
                <li style="background-image:url(../../img/my/my_menu_14.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=event">이벤트</a>
                </li>
                <!-- 
                <li style="background-image:url(../../img/my/my_menu_16.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=wish&sca=&sop=and&sfl=mb_id%2C1&stx=<?=$member["mb_id"]?>">소원다락방</a>
                </li> 
                -->
                <li style="background-image:url(../../img/my/my_menu_06.png);">
                    <a href="<?php echo G5_URL; ?>/shop/list.php?ca_id=10">부가서비스</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_22.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/faq.php">이용안내</a>
                </li>
                <!--
                <li style="background-image:url(../../img/my/my_menu_17.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=column">사주문 칼럼</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_19.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=charm">내맘대로 부적</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_18.png);">
                    <a href="<?php echo G5_URL; ?>/sub/way.php">사주문의 길</a>
                </li>
                -->
                <li style="background-image:url(../../img/my/my_menu_20.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=new">신규상담사</a>
                </li>
                <li style="background-image:url(../../img/my/my_menu_21.png);">
                    <a href="<?php echo G5_URL; ?>/bbs/board.php?bo_table=apply">상담사 신청</a>
                </li>
            </ul>



            <!------ 공통내용 : 롤링배너  ------>

            <!--/home/dfsoft_thesaju/www/theme/basic/mobile/skin/shop/basic/mainbanner.10.skin.php-->



            <?php echo display_banner('마이페이지', 'mainbanner.10.skin.php'); ?>



        </div>

    <?php } ?>



    <?php if($is_member){ ?>

        <div class="con_section">

            <a href="<?php echo G5_URL; ?>/bbs/logout.php">

                <div class="my_logout">로그아웃</div>

            </a>

        </div>

    <?php } ?>



</div>

<!-- YS Confirm Modal (custom confirm) -->
<div id="ys_confirm_modal" class="ys-modal" aria-hidden="true">
    <div class="ys-modal__backdrop"></div>

    <div class="ys-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="ys_modal_title" aria-describedby="ys_modal_desc">
        <div class="ys-modal__header">
            <h3 id="ys_modal_title" class="ys-modal__title">확인</h3>
            <button type="button" class="ys-modal__x" aria-label="닫기">✕</button>
        </div>

        <div id="ys_modal_desc" class="ys-modal__body">
            변경하시겠습니까?
        </div>

        <div class="ys-modal__footer">
            <button type="button" class="ys-modal__btn ys-modal__btn--cancel">취소</button>
            <button type="button" class="ys-modal__btn ys-modal__btn--ok">확인</button>
        </div>
    </div>
</div>
<style>
    /* ===== YS Confirm Modal ===== */
    .ys-modal{
        display:none;
        position:fixed;
        inset:0;
        z-index:1000000; /* 기존 99999보다 크게 */
        pointer-events:auto !important;
    }

    .ys-modal.is-open{ display:block; }

    .ys-modal__backdrop{
        position:absolute;
        inset:0;
        background:rgba(0,0,0,.45);
        pointer-events:auto !important;
    }

    /* 하단 시트 형태 */
    .ys-modal__sheet{
        position:absolute;
        left:50%;
        bottom:0;
        transform:translateX(-50%);
        width:100%;
        max-width:650px;
        background:#fff;
        border-radius:16px 16px 0 0;
        box-shadow:0 -8px 24px rgba(0,0,0,.18);
        padding-bottom: max(16px, env(safe-area-inset-bottom));
        pointer-events:auto !important;
    }

    .ys-modal__header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:16px 16px 8px;
    }

    .ys-modal__title{
        margin:0;
        font-size:18px;
        font-weight:700;
    }

    .ys-modal__x{
        appearance:none;
        border:0;
        background:transparent;
        font-size:18px;
        line-height:1;
        padding:8px;
        cursor:pointer;
    }

    .ys-modal__body{
        padding:8px 16px 16px;
        font-size:15px;
        line-height:1.4;
        color:#222;
    }

    .ys-modal__footer{
        display:flex;
        gap:10px;
        padding:0 16px 16px;
    }

    .ys-modal__btn{
        flex:1;
        height:48px;
        border-radius:10px;
        border:1px solid #ddd;
        background:#fff;
        font-size:16px;
        font-weight:700;
        cursor:pointer;
    }

    .ys-modal__btn--ok{
        border-color:#e84263;
        background:#e84263;
        color:#fff;
    }

</style>
<script>

    function member_leave()

    {

        return confirm('정말 회원에서 탈퇴 하시겠습니까?')

    }

</script>

<!-- 수정시 업데이트만 되면... -->
<script>

    
    (function(){
        var $m = $('#ys_confirm_modal');
        var $title = $('#ys_modal_title');
        var $body  = $('#ys_modal_desc');

        var resolver = null;

        function close(result){
            $m.removeClass('is-open').attr('aria-hidden','true');
            $('body').css('overflow',''); // 스크롤 복구
            if (resolver) { resolver(!!result); resolver = null; }
        }

        // 전역 함수로 노출
        window.ysConfirm = function(message, options){
            options = options || {};
            var title = options.title || '확인';
            var okText = options.okText || '확인';
            var cancelText = options.cancelText || '취소';

            $title.text(title);
            $body.html(String(message || '').replace(/\n/g,'<br>'));
            $m.find('.ys-modal__btn--ok').text(okText);
            $m.find('.ys-modal__btn--cancel').text(cancelText);

            $m.addClass('is-open').attr('aria-hidden','false');
            $('body').css('overflow','hidden'); // 모달 뜰 때 배경 스크롤 방지

            // 포커스(가능하면 확인 버튼)
            setTimeout(function(){ $m.find('.ys-modal__btn--ok').focus(); }, 0);

            return new Promise(function(resolve){
                resolver = resolve;
            });
        };

        // 이벤트 바인딩 (중복 바인딩 방지 위해 off 후 on)
        $m.off('click.ys');
        $m.on('click.ys', '.ys-modal__btn--ok', function(){ close(true); });
        $m.on('click.ys', '.ys-modal__btn--cancel, .ys-modal__x, .ys-modal__backdrop', function(){ close(false); });

        // ESC로 닫기 (웹뷰에서 되는 경우만)
        $(document).off('keydown.ys').on('keydown.ys', function(e){
            if(!$m.hasClass('is-open')) return;
            if(e.key === 'Escape') close(false);
        });
    })();

    function mb_logout(){
        const un_params = [];
        // 레벨 채널 해제
        un_params.push('chl_all');
        un_params.push('chl_2');
        un_params.push('chl_5');
        // 출생연도 토픽 전체 해제 (현재 기준 ±100년)
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 100; y <= currentYear + 100; y++) {
            un_params.push('chl_birth_' + y);
        }

        try {
            push_topic_update([], un_params);
        } catch(e) {}

        // 구독 해제 처리 후 로그아웃
        setTimeout(function(){
            location.href='/bbs/logout.php';
        }, 300);
    }

    $(document).ready(function (){
       set_member_push_update();
    });


</script>


<!--20250722 eun 팝업 안 뜨는 오류 수정 시작-->
<?php if($is_member){ ?>
    <?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>
        <?php include_once(G5_PATH.'/include/index_pop_counselor.php'); ?>
    <?php } else { ?>
        <?php include_once(G5_PATH.'/include/index_pop_customer.php'); ?>
    <?php } ?>
<?php } ?>


<?php if ($member['mb_level'] == '5'){ //권한5: 상담사 ?>

    <?php include_once(G5_PATH.'/tail.sub.php'); ?>

<?php } else { ?>

    <?php include_once(G5_MSHOP_PATH.'/_tail.php'); ?>

<?php } ?>

<!--20250722 eun 팝업 안 뜨는 오류 수정 마감-->





