<?php
$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr"; //운영서버 안의 경로로 맞추기
// $DOCUMENT_ROOT = "/data/wwwroot/thesaju.dmonster.kr";


include_once("./_common.php"); // 메뉴별 공통파일

// 1) try_out='Y' → 5분 지나면 종료
$sql1 = "
  UPDATE chat_room
     SET status = 'DISCONNECT', chat_edate = NOW()
   WHERE status = 'STAY'
     AND try_out = 'Y'
     AND chat_wdate <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
";
sql_query($sql1);


//20250812 eun 채팅방 채팅 중인 상태가 6시간이면 해당 방 disconnect로 만들기.
// 2) try_out='N' → 3600분 지나면 종료
$sql2 = "
  UPDATE chat_room
     SET status = 'DISCONNECT', chat_edate = NOW()
   WHERE status = 'STAY'
     AND try_out = 'N'
     AND chat_wdate <= DATE_SUB(NOW(), INTERVAL 360 MINUTE)
";
sql_query($sql2);

?>
