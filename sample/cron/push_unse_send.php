<?php
  include_once('./_common.php');
  include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');
  //대충 1만건 만넘어가도 채널 써야할듯함.
  $sch_date = date('Y-m-d');

  $select_query = "
   select
    *
   from
    g5_write_fortune_log
   where
    wr_1 = '{$sch_date}'
   and
    push_chk = 'N'
   group by
    wr_subject
   order by
    wr_subject
   desc";
  echo $select_query;
  $result = sql_query($select_query);


  for($i=0; $row=sql_fetch_array($result); $i++) {


      echo "----------------------------<br>";
      $link = G5_URL."/bbs/board.php?bo_table=fortune&wr_id=".$row['wr_id'];
      echo "푸시 이동할 주소:".G5_URL."/bbs/board.php?bo_table=fortune&wr_id=".$row['wr_id']."<BR>";
      echo "푸시 받는 년생:".$row['wr_subject']."<br>";
      echo "푸시 받는 내용:".$row['wr_content']."<br>";
      echo "----------------------------<br>";

      send_noti_topic("chl_birth_".$row['wr_subject'],"[사주문]일일운세",$row['wr_content'],"1","1","",$link,"");
      // 전송 했다면 꼭 업데이트 처리
      $sql = " 
      update 
       g5_write_fortune_log
      set
       push_chk = 'Y'
      where
       idx    = '{$row['idx']}'";
      sql_query($sql);
      
  }
  
  //   for($i=0; $row=sql_fetch_array($result); $i++) {

    //   echo "----------------------------<br>";
    //   echo "푸시 받는 년생:".$row['wr_subject']."<br>";
    //   echo "푸시 받는 내용:"$row['wr_content']."<br>";
    //   echo "----------------------------<br>";

  //   }
  exit;


   
   
//   var_dump(wr_1);
//   $select_query = "
//    select

//    from
//     g5_write_fortune
//    where
//     wr_1 = ''
//   ";

    //   $query = "
    //   select
    //     *
    //   from
    //    g5_write_fortune
    //   where
    //    wr_1 = '2026-02-19'
    //   order by
    //    wr_subject
    //   limit 
    //    30
    //   ";

    //   $result = sql_query($query);
    //   for ($i=0; $row=sql_fetch_array($result); $i++) {
        // echo "-------------------------------<br>";
        // echo $row['wr_subject']."<br>";
    //     // // 양만 추출해볼려는중
    //     // $in_query = "
    //     //  select
    //     //   *
    //     //  from
    //     //   g5_member
    //     //  where
    //     //   mb_birth like '%{$row['wr_subject']}%' 
    //     // ";
    //     // $g5_member_list = sql_query($in_query);

    //     // for ($j=0; $row1=sql_fetch_array($g5_member_list); $j++) {
    //     //     echo "[회원아이디]:".$row1['mb_name']."<br>";
    //     // }

    //     // echo "-------------------------------<br>";
    //   }


  //일일 푸시 운세 진행



?>