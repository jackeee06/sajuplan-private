<?php
include_once('./_common.php');

// 회원이 많을 경우 대비 설정변경
set_time_limit (0);
ini_set('memory_limit', -1);

auth_check_menu($auth, $sub_menu, "w");

##########################################################################################


$is_upload_file = (isset($_FILES['excelfile']['tmp_name']) && $_FILES['excelfile']['tmp_name']) ? 1 : 0;

if( ! $is_upload_file){
    alert("엑셀 파일을 업로드해 주세요.");
}

if($is_upload_file) {
    $file = $_FILES['excelfile']['tmp_name'];


$arr = [];
setlocale(LC_CTYPE, 'ko_KR.utf8');
$file = fopen($file, 'r');

$i = 0;
while (($line = fgetcsv($file)) !== FALSE) {
    if($i>0){
		array_push($arr, $line); 
	}
$i++;
}
fclose($file);




$num_rows = count($arr);



    $dup_mb_id = array();
    $fail_mb_id = array();
    $dup_count = 0;
    $total_count = 0;
    $fail_count = 0;
    $succ_count = 0;


	$i_member = array();

///////////////////////////// 사주문에 회원 입력 ///////////////////////////////////////////////

	//print_r($arr);


    for ($i = 0; $i <= $num_rows; $i++) {
        $total_count++;

        $j = 0;
		$rowData = $arr[$i];
		
        $mb_id            = addslashes($rowData[$j++]);
		$mb_password            = addslashes($rowData[$j++]);
        $mb_name            = addslashes($rowData[$j++]);
        $mb_nick            = addslashes($rowData[$j++]);

        $mb_email            = addslashes($rowData[$j++]);
        $mb_homepage            = addslashes($rowData[$j++]);

        $mb_level            = addslashes($rowData[$j++]);
        $mb_tel            = addslashes($rowData[$j++]);
        $mb_hp            = addslashes($rowData[$j++]);
        $mb_adult            = addslashes($rowData[$j++]);
        $mb_zip            = addslashes($rowData[$j++]);

        $mb_zip = preg_replace('/[^0-9]/', '', $mb_zip);
        $mb_zip1        = isset($mb_zip)           ? substr(trim($mb_zip), 0, 3) : "";
        $mb_zip2        = isset($mb_zip)           ? substr(trim($mb_zip), 3)    : "";

        $mb_addr1            = addslashes($rowData[$j++]);
        $mb_addr2            = addslashes($rowData[$j++]);
        $mb_addr3            = addslashes($rowData[$j++]);
        $mb_addr_jibeon            = addslashes($rowData[$j++]);
        $mb_recommend            = addslashes($rowData[$j++]);
        $mb_mailling            = addslashes($rowData[$j++]);
        $mb_sms            = addslashes($rowData[$j++]);
        $mb_open            = addslashes($rowData[$j++]);
        $mb_1            = addslashes($rowData[$j++]);
        $mb_2            = addslashes($rowData[$j++]);
        $mb_3            = addslashes($rowData[$j++]);
        $mb_4            = addslashes($rowData[$j++]);
        $mb_5            = addslashes($rowData[$j++]);
        $mb_6            = addslashes($rowData[$j++]);
        $mb_7            = addslashes($rowData[$j++]);
        $mb_8            = addslashes($rowData[$j++]);
        $mb_9            = addslashes($rowData[$j++]);
        $mb_10            = addslashes($rowData[$j++]);
		$mb_point            = addslashes(str_replace(",","",$rowData[$j++]));
		if($mb_point=="")$mb_point = 0;
		$mb_time            = addslashes($rowData[$j++]);
		$mb_birth = addslashes($rowData[$j++]);
		$mb_11 = addslashes($rowData[$j++]);
		$mb_datetime = addslashes($rowData[$j++]);
		$mb_leave_date            = addslashes($rowData[$j++]);
		$org_source            = addslashes($rowData[$j++]);
	

	$mb_nick = iconv("EUC-KR", "UTF-8",$mb_nick);
	$mb_name = iconv("EUC-KR", "UTF-8",$mb_name);
	$mb_email = iconv("EUC-KR", "UTF-8",$mb_email);

	$mb_addr1 = iconv("EUC-KR", "UTF-8",$mb_addr1);
	$mb_addr2 = iconv("EUC-KR", "UTF-8",$mb_addr2);
	$mb_addr3 = iconv("EUC-KR", "UTF-8",$mb_addr3);

	$mb_11 = iconv("EUC-KR", "UTF-8",$mb_11);

	$mb_leave_date = trim(iconv("EUC-KR", "UTF-8",$mb_leave_date));
	$mb_datetime = iconv("EUC-KR", "UTF-8",$mb_datetime);
	$org_source = iconv("EUC-KR", "UTF-8",$org_source);


	if($mb_leave_date=="이용"){
		$mb_leave_date = '';
	}else{
		$mb_leave_date = date("Ymd",time());
	}
		
        // 휴대폰번호 체크
        $mb_hp = hyphen_hp_number($mb_hp);

        if(!$mb_id) {
            $fail_count++;
            continue;
        }


        // mb_id 중복체크
        $sql2 = " select count(*) as cnt from {$g5['member_table']} where mb_id = '$mb_id'";
        $row2 = sql_fetch($sql2);
        if($row2['cnt']) {
			//echo $sql2;
			//echo "<br>";
            $fail_mb_id[] = $mb_id;
            $dup_mb_id[] = $mb_id;

			echo "중복오류 :". $mb_id;
			echo "<br>";

            $dup_count++;
            $fail_count++;
            continue;
        }

        $sql_certify = '';
        $sql_certify .= " , mb_hp = '{$mb_hp}' ";
        $sql_certify .= " , mb_certify = '' ";
        $sql_certify .= " , mb_adult = 0 ";
        $sql_certify .= " , mb_birth = '{$mb_birth}' ";
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
                         mb_ip = '{$_SERVER['REMOTE_ADDR']}',
                         mb_level = '{$mb_level}',
                         mb_recommend = '{$mb_recommend}',
                         mb_login_ip = '{$_SERVER['REMOTE_ADDR']}',
                         mb_open = '{$mb_open}',
                         mb_open_date = '".G5_TIME_YMD."',

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
						 mb_time = '{$mb_time}',
						 mb_leave_date = '{$mb_leave_date}',
						 mb_datetime = '{$mb_datetime}',
						 mb_mailling = '1',
						 mb_sms = '1',
						 org_source='{$org_source}'
                         {$sql_certify} ";

	

	 //echo $sql;
	 //echo "<br><Br>";
   
	  $rtn = sql_query($sql);
		if($rtn){


			 $i_member[$i]["mb_id"] = $mb_id;
			 $i_member[$i]["mb_password"] = get_encrypt_string($mb_password);
			 $i_member[$i]["mb_name"] = $mb_id;
			 $i_member[$i]["mb_name"] = $mb_name;
			 $i_member[$i]["mb_nick"] = $mb_nick;
			 $i_member[$i]["mb_nick_date"] = G5_TIME_YMD;
			 $i_member[$i]["mb_email"] = $mb_email;
			 $i_member[$i]["mb_homepage"] = $mb_homepage;
			 $i_member[$i]["mb_tel"] = $mb_tel;
			 $i_member[$i]["mb_zip1"] = $mb_zip1;
			 $i_member[$i]["mb_zip2"] = $mb_zip2;
			 $i_member[$i]["mb_addr1"] = $mb_addr1;
			 $i_member[$i]["mb_addr2"] = $mb_addr2;
			 $i_member[$i]["mb_addr3"] = $mb_addr3;
			 $i_member[$i]["mb_addr_jibeon"] = $mb_addr_jibeon;
			 $i_member[$i]["mb_ip"] = $_SERVER['REMOTE_ADDR'];
			 $i_member[$i]["mb_level"] = $mb_level;
			 $i_member[$i]["mb_recommend"] = $mb_recommend;
			 $i_member[$i]["mb_login_ip"] = $_SERVER['REMOTE_ADDR'];
			 $i_member[$i]["mb_open"] = $mb_open;
			 $i_member[$i]["mb_open_date"] = G5_TIME_YMD;
			 $i_member[$i]["mb_2"] = $mb_2;
			 $i_member[$i]["mb_3"] = $mb_3;
			 $i_member[$i]["mb_4"] = $mb_4;
			 $i_member[$i]["mb_5"] = $mb_5;
			 $i_member[$i]["mb_6"] = $mb_6;
			 $i_member[$i]["mb_7"] = $mb_7;
			 $i_member[$i]["mb_8"] = $mb_8;
			 $i_member[$i]["mb_9"] = $mb_9;
			 $i_member[$i]["mb_10"] = $mb_10;

			 $i_member[$i]["mb_point"] = $mb_point;
			 $i_member[$i]["mb_time"] = $mb_time;
			 $i_member[$i]["mb_leave_date"] = $mb_leave_date;
			 $i_member[$i]["mb_mailling"] = "1";
			 $i_member[$i]["mb_sms"] = "1";
			 $i_member[$i]["org_source"] = "1";
			 $i_member[$i]["mb_mailling"] = $org_source;
			 $i_member[$i]["mb_hp"] =$mb_hp;
			 $i_member[$i]["mb_certify"] = "";
			 $i_member[$i]["mb_adult"] = "0";
			 $i_member[$i]["mb_birth"] = $mb_birth;
			 $i_member[$i]["mb_sex"] = "";


			 /// 회원 포인트가 있으면? 포인트 테이블에 넣어준다. 엠투넷 첫 동기화작업 때문에
			$saju_point = 0;
			$saju_point = get_point_sum($mb_id);
			if($mb_point > 0){
				insert_point($mb_id, $mb_point, '엠투넷 코인동기화', '@platform_consulting', $mb_id, '@기존코인 동기화 :'.date("Y-m-d H:i:s",time()));
			}
		}
        $succ_count++;	
	}


    //print_r($i_member);
	//exit;
	echo "<br><br>";


	$json_data = "";

	if(count($i_member)>0){
		$json_data = '{"list":[';
		
		for($i=0;$i<count($i_member);$i++){
			$sql = "select * from {$g5['member_table']} where mb_id='".$i_member[$i]["mb_id"]."'";
			$mrow=sql_fetch($sql);
			if($mrow["mb_name"] && $mrow["mb_hp"]){
				$json_data .= '{"membnm":"'.$mrow["mb_name"].'","telno":"'.str_replace("-","",$mrow["mb_hp"]).'","amt":'.str_replace(",","",$i_member[$i]["mb_point"]).'},';
			}
		}
		unset($mrow);
		$json_data = rtrim($json_data,',');
		$json_data .= ']}';

		//print_r($json_data);
		//echo "<br><br>";

		$murl1 = "memb-mgr";
		$jresult1 = send_mjson($murl1, $json_data, 'POST');				
		
			if(count($jresult1["list"])>0){ /// 등록성공
					
						
				for($j=0;$j<count($jresult1["list"]);$j++){
						
						$imfo = array();

						$msql = "select * from {$g5['member_table']} where replace(mb_hp,'-','')='".$jresult1["list"][$j]["telno"]."'";
						//echo $msql;
						//echo "<br>";
						$imfo = sql_fetch($msql);

						if($imfo["mb_id"]){
							$usql = "update {$g5['member_table']} set mb_1='".$jresult1["list"][$j]["membid"]."' where mb_id='".$imfo["mb_id"]."'";
							@sql_query($usql);
								
						}

				}
			}else{ /// 등록실패
				print_r($json_data);
				echo "<br><br>";
				echo "mtonet 등록실패";
				echo "<br>";
				print_r($jresult1);
			}	
	}

	unset($json_data);
	unset($i_member);
	unset($imfo);
	unset($rowData);


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

<?
ob_flush();
ob_end_clean();

?>