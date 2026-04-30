<?php

$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";

include_once($DOCUMENT_ROOT."/common.php"); // 메뉴별 공통파일
###############################################
include_once("./_common.php");



// and mb_no = '4'
// mb_leave_date='' and 
// $sql = "select * from g5_member where mb_level='5'";
// $result = sql_query($sql);

// if($result){
//     while($row = sql_fetch_array($result)){
//        if($row["mb_1"]){
//             // echo  "-----------------------------------------------------------------<br>";
//             // $data = '{"csrnm":"'.$row['mb_name'].'"}';
//             // $murl = "csr-mgr";
//             // echo  "회원아이디 : ".$row['mb_name']."<br>";
//             // echo  "회원키값 : ".$row["mb_1"]."<br>";
//             // $jresult = send_mjson($murl, $data, 'PUT', $row["mb_1"]);
//             // echo $jresult['resultmessage']."<br>";
//             // echo "-----------------------------------------------------------------<br>";
//        }
//     }
// }


// $sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
// $result = sql_query($sql);
// if($result){
//    while($row = sql_fetch_array($result)){

//      $sql_ = "
//      select 
//       sum(po_point) as sum_po_point
//      from 
//       g5_point 
//      where 
//       po_content != '2026-01월 정산'
//      and 
//       po_content != '[수동]정산 시스템 오류로인한 미지급건' 
//      and
//       po_content != '[수동] 11월 정산 중복'
//      and
//       po_datetime >= '2026-01-01 00:00:00' and po_datetime < '2026-02-01 00:00:00'
     
//      and
//       mb_id = '{$row['mb_id']}'
//      ";

//      $row1 = sql_fetch($sql_);
//      //var_dump($row1);
//      $_sum_price = (int)$row1["sum_po_point"];
    //  echo "-----------------------------------------------------------------<br>";
    //  echo "query:".$sql."<br>";
    //  echo "회원아이디 : ".$row['mb_id']."<br>";
    //  echo "정산 재기록 포인트 : ".$_sum_price."<br>";
    //  echo "-----------------------------------------------------------------<br>";
//    }
// }




?>