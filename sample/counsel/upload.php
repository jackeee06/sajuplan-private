<?
if ($_POST['act'] == 'uploadChatImg') { 

  if (!empty($_FILES['upload_file'])) {
      $file = $_FILES['upload_file'];

      $originalName = basename($file['name']); // 원본 파일명
      $ext = pathinfo($originalName, PATHINFO_EXTENSION);         // 확장자
      $base = pathinfo($originalName, PATHINFO_FILENAME);         // 이름 부분
      $rand = bin2hex(random_bytes(4)); // 랜덤 8자리 문자열 (ex: a1b2c3d4)

      $newName = $base . '_' . $rand . '.' . $ext; // 새 파일명

      $target = G5_DATA_PATH . '/chat/' . $newName;

      if (move_uploaded_file($file['tmp_name'], $target)) {
          echo json_encode([
              'status' => 'ok',
              'filename' => $newName,
              'url' => '/data/chat/' . urlencode($newName)
          ]);
      } else {
          echo json_encode(['status' => 'fail', 'msg' => '파일 저장 실패']);
      }
  }

}

?>