<?
include_once('./_common.php');
ob_clean();
if($_POST['act'] == 'removeChat') {


  $is_csr = $_POST['is_csr'];
  $room_idx = $_POST['room_idx'];
   try {
    if($is_csr == 'Y') { 
      $sql = "UPDATE chat_room SET is_csr_delete = 'Y' WHERE idx = '{$room_idx}'";
    } else {
      $sql = "UPDATE chat_room SET is_mb_delete = 'Y' WHERE idx = '{$room_idx}'";
    }
      sql_fetch($sql);
       echo json_encode(['result' => true]);
   } catch (Exception $e) {
       echo json_encode(['result' => false]);
   }

  
}
?>