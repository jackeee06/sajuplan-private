<?php

  include_once('./_common.php');
  include_once($_SERVER["DOCUMENT_ROOT"].'/android_push/send_fcm.php');

  $sch_date = date('Y-m-d');
  $select_query = "
   select
    *
   from
    g5_write_fortune
   where
    wr_1 = '{$sch_date}'
   group by
    wr_subject
   order by
    wr_subject
   desc";
  $result = sql_query($select_query);

  for($i=0; $row=sql_fetch_array($result); $i++) {
      $today = date('Y-m-d');
      $query = "
       select
        count(idx) as cnt
       from
        g5_write_fortune_log
       where
        wr_id = '{$row['wr_id']}'
      ";
      $row_chk = sql_fetch($query);
      if((int)$row_chk['cnt'] == 0){
            $ins_query = "
                insert 
                into 
                g5_write_fortune_log
                set 
                wr_subject = '{$row['wr_subject']}',
                wr_content = '{$row['wr_content']}',
                wr_id      = '{$row['wr_id']}',
                wr_1       = '{$row['wr_1']}',
                push_chk   = 'N',
                wdate      = '{$today}'
            ";
            $rtn = sql_query($ins_query);
      }
  }

?>