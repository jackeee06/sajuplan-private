<?php
include_once('./_common.php');

if ($is_guest)
    alert('회원만 이용 가능합니다.');

if (!$is_admin)
    alert('관리자만 삭제할 수 있습니다.');

$token = isset($_POST['token']) ? trim($_POST['token']) : '';
$ss_token = get_session('ss_qa_delete_token');

if (!$token || !$ss_token || $token !== $ss_token) {
    alert('토큰이 유효하지 않습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
}

$chk_qa_id = isset($_POST['chk_qa_id']) ? $_POST['chk_qa_id'] : array();

if (!is_array($chk_qa_id) || count($chk_qa_id) == 0)
    alert('삭제할 게시물을 선택해 주세요.');

$qaconfig = get_qa_config();

foreach ($chk_qa_id as $qa_id) {
    $qa_id = (int)$qa_id;
    if ($qa_id <= 0) continue;

    // 첨부파일 삭제
    $row = sql_fetch(" select qa_file1, qa_file2 from {$g5['qa_content_table']} where qa_id = '{$qa_id}' ");
    if ($row) {
        for ($i = 1; $i <= 2; $i++) {
            if (trim($row['qa_file'.$i])) {
                $filepath = G5_DATA_PATH.'/qa/'.$row['qa_file'.$i];
                if (file_exists($filepath))
                    @unlink($filepath);
            }
        }

        // 답변글도 삭제 (qa_type=1 이고 qa_parent가 현재 qa_id인 것)
        $ans = sql_fetch(" select qa_id, qa_file1, qa_file2 from {$g5['qa_content_table']} where qa_type = '1' and qa_parent = '{$qa_id}' ");
        if ($ans['qa_id']) {
            for ($i = 1; $i <= 2; $i++) {
                if (trim($ans['qa_file'.$i])) {
                    $filepath = G5_DATA_PATH.'/qa/'.$ans['qa_file'.$i];
                    if (file_exists($filepath))
                        @unlink($filepath);
                }
            }
            sql_query(" delete from {$g5['qa_content_table']} where qa_id = '{$ans['qa_id']}' ");
        }

        // 원글 삭제
        sql_query(" delete from {$g5['qa_content_table']} where qa_id = '{$qa_id}' ");
    }
}

// 토큰 갱신
$new_token = _token();
set_session('ss_qa_delete_token', $new_token);

goto_url(G5_BBS_URL.'/qalist.php');
