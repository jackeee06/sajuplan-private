<?php
$sub_menu = '900060';
include_once('./_common.php');

auth_check($auth[$sub_menu], "w");

check_admin_token();

if(!$_POST['at_tplcode'])
    alert('템플릿 코드를 입력해 주십시오.');

if(!$_POST['at_msg'])
    alert('템플릿 메시지를 입력해 주십시오.');

$sql_common = "";
if ($w == '' || $w == 'u') { 
    $z = 0;
    $j = 1;
    foreach ($_POST['at_button_type'] as $k => $v) {
        $sql_common .= ", at_button".$j."_name = '".$_POST['at_button_name'][$z]."', at_button".$j."_type = '".$v."', at_button".$j."_url_1 = '".$_POST['at_button_url_1'][$z]."', at_button".$j."_url_2 = '".$_POST['at_button_url_2'][$z]."' ";
        $z++;
        $j++;
    }
} 


if ($w == '') {
 
    $sql = " insert into {$g5['wz_alimtalk_tplmsg_table']} set 
                    at_tplcode  = '$at_tplcode',
                    at_subject  = '$at_subject',
                    at_msg      = '$at_msg'
                    {$sql_common} ";
    sql_query($sql);

} 
else if ($w == 'u') {
    
    // 버튼타입설정 초기화 
    $sql = " update {$g5['wz_alimtalk_tplmsg_table']}
                set at_button1_name = '',
                    at_button1_type = '',
                    at_button1_url_1 = '',
                    at_button1_url_2 = '',
                    at_button2_name = '',
                    at_button2_type = '',
                    at_button2_url_1 = '',
                    at_button2_url_2 = '',
                    at_button3_name = '',
                    at_button3_type = '',
                    at_button3_url_1 = '',
                    at_button3_url_2 = '',
                    at_button4_name = '',
                    at_button4_type = '',
                    at_button4_url_1 = '',
                    at_button4_url_2 = '',
                    at_button5_name = '',
                    at_button5_type = '',
                    at_button5_url_1 = '',
                    at_button5_url_2 = ''
                where at_id = '$at_id' ";
    sql_query($sql);

    $sql = " update {$g5['wz_alimtalk_tplmsg_table']}
                set at_tplcode  = '$at_tplcode',
                    at_subject  = '$at_subject',
                    at_msg      = '$at_msg',
                    at_btn_name = '$at_btn_name',
                    at_btn_url  = '$at_btn_url'
                    {$sql_common}
                where at_id = '$at_id' ";
    sql_query($sql);
}

goto_url('./tpl_msg_list.php');
?>