<?php
    include_once('./_common.php');
    $result = true;
    $msg    = "";
    $data   = [];

    // 1. 발급 받는 쿠폰 번호가 있는지?
    $cp_id = isset($_POST['cp_id']) ? trim($_POST['cp_id']) : '';
    if(!$cp_id) {

        $result = false;
        $msg = '쿠폰 번호가 없습니다.';
        
    } else {

        $sql1 = "select * from {$g5['g5_shop_coupon_zone_table']} where cp_id = '{$cp_id}'";
        $row1 = sql_fetch($sql1);

        if(!$row1) {

            $result = false;
            $msg = '존재하지 않는 쿠폰 번호입니다.';

        } else {
            // 2. 발급 받는 쿠폰의 기간이 지나지 않았는지?
            $now = date('Y-m-d H:i:s');

            if($row1['cz_start'] && $now < $row1['cz_start']) {

                $result = false;
                $msg = '쿠폰 발급 시작일이 아직 되지 않았습니다.';

            } else if($row1['cz_end'] && $now > $row1['cz_end']) {

                $result = false;
                $msg = '쿠폰 기간이 만료되었습니다.';

            } else { //여기서 추가 예외처리가 필요

                // 3. 해당 쿠폰의 ids에 포함된 회원만 발급 가능
                $ids = isset($row1['ids']) ? trim($row1['ids']) : '';
                if($ids) {
                    // 'allmember'이면 모든 회원 허용
                    if($ids === 'allmember') {
                        // 아무것도 하지 않음
                    } else {
                        $ids_arr = array_map('trim', explode(',', $ids));
                        if(!in_array($member['mb_id'], $ids_arr)) {
                            $result = false;
                            $msg = '해당 쿠폰을 이용할 수 없는 회원입니다.';
                            echo json_encode([
                                'result' => $result,
                                'msg'    => $msg,
                                'data'   => $data
                            ]);
                            exit;
                        }
                    }
                }

                $query = "
                select 
                 count(cp_no) as cnt
                from
                 g5_shop_coupon
                where
                 mb_id = '{$member['mb_id']}'
                and  
                 cp_id = '{$cp_id}'
                ";
                $gsc_row = sql_fetch($query);

                if((int)$gsc_row['cnt'] > 0){

                    $result = false;
                    $msg    = '이미 등록된 쿠폰 입니다.';

                }else{ //등록 처리하기.

                    $result = true;
                    $msg    = '쿠폰이 등록 되었습니다.';
                    $sql_common_shop_coupon = "
                        cp_id       = '{$cp_id}',
                        cp_subject  = '{$row1['cz_subject']}',
                        cp_method   = '{$row1['cp_method']}',
                        cp_target   = '{$row1['cp_target']}',
                        mb_id       = '{$member['mb_id']}',
                        cz_id       = '{$row1['cz_id']}',
                        cp_start    = '{$row1['cz_start']}',
                        cp_end      = '{$row1['cz_end']}',
                        cp_price    = '{$row1['cz_point']}',
                        cp_type     = '{$row1['cp_type']}',
                        cp_trunc    = '{$row1['cp_trunc']}',
                        cp_minimum  = '{$row1['cp_minimum']}',
                        cp_maximum  = '{$row1['cp_maximum']}',
                        cz_type     = '{$row1['cz_type']}',
                        cp_show     = 'Y',
                        cp_datetime = '{$now_date}'
                    ";
                    $sql = "INSERT INTO g5_shop_coupon set $sql_common_shop_coupon";
                    sql_query($sql);
                    // 포인트 지급 처리
                    insert_point($member['mb_id'], (int)$row1['cz_point'], "쿠폰 $cp_id 발급");
                    


                }
                
            }
        }
    }
    // 이미지 

    echo json_encode([
        'result' => $result,
        'msg'    => $msg,
        'data'   => $data
    ]);

?>