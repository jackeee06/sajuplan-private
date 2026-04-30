<?
//상담사상태 IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비

$btn_state = $cinfo["state"];  /// 상담사용여부
$use_phone = $cinfo["use_phone"];  // 전화상담 사용여부
$use_chat = $cinfo["use_chat"];  /// 채팅상담 사용여부

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


<? if($btn_state=="IDLE" || $btn_state=="RDCH" || $btn_state=="RDVC" || $btn_state=="CONN" || $btn_state=="CNCH"  ){?>
    <? if($use_phone=="Y" && $use_chat=="N"){?>

        <? if($btn_state=="IDLE"){?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel counselor_state_btn tel tel_wait" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <!-- <img src="../img/common/icon_state_tel_off.png" alt="상담하기 아이콘">상담하기 -->
                     <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                </a>
            </div>
        <? }else if($btn_state=="CONN"){?>
            <div class="counselor_state_btn_wrap">
                <a class="counselor_state_btn tel tel_ing">
                    <!-- <img src="../img/common/icon_state_tel_on.gif" alt="상담중 아이콘" >상담중 -->
                     <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                    <span class="connection_noti" onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$cinfo["mb_id"]?>');">접속알림신청</span>
                </a>
            </div>
        <? }?>

    <? }?>

    <? if($use_phone=="N" && $use_chat=="Y"){?>
        <? if($btn_state=="RDCH"){?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer3" class="btn-pop-chat counselor_state_btn chat chat_wait" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <i class="fa fa-comment" style="font-weight: bold; margin-right: 8px;"></i><span>상담하기</span>
                </a>
            </div>
        <? }elseif($btn_state=="CNCH"){?>
            <div class="counselor_state_btn_wrap">
                <a class="counselor_state_btn chat chat_ing">
                    <!-- <img src="../img/common/icon_state_chat_on.png" alt="상담중 아이콘" >상담중 -->
                    <i class="fa fa-comment" style="font-weight: bold; margin-right: 8px;"></i><span>상담중</span>
                    <span class="connection_noti" onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$cinfo["mb_id"]?>');">접속알림신청</span>
                </a>
            </div>
        <? }?>
    <? }?>



    <!-- <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel w50 counselor_state_btn tel tel_wait" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                <a href="#layer3" class="btn-pop-chat w50 counselor_state_btn chat chat_wait" data-mb_id="<?=$cinfo["mb_id"]?>"><img src="../img/common/icon_state_chat_off.png" alt="상담하기 아이콘"  >상담하기</a>
            </div> -->

    
    

    <? if($use_phone=="Y" && $use_chat=="Y"){?>

    

        <? if($btn_state=="RDVC"){?>
            <div class="counselor_state_btn_wrap">
                <a href="#layer2" class="btn-pop-tel w50 counselor_state_btn tel tel_wait" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <i class="fa fa-phone tel_ft_style"></i><span>상담하기</span>
                <a href="#layer3" class="btn-pop-chat w50 counselor_state_btn chat chat_wait" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <!-- <img src="../img/common/icon_state_chat_off.png" alt="상담하기 아이콘"  >상담하기 -->
                    <i class="fa fa-comment" style="font-weight: bold; margin-right: 8px;"></i><span>상담하기</span>

                    
                </a>
            </div>
        <? }else{?>
            <div class="counselor_state_btn_wrap">
                <a href="#none;" class="btn-pop-tel w50 counselor_state_btn tel tel_ing" data-mb_id="<?=$cinfo["mb_id"]?>"><img src="../img/common/icon_state_tel_on.gif" alt="상담중 아이콘"  >상담중
                </a>
                <a href="#none;" class="btn-pop-chat w50 counselor_state_btn chat chat_ing" data-mb_id="<?=$cinfo["mb_id"]?>">
                    <i class="fa fa-comment" style="font-weight: bold; margin-right: 8px;"></i><span>상담중</span>
                    <span class="connection_noti" onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$list[$i]["mb_id"]?>');">접속알림신청</span></a>
            </div>
        <? }?>

    <? }?>

<? }else{?>
    <div class="counselor_state_btn_wrap">
        <a href="#layer2" class="btn-pop counselor_state_btn off"><img src="../img/common/icon_state_off.png" alt="부재중 아이콘" >부재중</a>
    </div>

<? }?>