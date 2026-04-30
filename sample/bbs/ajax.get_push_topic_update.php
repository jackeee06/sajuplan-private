<?php
    include_once "../common.php"; 



    if($_POST['act'] == "get_member_info"){

       $res       = array();
       $login_chk = "Y";
       $msg       = "";

       if($member['mb_id']){
          $login_chk = "Y";
       }else{
          $login_chk = "N";
          
       }
       echo json_encode(
        [
          'login_chk' => $login_chk,
          'data'      => $member,
        ]
       );
    }


    // @sql_query($sql);
    // echo json_encode(['data'=>$member,'push_chk' => $push_all]);
    // 1.생년월일 채널 OFF (현재 생년월일 반환)
    // 2.회원의 현재 채널 ON
    // 3.기존 채널들은 OFF처리 하기
?>

