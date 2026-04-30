<?
//상담사상태 IDLE : 상담가능, ABSE:부재중, CONN:상담중, RESV 예약, CRDY:상담준비

$btn_state = $list[$i]["state"];  /// 상담사용여부
$use_phone = $list[$i]["use_phone"];  // 전화상담 사용여부
$use_chat = $list[$i]["use_chat"];  /// 채팅상담 사용여부

?>

<?if($btn_state=="IDLE" || $btn_state=="CONN"){?>
<?if($use_phone=="Y" && $use_chat=="N"){?>

<?if($btn_state=="IDLE"){?>
<div class="counselor_state_btn_wrap">
	<a href="#layer2" class="btn-pop-tel counselor_state_btn tel tel_wait" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_tel_off.png">상담하기</a>
</div>
<?}else{?>
<div class="counselor_state_btn_wrap">
  	<a class="counselor_state_btn tel tel_ing">
    	<img src="../img/common/icon_state_tel_on.png">상담중
        <span class="connection_noti" onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$list[$i]["mb_id"]?>');">접속알림신청</span>
    </a>
</div>
<?}?>

<?}?>

<?if($use_phone=="N" && $use_chat=="Y"){?>
<?if($btn_state=="IDLE"){?>
<div class="counselor_state_btn_wrap">
	<a href="#layer3" class="btn-pop-chat counselor_state_btn chat chat_wait" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_chat_off.png">상담하기</a>
</div>
<?}ELSE{?>
<div class="counselor_state_btn_wrap">
  <a class="counselor_state_btn chat chat_ing">
  	  <img src="../img/common/icon_state_chat_on.png">상담중
      <span class="connection_noti" onclick="send_state_kakatalk('<?=$member["mb_id"]?>','<?=$list[$i]["mb_id"]?>');">접속알림신청</span>
  </a>
</div>
<?}?>
<?}?>

<?if($use_phone=="Y" && $use_chat=="Y"){?>

	<?if($btn_state=="IDLE"){?>
			 <div class="counselor_state_btn_wrap">
				<a href="#layer2" class="btn-pop-tel w50 counselor_state_btn tel tel_wait" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_tel_off.png">상담하기</a>
				<a href="#layer3" class="btn-pop-chat w50 counselor_state_btn chat chat_wait" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_chat_off.png">상담하기</a>
			 </div>
	<?}else{?>
				<div class="counselor_state_btn_wrap">
				<a href="#none;" class="btn-pop-tel w50 counselor_state_btn tel tel_ing" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_tel_off.png">상담중</a>
				<a href="#none;" class="btn-pop-chat w50 counselor_state_btn chat chat_ing" data-mb_id="<?=$list[$i]["mb_id"]?>"><img src="../img/common/icon_state_chat_off.png">상담중</a>
				</div>
	<?}?>

<?}?>

<?}else{?>
<div class="counselor_state_btn_wrap">
	<a href="#layer2" class="btn-pop counselor_state_btn off"><img src="../img/common/icon_state_off.png">부재중</a>
</div>

<?}?>