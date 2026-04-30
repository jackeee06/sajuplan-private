<?php
include_once('../common.php');
include_once($_SERVER["DOCUMENT_ROOT"].'/lib/latest.lib.php');
#######################################

	
		// 1) DB에서 실시간 데이터 조회
            $rst = sql_fetch("select count(*) as ct from g5_write_counselor a left join g5_member b on(a.mb_id=b.mb_id) 
                    where b.mb_level='5' and b.mb_leave_date='' and a.wr_is_comment = 0 and b.state='IDLE'");


            // 2) JSON 형태로 내보내기
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
              'ct'    => (int)$rst['ct']]);
            exit;

//<!--20250724 eun 매인 대기 상담사, 연결시간 작업 마감-->
