<?php
$sub_menu = "300100";
include_once('./_common.php');

check_demo();

if (! (isset($_POST['chk']) && is_array($_POST['chk']))) {
    alert($_POST['act_button']." 하실 항목을 하나 이상 체크하세요.");
}

auth_check_menu($auth, $sub_menu, 'w');

check_admin_token();

$mb_datas = array();
$msg = '';
// 20250711 eun 사주플랜 추천 20명 리스트 순서 적용 작업 시작


if ($_POST['act_button'] == "선택수정" || $_POST['act_button'] == "일괄저장") {
    echo '<pre>';
    print_r($_POST);
    echo '</pre>';

    for ($i=0; $i<count($_POST['chk']); $i++)
    {
        // 실제 번호를 넘김
        $k = isset($_POST['chk'][$i]) ? (int) $_POST['chk'][$i] : 0;

        echo "i: $i, k: $k<br>";
        echo "mb_id: " . $_POST['mb_id'][$k] . "<br>";
        echo "mb_sort: " . $_POST['mb_sort'][$k] . "<br>";

        $post_mb_certify = (isset($_POST['mb_certify'][$k]) && $_POST['mb_certify'][$k]) ? clean_xss_tags($_POST['mb_certify'][$k], 1, 1, 20) : '';
        $post_mb_level = isset($_POST['mb_level'][$k]) ? (int) $_POST['mb_level'][$k] : 0;
        $post_mb_intercept_date = (isset($_POST['mb_intercept_date'][$k]) && $_POST['mb_intercept_date'][$k]) ? clean_xss_tags($_POST['mb_intercept_date'][$k], 1, 1, 8) : '';
        $post_mb_mailling = isset($_POST['mb_mailling'][$k]) ? (int) $_POST['mb_mailling'][$k] : 0;
        $post_mb_sms = isset($_POST['mb_sms'][$k]) ? (int) $_POST['mb_sms'][$k] : 0;
        $post_mb_open = isset($_POST['mb_open'][$k]) ? (int) $_POST['mb_open'][$k] : 0;
        $post_mb_sort = isset($_POST['mb_sort'][$k]) ? (int) $_POST['mb_sort'][$k] : 0;
        echo "post_mb_sort: $post_mb_sort <br>";

        $mb_datas[] = $mb = get_member($_POST['mb_id'][$k]);
        print_r($mb);

        if (! (isset($mb['mb_id']) && $mb['mb_id'])) {
            $msg .= $mb['mb_id'].' : 회원자료가 존재하지 않습니다.\\n';
        } else if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level']) {
            $msg .= $mb['mb_id'].' : 자신보다 권한이 높거나 같은 회원은 수정할 수 없습니다.\\n';
        } else if ($member['mb_id'] == $mb['mb_id']) {
            $msg .= $mb['mb_id'].' : 로그인 중인 관리자는 수정할 수 없습니다.\\n';
        } else {
            if($post_mb_certify)
                $mb_adult = isset($_POST['mb_adult'][$k]) ? (int) $_POST['mb_adult'][$k] : 0;
            else
                $mb_adult = 0;

            $ev1 = $_POST["ev_1"];
            $ev2 = $_POST["ev_2"];
            $ev3 = $_POST["ev_3"];

            if(!$ev1){
                $ev1 = "N";
            }
            if(!$ev2){
                $ev2 = "N";
            }
            if(!$ev3){
                $ev3 = "N";
            }
            echo "업데이트 : $mb_id, sort= ";

            $sql = " update {$g5['member_table']}
                        set mb_level = '".$post_mb_level."',
                            mb_intercept_date = '".sql_real_escape_string($post_mb_intercept_date)."',
                            mb_mailling = '".$post_mb_mailling."',
                            mb_sms = '".$post_mb_sms."',
                            mb_open = '".$post_mb_open."',
                            mb_certify = '".sql_real_escape_string($post_mb_certify)."',
							ev_1 = '".$ev1."',
							ev_2 = '".$ev2."',
							ev_3 = '".$ev3."',
                            mb_adult = '{$mb_adult}',
                            mb_sort = '".$post_mb_sort."'
                        where mb_id = '".sql_real_escape_string($mb['mb_id'])."' ";

            echo $sql . "<br>";

            sql_query($sql);
        }
        // echo $sql;
    }
// 20250711 eun 사주플랜 추천 20명 리스트 순서 적용 작업 마감

//} else if ($_POST['act_button'] == "선택삭제") {
} else if ($_POST['act_button'] == "선택삭제" || $_POST['act_button'] == "완전삭제") {

    for ($i=0; $i<count($_POST['chk']); $i++)
    {
        // 실제 번호를 넘김
        $k = isset($_POST['chk'][$i]) ? (int) $_POST['chk'][$i] : 0;

        $mb_datas[] = $mb = get_member($_POST['mb_id'][$k]);

        if (!$mb['mb_id']) {
            $msg .= $mb['mb_id'].' : 회원자료가 존재하지 않습니다.\\n';
        } else if ($member['mb_id'] == $mb['mb_id']) {
            $msg .= $mb['mb_id'].' : 로그인 중인 관리자는 삭제할 수 없습니다.\\n';
        } else if (is_admin($mb['mb_id']) == 'super') {
            $msg .= $mb['mb_id'].' : 최고 관리자는 삭제할 수 없습니다.\\n';
        } else if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level']) {
            $msg .= $mb['mb_id'].' : 자신보다 권한이 높거나 같은 회원은 삭제할 수 없습니다.\\n';
        } else {
            // 회원자료 삭제
            member_delete($mb['mb_id']);

            // 회원자료 완전삭제
            if($_POST['act_button'] == "완전삭제") {
                sql_query(" delete from {$g5['member_table']} where mb_id = '{$mb['mb_id']}' ", false);
            }
        }
    }
}

if ($msg)
    //echo '<script> alert("'.$msg.'"); </script>';
    alert($msg);

run_event('admin_member_list_update', $_POST['act_button'], $mb_datas);

goto_url('./member_list_customer.php?'.$qstr);