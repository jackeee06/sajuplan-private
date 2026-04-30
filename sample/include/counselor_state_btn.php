<?php
$btn_state = $list[$i]["state"];
$use_phone = $list[$i]["use_phone"];
$use_chat  = $list[$i]["use_chat"];

// 상담가능 상태
$is_available = in_array($btn_state, ['IDLE','RDVC','RDCH'], true);

// 상담중 상태 (전화 or 채팅)
$is_busy_phone = ($btn_state == 'CONN');
$is_busy_chat  = ($btn_state == 'CNCH');

// 상담불가 상태
$is_unavailable = (!$is_available && !$is_busy_phone && !$is_busy_chat);
?>

<style>

    .tel_ft_style{
        font-weight  : bold; 
        margin-right : 8px;
        font-size    : 16px;
    }
    .counselor_state_btn span{
        font-size  : 15px;
    }

</style> 



<?php if ($is_available): ?>

    <!-- ----------------------------- -->
    <!--         상담 가능 상태        -->
    <!-- ----------------------------- -->

    <?php if ($use_phone == "Y" && $use_chat == "N"): ?>
        <!-- 전화 상담만 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel counselor_state_btn tel tel_wait" data-mb_id="<?=$list[$i]["mb_id"]?>">
                    <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>

    <?php elseif ($use_phone == "N" && $use_chat == "Y"): ?>
        <!-- 채팅 상담만 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDCH" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer3" class="btn-pop-chat counselor_state_btn chat chat_wait"
                   data-mb_id="<?=$list[$i]["mb_id"]?>">
                    <i class="fa fa-comment tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>

    <?php elseif ($use_phone == "Y" && $use_chat == "Y"): ?>
        <!-- 전화 + 채팅 모두 상담 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel w50 counselor_state_btn tel tel_wait"
                   data-mb_id="<?=$list[$i]["mb_id"]?>">
                    <i class="fa fa-phone" style="font-weight: bold; margin-right: 8px;"></i><span>상담하기</span>
                </a>
                <a href="#layer3" class="btn-pop-chat w50 counselor_state_btn chat chat_wait"
                   data-mb_id="<?=$list[$i]["mb_id"]?>">
                    <i class="fa fa-comment" style="font-weight: bold; margin-right: 8px;"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>

    <?php endif; ?>



<?php elseif ($is_busy_phone || $is_busy_chat): ?>

    <!-- ----------------------------- -->
    <!--         상담 중 상태          -->
    <!-- ----------------------------- -->

    <?php if ($is_busy_phone): ?>
        <!-- 전화 상담중 -->
        <div class="counselor_state_btn_wrap">
            <a class="counselor_state_btn tel tel_ing">
                <i class="fa fa-phone" style="color: #ff6b6b; font-weight: bold; margin-right: 8px;"></i><span>전화 상담중</span>
                <span class="connection_noti"
                      onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$list[$i]["mb_id"]?>');">
                    접속알림신청
                </span>
            </a>
        </div>
    <?php endif; ?>

    <?php if ($is_busy_chat): ?>
        <!-- 채팅 상담중 -->
        <div class="counselor_state_btn_wrap">
            <a class="counselor_state_btn chat chat_ing">
                <i class="fa fa-comments" style="color: #ff6b6b; font-weight: bold; margin-right: 8px;"></i><span>채팅 상담중</span>
                <span class="connection_noti"
                      onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$list[$i]["mb_id"]?>');">
                    접속알림신청
                </span>
            </a>
        </div>
    <?php endif; ?>



<?php else: ?>

    <!-- ----------------------------- -->
    <!--         상담 불가 상태        -->
    <!-- ----------------------------- -->

    <div class="counselor_state_btn_wrap">
        <a class="counselor_state_btn off">
            <i class="fa fa-times-circle" style="margin-right: 8px;"></i><span>부재중</span>
        </a>
    </div>

<?php endif; ?>
