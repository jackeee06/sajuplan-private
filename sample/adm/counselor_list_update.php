<?php
$sub_menu = "350100";
include_once('./_common.php');

check_demo();

auth_check_menu($auth, $sub_menu, 'w');
check_admin_token();

$mb_datas = array();
$msg = '';


if (!(isset($_POST['chk']) && is_array($_POST['chk']))) {
    alert($_POST['act_button'] . " 하실 항목을 하나 이상 체크하세요.");
}


$ev_1 = $_POST["ev_1"];
$ev_2 = $_POST["ev_2"];
$ev_3 = $_POST["ev_3"];
$ev_4 = $_POST["ev_4"];
// 20250714 eun 선택 수정 작업 시작
if ($_POST['act_button'] == "일괄저장") {

    for ($i = 0; $i < count($_POST['chk']); $i++) {
        // 실제 번호를 넘김
        $k = isset($_POST['chk'][$i]) ? (int)$_POST['chk'][$i] : 0;

        $mb_id = $_POST['mb_id'][$k];

        $post_level = isset($_POST['mb_level'][$k]) ? (int)$_POST['mb_level'][$k] : 0;
        $post_sort = isset($_POST['mb_sort'][$k]) ? (int)$_POST['mb_sort'][$k] : 0;
        $post_rising = isset($_POST['mb_rising'][$k]) ? (int)$_POST['mb_rising'][$k] : 0;

        $ev1 = $ev_1[$k];
        $ev2 = $ev_2[$k];
        $ev3 = $ev_3[$k];
        $ev4 = $ev_4[$k];

        $c = "";
        $c2 = "";
        $c3 = "";
        $c4 = "";


        if (!$ev1) {
            $c = "N";
        } else {
            $c = $ev1;
        }
        if (!$ev2) {
            $c2 = "N";
        } else {
            $c2 = $ev2;
        }
        if (!$ev3) {
            $c3 = "N";
        } else {
            $c3 = $ev3;
        }
        if (!$ev4) {
            $c4 = "N";
        } else {
            $c4 = $ev4;
        }


        $sql = " update {$g5['member_table']}
                        set 	ev_1 = '" . $c . "',
							ev_2 = '" . $c2 . "',
							ev_3 = '" . $c3 . "',
							ev_4 = '" . $c4 . "',
							mb_level = '" . sql_real_escape_string($post_level) . "',
							mb_sort = '" . sql_real_escape_string($post_sort) . "',
							mb_rising = '" . sql_real_escape_string($post_rising) . "'
                        where mb_id = '" . sql_real_escape_string($mb_id) . "' ";

        //echo $sql;
        //echo "<br>";


        sql_query($sql);
    }
// 20250714 eun 선택 수정 작업 마감

} else if ($_POST['act_button'] == "선택삭제" || $_POST['act_button'] == "완전삭제") {

    for ($i = 0; $i < count($_POST['chk']); $i++) {
        // 실제 번호를 넘김
        $k = isset($_POST['chk'][$i]) ? (int)$_POST['chk'][$i] : 0;

        $mb_datas[] = $mb = get_member($_POST['mb_id'][$k]);

        if (!$mb['mb_id']) {
            $msg .= $mb['mb_id'] . ' : 회원자료가 존재하지 않습니다.\\n';
        } else if ($member['mb_id'] == $mb['mb_id']) {
            $msg .= $mb['mb_id'] . ' : 로그인 중인 관리자는 삭제 할 수 없습니다.\\n';
        } else if (is_admin($mb['mb_id']) == 'super') {
            $msg .= $mb['mb_id'] . ' : 최고 관리자는 삭제할 수 없습니다.\\n';
        } else if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level']) {
            $msg .= $mb['mb_id'] . ' : 자신보다 권한이 높거나 같은 회원은 삭제할 수 없습니다.\\n';
        } else {

            //echo $mb["mb_id"];
            //echo "<br>";
            // 회원자료 삭제
            member_delete($mb['mb_id']);

            // 회원자료 완전삭제
            if ($_POST['act_button'] == "완전삭제") {
                sql_query(" delete from {$g5['member_table']} where mb_id = '{$mb['mb_id']}' ", false);
            }
        }
    }
}


//exit;

if ($msg)
    alert($msg);

goto_url('./counselor_list.php?' . $qstr);