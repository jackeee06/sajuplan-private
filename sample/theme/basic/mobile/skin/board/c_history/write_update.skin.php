<?php
//20250806 eun 채팅상담 메모 부분 수정 시작
if($md=="conmy"&& $member["mb_level"]=="5" && $c_url=="chat" ){
    //goto_url("/my/counselor_history.php?".$qstr);
    goto_url("/my/chat_record.php?");
}else if ($md=="conmy"&& $member["mb_level"]=="5") {
    //goto_url(G5_BBS_URL.'/board.php?bo_table='.$bo_table);
    goto_url("/my/counselor_history.php?" . $qstr);
}
else {
//20250806 eun 채팅상담 메모 부분 수정 마감

}
?>