<?php
include_once('./_common.php');

// 회원이 많을 경우 대비 설정변경
set_time_limit ( 0 );
ini_set('memory_limit', '50M');

auth_check_menu($auth, $sub_menu, "w");

$is_upload_file = (isset($_FILES['excelfile']['tmp_name']) && $_FILES['excelfile']['tmp_name']) ? 1 : 0;

if( ! $is_upload_file){
    alert("엑셀 파일을 업로드해 주세요.");
}

if($is_upload_file) {
    $file = $_FILES['excelfile']['tmp_name'];

    include_once(G5_LIB_PATH.'/PHPExcel/IOFactory.php');

    $objPHPExcel = PHPExcel_IOFactory::load($file);

	exit;
    $sheet = $objPHPExcel->getSheet(0);

    $num_rows = $sheet->getHighestRow();
    $highestColumn = $sheet->getHighestColumn();

    $dup_mb_id = array();
    $fail_mb_id = array();
    $dup_count = 0;
    $total_count = 0;
    $fail_count = 0;
    $succ_count = 0;

    for ($i = 3; $i <= $num_rows; $i++) {
        $total_count++;

        $j = 0;

        $rowData = $sheet->rangeToArray('A' . $i . ':' . $highestColumn . $i,
                                            NULL,
                                            TRUE,
                                            FALSE);

        $mb_id            = addslashes($rowData[0][$j++]);
        $mb_password            = addslashes($rowData[0][$j++]);
        $mb_name            = addslashes($rowData[0][$j++]);
        $mb_nick            = addslashes($rowData[0][$j++]);
        $mb_email            = addslashes($rowData[0][$j++]);
        $mb_homepage            = addslashes($rowData[0][$j++]);
        $mb_level            = addslashes($rowData[0][$j++]);
        $mb_tel            = addslashes($rowData[0][$j++]);
        $mb_hp            = addslashes($rowData[0][$j++]);
        $mb_adult            = addslashes($rowData[0][$j++]);
        $mb_zip            = addslashes($rowData[0][$j++]);
        $mb_zip = preg_replace('/[^0-9]/', '', $mb_zip);
        $mb_zip1        = isset($mb_zip)           ? substr(trim($mb_zip), 0, 3) : "";
        $mb_zip2        = isset($mb_zip)           ? substr(trim($mb_zip), 3)    : "";
        $mb_addr1            = addslashes($rowData[0][$j++]);
        $mb_addr2            = addslashes($rowData[0][$j++]);
        $mb_addr3            = addslashes($rowData[0][$j++]);
        $mb_addr_jibeon            = addslashes($rowData[0][$j++]);
        $mb_recommend            = addslashes($rowData[0][$j++]);
        $mb_mailling            = addslashes($rowData[0][$j++]);
        $mb_sms            = addslashes($rowData[0][$j++]);
        $mb_open            = addslashes($rowData[0][$j++]);
        $mb_1            = addslashes($rowData[0][$j++]);
        $mb_2            = addslashes($rowData[0][$j++]);
        $mb_3            = addslashes($rowData[0][$j++]);
        $mb_4            = addslashes($rowData[0][$j++]);
        $mb_5            = addslashes($rowData[0][$j++]);
        $mb_6            = addslashes($rowData[0][$j++]);
        $mb_7            = addslashes($rowData[0][$j++]);
        $mb_8            = addslashes($rowData[0][$j++]);
        $mb_9            = addslashes($rowData[0][$j++]);
        $mb_10            = addslashes($rowData[0][$j++]);
		$mb_point            = addslashes($rowData[0][$j++]);
		$mb_time            = addslashes($rowData[0][$j++]);

        // 휴대폰번호 체크
        $mb_hp = hyphen_hp_number($mb_hp);

        if(!$mb_id || !$mb_email) {
            $fail_count++;
            continue;
        }

        // mb_id 중복체크
        $sql2 = " select count(*) as cnt from {$g5['member_table']} where mb_id = '$mb_id' ";
        $row2 = sql_fetch($sql2);
        if($row2['cnt']) {
            $fail_mb_id[] = $mb_id;
            $dup_mb_id[] = $mb_id;
            $dup_count++;
            $fail_count++;
            continue;
        }

        $sql_certify = '';
        $sql_certify .= " , mb_hp = '{$mb_hp}' ";
        $sql_certify .= " , mb_certify = '' ";
        $sql_certify .= " , mb_adult = 0 ";
        $sql_certify .= " , mb_birth = '' ";
        $sql_certify .= " , mb_sex = '' ";

        $sql = " insert into {$g5['member_table']}
                    set mb_id = '{$mb_id}',
                         mb_password = '".get_encrypt_string($mb_password)."',
                         mb_name = '{$mb_name}',
                         mb_nick = '{$mb_nick}',
                         mb_nick_date = '".G5_TIME_YMD."',
                         mb_email = '{$mb_email}',
                         mb_homepage = '{$mb_homepage}',
                         mb_tel = '{$mb_tel}',
                         mb_zip1 = '{$mb_zip1}',
                         mb_zip2 = '{$mb_zip2}',
                         mb_addr1 = '{$mb_addr1}',
                         mb_addr2 = '{$mb_addr2}',
                         mb_addr3 = '{$mb_addr3}',
                         mb_addr_jibeon = '{$mb_addr_jibeon}',
                         mb_datetime = '".G5_TIME_YMDHIS."',
                         mb_ip = '{$_SERVER['REMOTE_ADDR']}',
                         mb_level = '{$mb_level}',
                         mb_recommend = '{$mb_recommend}',
                         mb_login_ip = '{$_SERVER['REMOTE_ADDR']}',
                         mb_mailling = '{$mb_mailling}',
                         mb_sms = '{$mb_sms}',
                         mb_open = '{$mb_open}',
                         mb_open_date = '".G5_TIME_YMD."',
                         mb_1 = '{$mb_1}',
                         mb_2 = '{$mb_2}',
                         mb_3 = '{$mb_3}',
                         mb_4 = '{$mb_4}',
                         mb_5 = '{$mb_5}',
                         mb_6 = '{$mb_6}',
                         mb_7 = '{$mb_7}',
                         mb_8 = '{$mb_8}',
                         mb_9 = '{$mb_9}',
                         mb_10 = '{$mb_10}',
						 mb_point = '{$mb_point}',
						 $mb_time = '{$mb_time}'
                         {$sql_certify} ";

        // 이메일 인증을 사용하지 않는다면 이메일 인증시간을 바로 넣는다
        if (!$config['cf_use_email_certify'])
            $sql .= " , mb_email_certify = '".G5_TIME_YMDHIS."' ";
        sql_query($sql);



		
		/// 회원 포인트가 있으면? 포인트 테이블에 넣어준다. 엠투넷 첫 동기화작업 때문에
		$saju_point = 0;
		$saju_point = get_point_sum($mb_id);
		if($mb_point > 0 && $saju_point <= 0){
			insert_point($mb_id, $mb_point, '엠투넷 코인동기화', '@platform_consulting', $mb_id, '@기존코인 동기화 :'.date("Y-m-d H:i:s",time()));
		}

        $succ_count++;
    }
}

$g5['title'] = '회원 엑셀일괄등록 결과';
include_once(G5_PATH.'/head.sub.php');
?>

<div class="new_win">
    <h1><?php echo $g5['title']; ?></h1>

    <div class="local_desc01 local_desc">
        <p>회원등록을 완료했습니다.</p>
    </div>

    <dl id="excelfile_result">
        <dt>총회원수</dt>
        <dd><?php echo number_format($total_count); ?></dd>
        <dt>완료건수</dt>
        <dd><?php echo number_format($succ_count); ?></dd>
        <dt>실패건수</dt>
        <dd><?php echo number_format($fail_count); ?></dd>
        <?php if($fail_count > 0) { ?>
        <dt>실패회원코드</dt>
        <dd><?php echo implode(', ', $fail_mb_id); ?></dd>
        <?php } ?>
        <?php if($dup_count > 0) { ?>
        <dt>회원코드중복건수</dt>
        <dd><?php echo number_format($dup_count); ?></dd>
        <dt>중복회원코드</dt>
        <dd><?php echo implode(', ', $dup_mb_id); ?></dd>
        <?php } ?>
    </dl>

    <div class="btn_win01 btn_win">
        <button type="button" onclick="window.close();">창닫기</button>
    </div>

</div>

<?php
include_once(G5_PATH.'/tail.sub.php');