<?php 
  include_once('../common.php');   
  ################################################################### 
  // 결제 INSERT 처리
  $result    = true;
  $msg       = "";
  $paymethod = $_POST['paymethod'];
  $orderNo   = $_POST['orderNo'];
  $oid       = $_POST['oid'];
  $amount    = $_POST['amount'];
  $coinamt   = $_POST['coinamt'];

  if($member['mb_id']){
    // 1시간 지난건은 그냥삭제 콜백쪽에서 완료 처리할것.
    sql_query("delete from saju_payment where mb_id = '{$member['mb_id']}' and od_status = '0') and od_wdate < DATE_SUB(NOW(), INTERVAL 1 HOUR");
  }

  $insert_query = "
    INSERT
    INTO
    saju_payment
    (
      mb_id,
      Membid,
      Oid,
      PayMethod,
      Amount,
      Coin_Amount,
      od_status,
      od_wdate
    )
    VALUES
    (
      '".$member["mb_id"]."',
      '".$member["mb_1"]."',
      '".$oid."',
      '".$paymethod."',
      '".$amount."',
      '".$coinamt."',
      '0',
      now()
  )";

  $res = sql_query($insert_query);
  // [추가오류가 날수있어서 우선은 주문번호는 변경 X]

  echo json_encode(
    [
      'result' => $result,
      'msg'    => $msg,
      'data'   => array(
        'paymethod' => $paymethod,
        'orderNo'   => $orderNo,
        'membid'    => $member["mb_1"],
        'oid'       => $oid,
        'amount'    => $amount,
        'coinamt'   => $coinamt
      )
    ]
  );
?>