<?php
include_once('./_common.php');
####################################################

$mb_id = $_REQUEST["mb_id"];

if(!$mb_id){
    exit;
}

?>
 <style>

    .my_coin_state_right_text2{
        font-size: 12px;
        background-color: #f5f5f5;
        padding: 3px 4px;
        border-radius: 4px;
        color: #999;
        font-weight: 400;
    }
    .my_coin_state_right2{
        font-size : 14px;
    }
    .my_time_state_item{
        width : 80%;
        float : left;
        display: unset;
    }
    .my_time_state_item_con{
        float : left;
        text-align: left;
    }
    .point_btn{
        font-size : 14px;
        padding: 8px 30px;
        background-color: #8259f5;
        color: #ffffff;
        border-radius: 16px;
    }
    .min_w_80{
        display: inline-block;
        width : 90px;
    }
    .counsel_start_con_wrap .my_time_state .my_time_state_item{
        width : 100%;
    }
    @media (max-width: 442px) {
        .coin_point_btn {
            margin-top: 10px;
        }
    }

 </style>

<?php
if($mb_id){
    $sql = "select a.*, b.* from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) where b.mb_id='".$mb_id."'";

    $row = sql_fetch($sql);

    $thumb = get_list_thumbnail('counselor', $row['wr_id'], '211', '158', false, true);

    $mb = get_member($mb_id);

    if($thumb['src']) {
        $img = $thumb['src'];
    } else {
        $img = G5_IMG_URL.'/no_img.png';
    }

    ?>

    <div class="pop-container">
        <div class="pop-tit">채팅상담가능</div>
        <div class="pop-conts">
            <div class="counsel_start_title">
                <ul class="counsel_img"><img src="<?=$img?>" /></ul>
                <ul class="counsel_name">
                    <li class="counsel_name_wrap">
                        <p class="counsel_num point"><?=$row["mb_no"]?>번</p>
                        <span class="counsel_name_cate point"><?=$row["ca_name"]?></span><?=$row["mb_nick"]?>
                    </li>

                    <li class="counsel_name_wrap" style="margin-top:5px; display: flex; width: 100%; justify-content: space-between; align-items: center;">
                        <div style="display:flex; align-items:center; gap:4px;"><img src="../img/common/icon_coin.png" style="width: 18px;" /> 채팅상담</div>
                        <div class="my_coin_state_right2">
                            <?=number_format($row["mb_13"])?><span class="f_400"> ⓟ</span>
                            <span class="my_coin_state_right_text2">(<?=$row["mb_12"]?>초당)</span>
                        </div>
                    </li>

                </ul>
            </div>

            <div class="counsel_start_con_wrap">

                <ul class="my_time_state" style="display:inline-block; width:100%;">
                    <li class="my_time_state_item">
                        <div class="my_time_state_item_con">
                            <span class="my_time_state_01 min_w_80">나의 보유포인트</span>
                            <span class="my_time_state_02 min_w_80"><?=number_format($member["mb_point"])?> ⓟ</span>
                        </div>
                    </li>

                    <li class="my_time_state_item">
                        <div class="my_time_state_item_con">
                            <span class="my_time_state_01 min_w_80">상담 가능 시간</span>
                            <?
                            $sec = ((int)$row["mb_12"] * (int)$member["mb_point"]) / max((int)$row["mb_13"], 1);
                            $min = (int)round($sec / 60);
                            ?>
                            <span class="my_time_state_02">약 <?=$min?>분</span>
                            <span class="my_time_state_03">상담가능</span>
                        </div>
                        <a class="coin_point_btn" href="/coin/coin_fill.php" style="float: right;"><span class="point_btn">포인트충전</span></a>
                    </li>

                </ul>

                <ul class="counsel_go_noti">
                    채팅 상담사 <span class="csr_number_font"><?=$row["mb_no"]?>번</span>과 채팅을 시작합니다.
                </ul>

                <a target="_parent" class="point_bo point counsel_go_btn begin_checkout"
                   onclick="go_chat('<?=$member["mb_1"]?>', '<?=$row["mb_1"]?>'); return false;">
                    <img src="../img/common/icon_state_chat_off.png" style="width:20px; vertical-align:middle;" />
                    <span>채팅 상담하기</span>
                </a>

            </div>

        </div>
        <div class="btn-r">
            <a href="#none;" class="btn-layerClose-chat" onclick="chat_close_pop();"><i class="xi-close-thin"></i></a>
        </div>
    </div>

    <?
}
