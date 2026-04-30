<?php
$sub_menu = '999100';
include_once('./_common.php');

// 게시글이 많을 경우 대비 설정변경
set_time_limit ( 0 );
ini_set('memory_limit', '50M');

auth_check($auth[$sub_menu], "w");

$g5['title'] = '게시판 엑셀 업로드';
include_once (G5_ADMIN_PATH.'/admin.head.php');

$write_table = $g5['write_prefix'].$bo_table;
$board = get_board_db($bo_table);

if ($config['cf_editor'] && $board['bo_use_dhtml_editor']) {
    $html = 'html1';
    if(preg_match('#html(1|2)#', strtolower($html), $matches))
        $html = $matches[0];
}

if($_FILES['excelfile']['tmp_name']) {
    $file = $_FILES['excelfile']['tmp_name'];

    include_once(G5_LIB_PATH.'/Excel/reader.php');

    $data = new Spreadsheet_Excel_Reader();

    // Set output Encoding.
    $data->setOutputEncoding('UTF-8');
    $data->read($file);

    error_reporting(E_ALL ^ E_NOTICE);

    $total_count = 0;
    $fail_count = 0;
    $succ_count = 0;

    function excel_row_is_blank(array $sheet, int $row): bool {
        $numCols = (int)($sheet['numCols'] ?? 0);
        for ($c = 1; $c <= $numCols; $c++) {
            $val = isset($sheet['cells'][$row][$c]) ? trim((string)$sheet['cells'][$row][$c]) : '';
            if ($val !== '') return false; // 하나라도 값이 있으면 빈 줄 아님
        }
        return true;
    }

    for ($i = 3; $i <= $data->sheets[0]['numRows']; $i++) {

        // 빈 줄이면 건너뜀(카운트도 증가시키지 않음)
        if (excel_row_is_blank($data->sheets[0], $i)) {
            continue;
        }

        $total_count++;

        $j = 1;

        $ca_name			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_subject			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_content			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $mb_id				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_name			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_password		= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_email			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_homepage		= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_datetime		= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_ip				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_hit				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_good				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_nogood			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_link1				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_link1_hit			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_link2				= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_link2_hit			= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_1					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_2					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        // wr_2가 비어있으면 00:12:00 ~ 00:15:00(포함) 중 임의 값으로 채움
        if (trim($wr_2) === '') {
            $sec  = function_exists('random_int') ? random_int(12*60, 15*60) : mt_rand(12*60, 15*60);
            $wr_2 = addslashes(gmdate('H시i분s초', $sec)); // 예: 00시13분27초
        } $wr_3					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_4					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_5					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_6					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_7					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_8					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_9					= addslashes($data->sheets[0]['cells'][$i][$j++]);
        $wr_10				= addslashes($data->sheets[0]['cells'][$i][$j++]);

        $wr_num = get_next_num($write_table);

        $wr_option    = $html;
        $wr_seo_title = exist_seo_title_recursive('bbs', generate_seo_title($wr_subject), $write_table, $wr_id);

        $sql = " insert into $write_table
                set wr_num = '$wr_num',
                     wr_reply = '$wr_reply',
                     wr_comment = 0,
                     ca_name = '$ca_name',
                     wr_option = '$html,$secret,$mail',
                     wr_subject = '$wr_subject',
                     wr_content = '$wr_content',
                     wr_seo_title = '$wr_seo_title',
                     wr_link1 = '$wr_link1',
                     wr_link2 = '$wr_link2',
                     wr_link1_hit = '$wr_link1_hit',
                     wr_link2_hit = '$wr_link2_hit',
                     wr_hit = '$wr_hit',
                     wr_good = '$wr_good',
                     wr_nogood = '$wr_nogood',
                     mb_id = '$mb_id',
                     wr_password = '".get_encrypt_string($wr_password)."',
                     wr_name = '$wr_name',
                     wr_email = '$wr_email',
                     wr_homepage = '$wr_homepage',
                     wr_datetime = '$wr_datetime',
                     wr_last = '$wr_datetime',
                     wr_ip = '$wr_ip',
                     wr_1 = '$wr_1',
                     wr_2 = '$wr_2',
                     wr_3 = '$wr_3',
                     wr_4 = '$wr_4',
                     wr_5 = '$wr_5',
                     wr_6 = '$wr_6',
                     wr_7 = '$wr_7',
                     wr_8 = '$wr_8',
                     wr_9 = '$wr_9',
                     wr_10 = '$wr_10' ";
        sql_query($sql);

        $wr_id = sql_insert_id();

        // 부모 아이디에 UPDATE
        sql_query(" update $write_table set wr_parent = '$wr_id' where wr_id = '$wr_id' ");

        // 새글 INSERT
        sql_query(" insert into {$g5['board_new_table']} ( bo_table, wr_id, wr_parent, bn_datetime, mb_id ) values ( '{$bo_table}', '{$wr_id}', '{$wr_id}', '".G5_TIME_YMDHIS."', '{$mb_id}' ) ");

        // 게시글 1 증가
        sql_query("update {$g5['board_table']} set bo_count_write = bo_count_write + 1 where bo_table = '{$bo_table}'");

        $succ_count++;
    }
}

?>


    <div class="local_desc02 local_desc">
        <p>게시글 등록을 완료했습니다.</p>
    </div>

    <div class="local_desc01 local_desc">
        <ul class="session_del">
            <li>총게시글수 : <?php echo number_format($total_count); ?></li>
        </ul>
    </div>

    <div class="local_desc01 local_desc">
        <ul class="session_del">
            <li>완료건수 : <?php echo number_format($succ_count); ?></li>
        </ul>
    </div>

    <div class="local_desc01 local_desc">
        <ul class="session_del">
            <li>실패건수 :<?php echo number_format($fail_count); ?></li>
        </ul>
    </div>


<?
include_once (G5_ADMIN_PATH.'/admin.tail.php');
?>