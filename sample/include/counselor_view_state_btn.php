<?
$minfo = get_member($view["mb_id"]);

// 현재 상담사 상태
$btn_state = $minfo["state"];
$use_phone = $minfo["use_phone"];
$use_chat  = $minfo["use_chat"];

// 상담가능 그룹
$is_available = in_array($btn_state, ['IDLE','RDVC','RDCH'], true);

// 상담중 (전화/채팅 구분)
$is_busy_phone = ($btn_state == 'CONN');   // 전화 상담중
$is_busy_chat  = ($btn_state == 'CNCH');   // 채팅 상담중

// 상담불가 그룹
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

    <!-- 상담가능 상태 -->

    <?php if ($use_phone == "Y" && $use_chat == "N"): ?>
        <!-- 전화 상담만 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel counselor_state_btn tel tel_wait"
                   data-mb_id="<?=$view["mb_id"]?>">
                    <!-- <img src="../img/common/icon_state_tel_off.png"> -->
                    <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>

    <?php elseif ($use_phone == "N" && $use_chat == "Y"): ?>
        <!-- 채팅 상담만 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDCH" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer3" class="btn-pop-chat counselor_state_btn chat chat_wait"
                   data-mb_id="<?=$view["mb_id"]?>">
                    <!-- <img src="../img/common/icon_state_chat_off.png">상담하기 -->
                     <i class="fa fa-comment tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>

    <?php elseif ($use_phone == "Y" && $use_chat == "Y"): ?>
        <!-- 전화 + 채팅 모두 상담 가능 -->
        <?php if ($btn_state == "IDLE" || $btn_state == "RDVC"): ?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel w50 counselor_state_btn tel tel_wait"
                   data-mb_id="<?=$view["mb_id"]?>">
                   <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                    <!-- <img src="../img/common/icon_state_tel_off.png">상담 -->
                </a>
                <a href="#layer3" class="btn-pop-chat w50 counselor_state_btn chat chat_wait"
                   data-mb_id="<?=$view["mb_id"]?>">
                    <!-- <img src="../img/common/icon_state_chat_off.png">상담 -->
                      <i class="fa fa-comment tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <?php endif; ?>
    <?php endif; ?>


<?php elseif ($is_busy_phone || $is_busy_chat): ?>

    <!-- 상담중 상태 (전화 / 채팅 분리) -->

    <?php if ($is_busy_phone): ?>
        <!-- 전화 상담중 -->
        <div class="counselor_state_btn_wrap">
            <a class="counselor_state_btn tel tel_ing">
                <!-- <img src="../img/common/icon_state_tel_on.gif">전화 상담중 -->
                 <i class="fa fa-comment tel_ft_style"></i><span>상담하기</span>
                <span class="connection_noti"
                      onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$view["mb_id"]?>');">
                    접속알림신청
                </span>
            </a>
        </div>
    <?php endif; ?>

    <?php if ($is_busy_chat): ?>
        <!-- 채팅 상담중 -->
        <div class="counselor_state_btn_wrap">
            <a class="counselor_state_btn chat chat_ing">
                <!-- <img src="../img/common/icon_state_chat_on.png">채팅 상담중 -->
                 <i class="fa fa-comment tel_ft_style"></i><span>채팅 상담중</span>
                <span class="connection_noti"
                      onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$view["mb_id"]?>');">
                    접속알림신청
                </span>
            </a>
        </div>
    <?php endif; ?>

    


<?php else: ?>

    <!-- 상담불가 상태 -->
    <div class="counselor_state_btn_wrap">
        <a class="counselor_state_btn off">
            <!-- <img src="../img/common/icon_state_off.png">부재중 -->
            <i class="fa fa-comment tel_ft_style"></i><span>부재중</span>
        </a>
    </div>

<?php endif; ?>
