<?php
$DOCUMENT_ROOT = "/data/wwwroot/sajumoon.co.kr";
include_once($DOCUMENT_ROOT."/common.php");
include_once("./_common.php");




// $new_password = "sajumoon1004@";
// // 그누보드5 create_hash 함수 사용 (pbkdf2)
// if (function_exists('create_hash')) {
//     $hashed = create_hash($new_password);
// } else {
//     // fallback: password_hash 사용
//     $hashed = password_hash($new_password, PASSWORD_DEFAULT);
// }

// $sql = "UPDATE {$g5['member_table']} SET mb_password = '{$hashed}' WHERE mb_no = 1";
// sql_query($sql);

// echo "mb_no=1 관리자 비밀번호가 변경되었습니다.";
?>