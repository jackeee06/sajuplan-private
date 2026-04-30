<?php
$sub_menu = "300100";
include_once("./_common.php");
include_once(G5_LIB_PATH."/register.lib.php");
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

if ($w == 'u')
    check_demo();

auth_check_menu($auth, $sub_menu, 'w');

check_admin_token();
if (!function_exists('get_counselor_ready_state')) {
    function get_counselor_ready_state($use_phone, $use_chat) {
        $use_phone = ($use_phone === 'Y') ? 'Y' : 'N';
        $use_chat  = ($use_chat === 'Y')  ? 'Y' : 'N';

        if ($use_phone === 'Y' && $use_chat === 'Y') return 'RDVC'; // 전화+채팅
        if ($use_phone === 'Y' && $use_chat === 'N') return 'IDLE'; // 전화만
        if ($use_phone === 'N' && $use_chat === 'Y') return 'RDCH'; // 채팅만
        return 'ABSE';                                              // 둘 다 꺼짐
    }
}


$mb_no = isset($_POST['mb_no']) ? trim($_POST['mb_no']) : '';


$mb_id = isset($_POST['mb_id']) ? trim($_POST['mb_id']) : '';
$mb_certify_case = isset($_POST['mb_certify_case']) ? preg_replace('/[^0-9a-z_]/i', '', $_POST['mb_certify_case']) : '';
$mb_certify = isset($_POST['mb_certify']) ? preg_replace('/[^0-9a-z_]/i', '', $_POST['mb_certify']) : '';
$mb_zip = isset($_POST['mb_zip']) ? preg_replace('/[^0-9a-z_]/i', '', $_POST['mb_zip']) : '';

$org_source = $_POST["org_source"];

$use_phone = isset($_POST['use_phone']) ? trim($_POST['use_phone']) : 'N';
$use_chat = isset($_POST['use_chat']) ? trim($_POST['use_chat']) : 'N';

// 휴대폰번호 체크
$mb_hp = hyphen_hp_number($_POST['mb_hp']);


$state = $_POST["state"];

//if($mb_hp) {
// $result = exist_mb_hp($mb_hp, $mb_id);
// if ($result)
//  alert($result);
//}

// 인증정보처리
if($mb_certify_case && $mb_certify) {
    $mb_certify = isset($_POST['mb_certify_case']) ? preg_replace('/[^0-9a-z_]/i', '', $_POST['mb_certify_case']) : '';
    $mb_adult = isset($_POST['mb_adult']) ? preg_replace('/[^0-9a-z_]/i', '', $_POST['mb_adult']) : '';
} else {
    $mb_certify = '';
    $mb_adult = 0;
}

$mb_zip1 = substr($mb_zip, 0, 3);
$mb_zip2 = substr($mb_zip, 3);

$mb_email = isset($_POST['mb_email']) ? get_email_address(trim($_POST['mb_email'])) : '';
$mb_nick = isset($_POST['mb_nick']) ? trim(strip_tags($_POST['mb_nick'])) : '';
// 20250711 eun 상담사 추천 순서 작업 시작
$mb_sort = isset($_POST['mb_sort']) ? (int)$_POST['mb_sort'] : (isset($co_row['mb_sort']) ? $co_row['mb_sort'] : 0);
$mb_rising = isset($_POST['mb_rising']) ? (int)$_POST['mb_rising'] : (isset($co_row['mb_rising']) ? $co_row['mb_rising'] : 0);

//if ($msg = valid_mb_nick($mb_nick))     alert($msg, "", true, true);
// 20250711 eun 상담사 추천 순서 작업 시작
$posts = array();
$check_keys = array(
    'mb_name',
    'mb_nick',
    'mb_homepage',
    'mb_tel',
    'mb_addr1',
    'mb_addr2',
    'mb_addr3',
    'mb_addr_jibeon',
    'mb_signature',
    'mb_leave_date',
    'mb_intercept_date',
    'mb_mailling',
    'mb_sms',
    'mb_open',
    'mb_profile',
    'mb_level',
    'mb_sort',
    'mb_rising'
);

for($i=2;$i<=20;$i++){
    $check_keys[] = 'mb_'.$i;
}

foreach( $check_keys as $key ){   
    $posts[$key] = isset($_POST[$key]) ? clean_xss_tags($_POST[$key], 1, 1) : '';
}

$mb_8 = $_POST["mb_8_1"]."|".$_POST["mb_8_2"]."|".$_POST["mb_8_3"];


$mb_memo = isset($_POST['mb_memo']) ? $_POST['mb_memo'] : '';

$use_sql = "";

if($use_phone){
    $use_sql .= " use_phone='".$use_phone."',";
}

if($use_chat){
    $use_sql .= " use_chat='".$use_chat."',";
}

$sql_common = "  mb_name = '{$posts['mb_name']}',
                 mb_nick = '{$mb_nick}',
                 mb_email = '{$mb_email}',
                 mb_homepage = '{$posts['mb_homepage']}',
                 mb_tel = '{$posts['mb_tel']}',
                 mb_hp = '{$mb_hp}',
                 mb_certify = '{$mb_certify}',
                 mb_adult = '{$mb_adult}',
                 mb_zip1 = '$mb_zip1',
                 mb_zip2 = '$mb_zip2',
                 mb_addr1 = '{$posts['mb_addr1']}',
                 mb_addr2 = '{$posts['mb_addr2']}',
                 mb_addr3 = '{$posts['mb_addr3']}',
                 mb_addr_jibeon = '{$posts['mb_addr_jibeon']}',
                 mb_signature = '{$posts['mb_signature']}',
                 mb_leave_date = '{$posts['mb_leave_date']}',
                 mb_intercept_date='{$posts['mb_intercept_date']}',
                 mb_memo = '{$mb_memo}',
                 mb_mailling = '{$posts['mb_mailling']}',
                 mb_sms = '{$posts['mb_sms']}',
                 mb_open = '{$posts['mb_open']}',
                 mb_profile = '{$posts['mb_profile']}',
                 mb_level = '{$posts['mb_level']}',
				 {$use_sql}
		
                 mb_2 = '{$posts['mb_2']}',
                 mb_3 = '{$posts['mb_3']}',
                 mb_4 = '{$posts['mb_4']}',
                 mb_5 = '{$posts['mb_5']}',
                 mb_6 = '{$posts['mb_6']}',
                 mb_7 = '{$posts['mb_7']}',
                 mb_8 = '{$mb_8}',
                 mb_9 = '{$posts['mb_9']}',
                 mb_10 = '{$posts['mb_10']}',
				 mb_11 = '{$posts['mb_11']}',
				 mb_12 = '{$posts['mb_12']}',
				 mb_13 = '{$posts['mb_13']}',
				 mb_14 = '{$posts['mb_14']}',
				 mb_15 = '{$posts['mb_15']}',
				 mb_16 = '{$posts['mb_16']}',
				 mb_17 = '{$posts['mb_17']}',
				 mb_18 = '{$posts['mb_18']}',
				 mb_19 = '{$posts['mb_19']}',
				 mb_20 = '{$posts['mb_20']}',
				 mb_sort = '{$posts['mb_sort']}',
				 mb_rising = '{$posts['mb_rising']}',
				 org_source = '{$org_source}'
				 ";

$chatdectm  = (int)($posts['mb_12'] ?? 30);
$chatdecamt = (int)($posts['mb_13'] ?? 800);
//  20250711 eun 상담사 추천 순서 작업 마감
// ------------------------- 20251212 상담사 상태 최종 결정(정책 반영) -------------------------
$state_post  = isset($state) ? trim($state) : '';
$state_final = $state_post;

// 상담사(mb_level = 5)에만 정책 적용
if ($mb_level == "5") {
    // 전화/채팅 사용 여부 기반 준비 상태
    $ready_state = get_counselor_ready_state($use_phone, $use_chat);

    switch ($state_post) {
        case 'ABSE':
            // 관리자가 명시적으로 부재중으로 선택
            $state_final = 'ABSE';
            break;

        case 'CONN':
        case 'RESV':
        case 'CRDY':
            // 특수 상태는 관리자 수동 지정 그대로 사용 (거의 안 쓸 거지만 그대로 둠)
            $state_final = $state_post;
            break;

        default:
            // 화면에서 '상담가능'을 선택한 경우(값은 IDLE로 들어옴)
            // → 실제 저장은 전화/채팅 토글에 맞춰 RDVC / RDCH / IDLE / ABSE 로 결정
            $state_final = $ready_state;
            break;
    }
} else {
    // 일반 회원은 state 안 쓰거나 의미 없음
    $state_final = $state_post;
}
// -------------------------------------------------------------------






if ($w == '')
{
    $mb = get_member($mb_id);
    if (isset($mb['mb_id']) && $mb['mb_id'])
        alert('이미 존재하는 회원아이디입니다.\\nＩＤ : '.$mb['mb_id'].'\\n이름 : '.$mb['mb_name'].'\\n닉네임 : '.$mb['mb_nick'].'\\n메일 : '.$mb['mb_email']);

    // 닉네임중복체크
//    $sql = " select mb_id, mb_name, mb_nick, mb_email from {$g5['member_table']} where mb_nick = '{$mb_nick}' ";
//    $row = sql_fetch($sql);
//    if (isset($row['mb_id']) && $row['mb_id'])
//        alert('이미 존재하는 닉네임입니다.\\nＩＤ : '.$row['mb_id'].'\\n이름 : '.$row['mb_name'].'\\n닉네임 : '.$row['mb_nick'].'\\n메일 : '.$row['mb_email']);

    // 이메일중복체크
//    $sql = " select mb_id, mb_name, mb_nick, mb_email from {$g5['member_table']} where mb_email = '{$mb_email}' ";
//    $row = sql_fetch($sql);
//    if (isset($row['mb_id']) && $row['mb_id'])
//        alert('이미 존재하는 이메일입니다.\\nＩＤ : '.$row['mb_id'].'\\n이름 : '.$row['mb_name'].'\\n닉네임 : '.$row['mb_nick'].'\\n메일 : '.$row['mb_email']);


    if(!$mb_no){
        sql_query(" insert into {$g5['member_table']} set mb_id = '{$mb_id}', mb_password = '".get_encrypt_string($mb_password)."', mb_datetime = '".G5_TIME_YMDHIS."', mb_ip = '{$_SERVER['REMOTE_ADDR']}', mb_email_certify = '".G5_TIME_YMDHIS."', state='{$state_final}', {$sql_common} ");
    }else{
        sql_query(" insert into {$g5['member_table']} set mb_no='{$mb_no}', mb_id = '{$mb_id}', mb_password = '".get_encrypt_string($mb_password)."', mb_datetime = '".G5_TIME_YMDHIS."', mb_ip = '{$_SERVER['REMOTE_ADDR']}', mb_email_certify = '".G5_TIME_YMDHIS."', state='{$state_final}', {$sql_common} ");
    }



    // 상담사 프로필이 등록되어있으면 해당 필드 수정
    $isql = "select wr_id from g5_write_counselor where mb_id='".$mb_id."'";
    $irow = sql_fetch($isql);
    if($irow["wr_id"]){
        $pusql = "update g5_write_counselor set amt='".$mb_4."', sec='".$mb_5."' where wr_id='".$irow["wr_id"]."'";
        sql_query($pusql);
    }
    // 상담사 프로필이 등록되어있으면 해당 필드 수정끝
    /// 상담사일경우 등록 끝 ///
    if($mb_level=="5"){

        $sql  = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow = sql_fetch($sql);

        if(!$mb_2){
            $mb_2 = "1";
        }

        if(!$posts['mb_nick']){
            $posts['mb_nick'] = $mb_name;
        }
        //	========== 상담사일경우 등록  엠투넷 등록 ================
        $data    = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":'.$chatdectm.', "chatdecamt":'.$chatdecamt.'}';
        $murl    = "csr-mgr";
        $jresult = send_mjson($murl, $data, 'POST');
        
        if($jresult["req_result"]=="00"){ /// 등록성공
            if($jresult["csrid"]){ /// 상담사번호 업데이트
                $usql = "update {$g5['member_table']} set mb_1='".sprintf("%05d",$jresult["csrid"])."' where mb_id='".$mb_id."'";
                @sql_query($usql);

                //set_constate($mb_id, 'IDLE');  /// 상담사 상태 기록을 남긴다
                set_constate($mb_id, $state_final);  /// 상담사 상태 기록을 남긴다
                // 2) AG9(채팅 서버) 상담사 상태도 같이 변경
                //    - 상담사(mb_level == 5)만
                //    - g5_member.mb_1 에 저장된 csrid(예: "00123") 사용

                



                if ($mb_level == "5" && function_exists('set_crs_status_chg')) {
                    // mb_1 은 이미 5자리 문자열로 저장돼 있음 (sprintf("%05d", ...))
                    $row_csr = sql_fetch("SELECT mb_1 FROM {$g5['member_table']} WHERE mb_id = '{$mb_id}'");
                    if (!empty($row_csr['mb_1'])) {
                        $csrid = trim($row_csr['mb_1']);   // 예: "00123"
                        $res = set_crs_status_chg($csrid, $state_final);

                        // 필요하면 에러 체크 (로그만 남기고 화면 에러는 안 띄우는 쪽이 좋음)
                        /*
                        if (!is_array($res) || ($res['req_result'] ?? '') !== '00') {
                            error_log("AG9 CSRSTAT FAIL: mb_id={$mb_id}, csrid={$csrid}, state={$state_final}, res=".print_r($res,true));
                        }
                        */
                    }
                }
            }
        }else{ /// 등록실패
            
            alert('상담사 등록이 실패하였습니다. 다시 등록해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_name'].'\\n닉네임 : '.$mb_3.'\\n메일 : '.$mrow['mb_email']);
        }
    }
    /// 상담사 처리 끝 //

    /// 일반 회원 처리
    if($mb_level=="2" || $mb_level=="3" || $mb_level=="4"){

        $sql = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow=sql_fetch($sql);

        $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'","amt":'.$mb_point.'}';
        $murl1 = "memb-mgr";
        $jresult1 = send_mjson($murl1, $data, 'POST');

        if($jresult1["req_result"]=="00"){ /// 등록성공
            if($jresult1["membid"]){ /// 회원번호 업데이트
                $usql = "update {$g5['member_table']} set mb_1='".sprintf("%06d",$jresult1["membid"])."' where mb_id='".$mb_id."'";
                @sql_query($usql);
            }
        }else{ /// 등록실패
            alert('회원등록이 실패하였습니다. 다시 등록해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_name']);
        }
    }
    /// 일반 회원 처리 //


}
else if ($w == 'u')
{


    $mb = get_member($mb_id);

    




    if($mb_level=="5"){
        if(!$mb_2){
            $mb_2 = "1";
        }
    }


    if (! (isset($mb['mb_id']) && $mb['mb_id']))
        alert('존재하지 않는 회원자료입니다.');

    if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level'])
        alert('자신보다 권한이 높거나 같은 회원은 수정할 수 없습니다.');

    if ($is_admin !== 'super' && is_admin($mb['mb_id']) === 'super' ) {
        alert('최고관리자의 비밀번호를 수정할 수 없습니다.');
    }

    if ($mb_id === $member['mb_id'] && $_POST['mb_level'] != $mb['mb_level'])
        alert($mb['mb_id'].' : 로그인 중인 관리자 레벨은 수정할 수 없습니다.');

    // 닉네임중복체크
//    $sql = " select mb_id, mb_name, mb_nick, mb_email from {$g5['member_table']} where mb_nick = '{$mb_nick}' and mb_id <> '$mb_id' ";
//    $row = sql_fetch($sql);
//    if (isset($row['mb_id']) && $row['mb_id'])
//        alert('이미 존재하는 닉네임입니다.\\nＩＤ : '.$row['mb_id'].'\\n이름 : '.$row['mb_name'].'\\n닉네임 : '.$row['mb_nick'].'\\n메일 : '.$row['mb_email']);

    // 이메일중복체크
//    $sql = " select mb_id, mb_name, mb_nick, mb_email from {$g5['member_table']} where mb_email = '{$mb_email}' and mb_id <> '$mb_id' ";
//    $row = sql_fetch($sql);
//    if (isset($row['mb_id']) && $row['mb_id'])
//        alert('이미 존재하는 이메일입니다.\\nＩＤ : '.$row['mb_id'].'\\n이름 : '.$row['mb_name'].'\\n닉네임 : '.$row['mb_nick'].'\\n메일 : '.$row['mb_email']);

    if ($mb_password)
        $sql_password = " , mb_password = '".get_encrypt_string($mb_password)."' ";
    else
        $sql_password = "";

    if (isset($passive_certify) && $passive_certify)
        $sql_certify = " , mb_email_certify = '".G5_TIME_YMDHIS."' ";
    else
        $sql_certify = "";



     

    ///// 상담사일경우 엠투넷 수정 //////////////

    // 이전 등급이 일반에서 상담사일경우 추가
    if(($mb["mb_level"]=="" || $mb["mb_level"] < "5") && $mb_level == "5"){
        //// 상담사 처리

        $sql = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow=sql_fetch($sql);
        //
        $data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":'.$chatdectm.', "chatdecamt":'.$chatdecamt.'}';

        // $data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":"'.$mb_12.'", "chatdecamt":"'.$mb_13.'"}';
        // $data = '{"csrnm":"'.$mb['mb_nick'].'","state":"'.$state.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'"}';

        $murl = "csr-mgr";
        $jresult = send_mjson($murl, $data, 'POST');



        if($jresult["req_result"]=="00"){ /// 등록성공

            if($jresult["csrid"]){ /// 회원번호 업데이트
                $usql = "update {$g5['member_table']} set mb_1='".sprintf("%05d",$jresult["csrid"])."' where mb_id='".$mb_id."'";
                @sql_query($usql);
            }
            ///// 일반회원 삭제//
            $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'"}';
            $murl1 = "memb-mgr";
            $jresult1 = send_mjson($murl1, $data, 'DELETE', $mrow["mb_1"]);
            /// 일반회원 삭제 끝

        }else{ /// 등록실패
            if($mb['mb_1'] == ""){
                alert('상담사 등록이 실패하였습니다. 다시 등록해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_nick'].'\\n닉네임 : '.$mb_3.'\\n메일 : '.$mrow['mb_email']);
            }
        }

    }elseif($mb["mb_level"]=="5" && $mb_level == "2"){// 이전 등급이 상담사에서 일반일경우 삭제
        //// 상담사 처리

        


        $sql = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow=sql_fetch($sql);

        

        //	/// 상담사일경우 등록  엠투넷 등록//
        $data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":'.$chatdectm.', "chatdecamt":'.$chatdecamt.'}';
//        $data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":"'.$mb_12.'", "chatdecamt":"'.$mb_13.'"}';
        //$data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'"}';

        $murl = "csr-mgr";

        $jresult = send_mjson($murl, $data, 'DELETE', $mrow["mb_1"]);

        if($jresult["req_result"]=="00"){ /// 삭제 성공
            if($mrow["mb_1"]){ /// 회원번호 업데이트
                $usql = "update {$g5['member_table']} set mb_1='' where mb_id='".$mb_id."'";
                @sql_query($usql);
            }

            /// 일반 회원 처리
            // 상담사에서 일반회원으로 왔을때 일반회원 추가
            if($mrow["mb_point"] <= 0){
                $mb_point = 0;
            }else{
                $mb_point = $mrow["mb_point"];
            }
            $murl1 = "memb-mgr";
            $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'","amt":'.$mb_point.'}';
            $jresult1 = send_mjson1($murl1, $data, 'POST');

            if($jresult1["req_result"]=="00"){ /// 등록성공
                if($jresult1["membid"]){ /// 회원번호 업데이트
                    $usql = "update {$g5['member_table']} set mb_1='".sprintf("%06d",$jresult1["membid"])."' where mb_id='".$mb_id."'";
                    @sql_query($usql);
                }
            }else{ /// 등록실패
                //  alert('회원등록이 실패하였습니다. 다시 등록해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_name']);
            }
            /// 일반 회원 처리 끝//

        }else{ /// 등록실패
            // alert('상담사 삭제가 실패하였습니다. 다시 삭제해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_nick'].'\\n닉네임 : '.$mrow['mb_nick'].'\\n메일 : '.$mrow['mb_email']);
        }

    }elseif(($mb["mb_level"]=="5" && $mb_level == "5")){ // 수정
        //// 상담사 처리
        $sql = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow=sql_fetch($sql);

        //	/// 상담사일경우 등록  엠투넷 수정//
        //  $data = '{"csrnm":"'.$posts['mb_nick'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'", "chatdectm":"'.$mb_12.'", "chatdecamt":"'.$mb_13.'"}';
        //  상담사 아이디를 어떻게 ?
        $data = '{"csrnm":"'.$posts['mb_name'].'","state":"'.$state_final.'","sortno":'.$mb_2.',"dtmfno":"'.$mrow["mb_no"].'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag": "'.$mb_6.'", "chatdectm":'.$chatdectm.', "chatdecamt":'.$chatdecamt.'}';

        // if($_SERVER['REMOTE_ADDR'] == '115.93.39.5'){
            // alert("===>".$state_final);
            // exit;
        // }
       
        if($state_final == "IDLE" || $state_final == "RDVC" || $state_final == "RDCH"){
            set_resv_alrm($mb_id, $state_final);
        }

        //$data = '{"csrnm":"'.$mb['mb_nick'].'","state":"'.$state.'","sortno":'.$mb_2.' ,"dtmfno":"'.$mb_no.'", "telno":"'.str_replace("-","",$mb_3).'","dectm":'.$mb_5.',"decamt":'.$mb_4.', "preflag":"'.$mb_6.'"}';
        $murl = "csr-mgr";
        $jresult = send_mjson($murl, $data, 'PUT', $mrow["mb_1"]);
        


        if($jresult["req_result"]=="00"){ /// 수정성공

        }else{ /// 등록실패
            //alert('상담사 수정이 실패하였습니다. 다시 수정해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_nick'].'\\n닉네임 : '.$mrow['mb_nick'].'\\n메일 : '.$mrow['mb_email']);
        }
    }
    ///// 상담사일경우 엠투넷 수정 /////////




    /// 일반 회원 수정 처리
    if(($mb["mb_level"]=="2" || $mb["mb_level"]=="3" || $mb["mb_level"]=="4") &&($mb_level=="2" || $mb_level=="3" || $mb_level=="4")){ // 일반회원 수정
        $sql = "select * from {$g5['member_table']} where mb_id='".$mb_id."'";
        $mrow=sql_fetch($sql);


        if($mrow["mb_1"]==""){ // mnet 회원 번호가 없으면 다시 등록
            $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'","amt":'.$mb_point.'}';
            $murl1 = "memb-mgr";
            $jresult1 = send_mjson($murl1, $data, 'POST');

            //print_r($jresult1);
            //echo "<br>";

            if($jresult1["req_result"]=="00"){ /// 등록성공
                if($jresult1["membid"]){ /// 회원번호 업데이트
                    $usql = "update {$g5['member_table']} set mb_1='".sprintf("%06d",$jresult1["membid"])."' where mb_id='".$mb_id."'";
                    @sql_query($usql);
                }
            }

        }

        //	/// 상담사일경우 등록  엠투넷 등록//
        $data = '{"membnm":"'.$mb_name.'","telno":"'.str_replace("-","",$mb_hp).'","amt":'.$mb_point.'}';
        $murl1 = "memb-mgr";
        $jresult = send_mjson($murl1, $data, 'PUT', $mrow["mb_1"]);

        //print_r($jresult);
        //echo "<br>";
        if($jresult["req_result"]=="00"){ /// 수정성공
        }else{ /// 등록실패

            //echo

            // alert('회원정보 수정에 실패하였습니다. 다시 수정해주세요!\\nＩＤ : '.$mrow['mb_id'].'\\n이름 : '.$mrow['mb_nick'].'\\n닉네임 : '.$mrow['mb_nick'].'\\n메일 : '.$mrow['mb_email']);
        }
    }
    /// 일반 회원 처리 //



    $sql = " update {$g5['member_table']}
                set 
					mb_no='{$mb_no}',
					state='".$state_final."',
					{$sql_common}
                     {$sql_password}
                     {$sql_certify}
                where mb_id = '{$mb_id}' ";

    $rtn = sql_query($sql);
    if($rtn && $state_final){
        // 1) 내부 상태 로그
        set_constate($mb_id, $state_final);  /// 기록을 남긴다

        // 2) AG9 상태도 같이 변경 (상담사만)
        if ($mb_level == "5" && function_exists('set_crs_status_chg')) {
            $row_csr = sql_fetch("SELECT mb_1 FROM {$g5['member_table']} WHERE mb_id = '{$mb_id}'");
            if (!empty($row_csr['mb_1'])) {
                $csrid = trim($row_csr['mb_1']);   // "00123" 이런 형태
                set_crs_status_chg($csrid, $state_final);
            }
        }
    }

    // 상담사 프로필이 등록되어있으면 해당 필드 수정
    $isql = "select wr_id from g5_write_counselor where mb_id='".$mb_id."'";
    $irow = sql_fetch($isql);
    if($irow["wr_id"]){
        $pusql = "update g5_write_counselor set amt='".$mb_4."', sec='".$mb_5."' where wr_id='".$irow["wr_id"]."'";
        sql_query($pusql);
    }
    // 상담사 프로필이 등록되어있으면 해당 필드 수정끝



}
else
    alert('제대로 된 값이 넘어오지 않았습니다.');

if( $w == '' || $w == 'u' ){

    $mb_dir = substr($mb_id,0,2);
    $mb_icon_img = get_mb_icon_name($mb_id).'.gif';

    // 회원 아이콘 삭제
    if (isset($del_mb_icon) && $del_mb_icon)
        @unlink(G5_DATA_PATH.'/member/'.$mb_dir.'/'.$mb_icon_img);

    $image_regex = "/(\.(gif|jpe?g|png))$/i";

    // 아이콘 업로드
    if (isset($_FILES['mb_icon']) && is_uploaded_file($_FILES['mb_icon']['tmp_name'])) {
        if (!preg_match($image_regex, $_FILES['mb_icon']['name'])) {
            alert($_FILES['mb_icon']['name'] . '은(는) 이미지 파일이 아닙니다.');
        }

        if (preg_match($image_regex, $_FILES['mb_icon']['name'])) {
            $mb_icon_dir = G5_DATA_PATH.'/member/'.$mb_dir;
            @mkdir($mb_icon_dir, G5_DIR_PERMISSION);
            @chmod($mb_icon_dir, G5_DIR_PERMISSION);

            $dest_path = $mb_icon_dir.'/'.$mb_icon_img;

            move_uploaded_file($_FILES['mb_icon']['tmp_name'], $dest_path);
            chmod($dest_path, G5_FILE_PERMISSION);

            if (file_exists($dest_path)) {
                $size = @getimagesize($dest_path);
                if ($size[0] > $config['cf_member_icon_width'] || $size[1] > $config['cf_member_icon_height']) {
                    $thumb = null;
                    if($size[2] === 2 || $size[2] === 3) {
                        //jpg 또는 png 파일 적용
                        $thumb = thumbnail($mb_icon_img, $mb_icon_dir, $mb_icon_dir, $config['cf_member_icon_width'], $config['cf_member_icon_height'], true, true);
                        if($thumb) {
                            @unlink($dest_path);
                            rename($mb_icon_dir.'/'.$thumb, $dest_path);
                        }
                    }
                    if( !$thumb ){
                        // 아이콘의 폭 또는 높이가 설정값 보다 크다면 이미 업로드 된 아이콘 삭제
                        @unlink($dest_path);
                    }
                }
            }
        }
    }

    $mb_img_dir = G5_DATA_PATH.'/member_image/';
    if( !is_dir($mb_img_dir) ){
        @mkdir($mb_img_dir, G5_DIR_PERMISSION);
        @chmod($mb_img_dir, G5_DIR_PERMISSION);
    }
    $mb_img_dir .= substr($mb_id,0,2);

    // 회원 이미지 삭제
    if (isset($del_mb_img) && $del_mb_img)
        @unlink($mb_img_dir.'/'.$mb_icon_img);

    // 아이콘 업로드
    if (isset($_FILES['mb_img']) && is_uploaded_file($_FILES['mb_img']['tmp_name'])) {
        if (!preg_match($image_regex, $_FILES['mb_img']['name'])) {
            alert($_FILES['mb_img']['name'] . '은(는) 이미지 파일이 아닙니다.');
        }

        if (preg_match($image_regex, $_FILES['mb_img']['name'])) {
            @mkdir($mb_img_dir, G5_DIR_PERMISSION);
            @chmod($mb_img_dir, G5_DIR_PERMISSION);

            $dest_path = $mb_img_dir.'/'.$mb_icon_img;

            move_uploaded_file($_FILES['mb_img']['tmp_name'], $dest_path);
            chmod($dest_path, G5_FILE_PERMISSION);

            if (file_exists($dest_path)) {
                $size = @getimagesize($dest_path);
                if ($size[0] > $config['cf_member_img_width'] || $size[1] > $config['cf_member_img_height']) {
                    $thumb = null;
                    if($size[2] === 2 || $size[2] === 3) {
                        //jpg 또는 png 파일 적용
                        $thumb = thumbnail($mb_icon_img, $mb_img_dir, $mb_img_dir, $config['cf_member_img_width'], $config['cf_member_img_height'], true, true);
                        if($thumb) {
                            @unlink($dest_path);
                            rename($mb_img_dir.'/'.$thumb, $dest_path);
                        }
                    }
                    if( !$thumb ){
                        // 아이콘의 폭 또는 높이가 설정값 보다 크다면 이미 업로드 된 아이콘 삭제
                        @unlink($dest_path);
                    }
                }
            }
        }
    }
}



////////// 첨부파일 추가 //////////
////////// 첨부파일 추가 //////////

// 파일개수 체크
$file_count   = 0;
$upload_count = count($_FILES['bf_file']['name']);

for ($i=0; $i<$upload_count; $i++) {
    if($_FILES['bf_file']['name'][$i] && is_uploaded_file($_FILES['bf_file']['tmp_name'][$i]))
        $file_count++;
}

if($w == 'u') {
    $file = get_file2($mb_id);
    if($file_count && (int)$file['count'] > 2)
        alert('기존 파일을 삭제하신 후 첨부파일을 2개 이하로 업로드 해주십시오.');
} else {
    if($file_count > 2)
        alert('첨부파일을 2개 이하로 업로드 해주십시오.');
}

// 디렉토리가 없다면 생성합니다. (퍼미션도 변경하구요.)
@mkdir(G5_DATA_PATH.'/member2/'.$mb_id, G5_DIR_PERMISSION);
@chmod(G5_DATA_PATH.'/member2/'.$mb_id, G5_DIR_PERMISSION);

$chars_array = array_merge(range(0,9), range('a','z'), range('A','Z'));

// 가변 파일 업로드
$file_upload_msg = '';
$upload = array();
for ($i=0; $i<count($_FILES['bf_file']['name']); $i++) {
    $upload[$i]['file']     = '';
    $upload[$i]['source']   = '';
    $upload[$i]['filesize'] = 0;
    $upload[$i]['image']    = array();
    $upload[$i]['image'][0] = '';
    $upload[$i]['image'][1] = '';
    $upload[$i]['image'][2] = '';

    // 삭제에 체크가 되어있다면 파일을 삭제합니다.
    if (isset($_POST['bf_file_del'][$i]) && $_POST['bf_file_del'][$i]) {
        $upload[$i]['del_check'] = true;

        $row = sql_fetch(" select bf_file from g5_member_file where mb_id = '{$mb_id}' and bf_no = '{$i}' ");
        @unlink(G5_DATA_PATH.'/member2/'.$mb_id.'/'.$row['bf_file']);
        // 썸네일삭제
        if(preg_match("/\.({$config['cf_image_extension']})$/i", $row['bf_file'])) {
            delete_member_thumbnail($mb_id, $row['bf_file']); // 수정
        }
    }
    else
        $upload[$i]['del_check'] = false;

    $tmp_file  = $_FILES['bf_file']['tmp_name'][$i];
    $filesize  = $_FILES['bf_file']['size'][$i];
    $filename  = $_FILES['bf_file']['name'][$i];
    $filename  = get_safe_filename($filename);

    if (is_uploaded_file($tmp_file)) {


        //=================================================================\
        // 090714
        // 이미지나 플래시 파일에 악성코드를 심어 업로드 하는 경우를 방지
        // 에러메세지는 출력하지 않는다.
        //-----------------------------------------------------------------
        $timg = @getimagesize($tmp_file);
        // image type
        if ( preg_match("/\.({$config['cf_image_extension']})$/i", $filename) ||
            preg_match("/\.({$config['cf_flash_extension']})$/i", $filename) ) {
            if ($timg['2'] < 1 || $timg['2'] > 16)
                continue;
        }
        //=================================================================

        $upload[$i]['image'] = $timg;

        // 4.00.11 - 글답변에서 파일 업로드시 원글의 파일이 삭제되는 오류를 수정
        if ($w == 'u') {
            // 존재하는 파일이 있다면 삭제합니다.
            $row = sql_fetch(" select bf_file from g5_member_file where mb_id = '$mb_id' and bf_no = '$i' ");
            @unlink(G5_DATA_PATH.'/member2/'.$mb_id.'/'.$row['bf_file']);
            // 이미지파일이면 썸네일삭제
            if(preg_match("/\.({$config['cf_image_extension']})$/i", $row['bf_file'])) {
                delete_member_thumbnail($mb_id, $row['bf_file']);
            }
        }

        // 프로그램 원래 파일명
        $upload[$i]['source'] = $filename;
        $upload[$i]['filesize'] = $filesize;

        // 아래의 문자열이 들어간 파일은 -x 를 붙여서 웹경로를 알더라도 실행을 하지 못하도록 함
        $filename = preg_replace("/\.(php|phtm|htm|cgi|pl|exe|jsp|asp|inc)/i", "$0-x", $filename);

        shuffle($chars_array);
        $shuffle = implode('', $chars_array);

        // 첨부파일 첨부시 첨부파일명에 공백이 포함되어 있으면 일부 PC에서 보이지 않거나 다운로드 되지 않는 현상이 있습니다. (길상여의 님 090925)
        $upload[$i]['file'] = abs(ip2long($_SERVER['REMOTE_ADDR'])).'_'.substr($shuffle,0,8).'_'.replace_filename($filename);

        $dest_file = G5_DATA_PATH.'/member2/'.$mb_id.'/'.$upload[$i]['file'];

        // 업로드가 안된다면 에러메세지 출력하고 죽어버립니다.
        $error_code = move_uploaded_file($tmp_file, $dest_file) or die($_FILES['bf_file']['error'][$i]);

        // 올라간 파일의 퍼미션을 변경합니다.
        chmod($dest_file, G5_FILE_PERMISSION);
    }
}

for ($i=0; $i<count($upload); $i++)
{
    if (!get_magic_quotes_gpc()) {
        $upload[$i]['source'] = addslashes($upload[$i]['source']);
    }

    $row = sql_fetch(" select count(*) as cnt from g5_member_file where mb_id = '{$mb_id}' and bf_no = '{$i}' ");
    if ($row['cnt'])
    {
        // 삭제에 체크가 있거나 파일이 있다면 업데이트를 합니다.
        // 그렇지 않다면 내용만 업데이트 합니다.
        if ($upload[$i]['del_check'] || $upload[$i]['file'])
        {
            $sql = " update g5_member_file
                        set bf_source = '{$upload[$i]['source']}',
                             bf_file = '{$upload[$i]['file']}',
                             bf_content = '{$bf_content[$i]}',
                             bf_filesize = '{$upload[$i]['filesize']}',
                             bf_width = '{$upload[$i]['image']['0']}',
                             bf_height = '{$upload[$i]['image']['1']}',
                             bf_type = '{$upload[$i]['image']['2']}',
                             bf_datetime = '".G5_TIME_YMDHIS."'
                      where mb_id = '{$mb_id}'
                                and bf_no = '{$i}' ";
            sql_query($sql);
        }
        else
        {
            $sql = " update g5_member_file
                        set bf_content = '{$bf_content[$i]}'
                        where mb_id = '{$mb_id}'
                                  and bf_no = '{$i}' ";
            sql_query($sql);
        }
    }
    else
    {
        $sql = " insert into g5_member_file
                    set mb_id = '{$mb_id}',
                         bf_no = '{$i}',
                         bf_source = '{$upload[$i]['source']}',
                         bf_file = '{$upload[$i]['file']}',
                         bf_content = '{$bf_content[$i]}',
                         bf_download = 0,
                         bf_filesize = '{$upload[$i]['filesize']}',
                         bf_width = '{$upload[$i]['image']['0']}',
                         bf_height = '{$upload[$i]['image']['1']}',
                         bf_type = '{$upload[$i]['image']['2']}',
                         bf_datetime = '".G5_TIME_YMDHIS."' ";
        sql_query($sql);
    }
}

// 업로드된 파일 내용에서 가장 큰 번호를 얻어 거꾸로 확인해 가면서
// 파일 정보가 없다면 테이블의 내용을 삭제합니다.
$row = sql_fetch(" select max(bf_no) as max_bf_no from g5_member_file where mb_id = '{$mb_id}' ");
for ($i=(int)$row['max_bf_no']; $i>=0; $i--)
{
    $row2 = sql_fetch(" select bf_file from g5_member_file where mb_id = '{$mb_id}' and bf_no = '{$i}' ");

    // 정보가 있다면 빠집니다.
    if ($row2['bf_file']) break;

    // 그렇지 않다면 정보를 삭제합니다.
    sql_query(" delete from g5_member_file where mb_id = '{$mb_id}' and bf_no = '{$i}' ");
}
////////// 첨부파일 추가 //////////
////////// 첨부파일 추가 //////////



//exit;
run_event('admin_member_form_update', $w, $mb_id);
//20250811 eun 상담사 등록 안되는 오류 수정 시작
if($smode=="1"){
    //goto_url('./member_form1.php?'.$qstr.'&amp;w=u&amp;mb_id='.$mb_id, false);
    goto_url('./member_form1.php?'.$qstr.'&w=u&mb_id='.rawurlencode($mb_id), false);
}else{
    goto_url('./member_form.php?'.$qstr.'&amp;w=u&amp;mb_id='.$mb_id, false);
}
//20250811 eun 상담사 등록 안되는 오류 수정 마감
