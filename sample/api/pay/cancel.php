 <?php
 include_once('../common.php');
 include_once(G5_PATH.'/lib/pay_ag9.php');
 
 header('Content-Type: application/json; charset=utf-8');
 
 $oid     = $_POST['oid'] ?? '';
 $partial = !empty($_POST['partial']);
 $recamt  = (int)($_POST['recamt'] ?? 0);
 $reccoin = (int)($_POST['reccoin'] ?? 0);
 $reason  = $_POST['reason'] ?? '';
 
 if (!$oid) { echo json_encode(['ok'=>false,'err'=>'NEED_OID']); exit; }
 if ($partial && ($recamt<=0 || $reccoin<=0)) { echo json_encode(['ok'=>false,'err'=>'NEED_PARTIAL_AMOUNTS']); exit; }
 
 $r = pay_cancel($oid, $partial, $recamt, $reccoin, $reason);
 echo json_encode($r, JSON_UNESCAPED_UNICODE);