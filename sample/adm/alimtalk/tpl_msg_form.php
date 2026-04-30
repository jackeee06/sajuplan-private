<?php
$sub_menu = '900060';
include_once('./_common.php');

auth_check($auth[$sub_menu], "w");

$g5['title'] = '알림톡 템플릿 등록/수정'; 

if ($w == 'u') {
    $html_title = '알림톡 템플릿 수정';

    $sql = " select * from {$g5['wz_alimtalk_tplmsg_table']} where at_id = '$at_id' ";
    $at = sql_fetch($sql);
    if (!$at['at_id']) alert('등록된 자료가 없습니다.');
}
else {
    $html_title = '알림톡 템플릿 입력';
}

include_once (G5_ADMIN_PATH.'/admin.head.php');
?>

<style>
.wz_tbl_1,.wz_tbl_1 th,.wz_tbl_1 td{border:0;}
.wz_tbl_1{width:100%;text-align:center;margin: 7px 0 0px;}
.wz_tbl_1 table {clear:both;width:100%;border-collapse:collapse;border-spacing:0;}
.wz_tbl_1 tbody, .wz_tbl_1 tr, .wz_tbl_1 td {vertical-align:middle}
.wz_tbl_1 caption{display:none}
.wz_tbl_1 th{padding:10px 0;border:2px solid #dcdcdc;color:#666;text-align:center;font-weight:bold;background-color: #fbfbfb;}
.wz_tbl_1 td{padding:7px 0;border:1px solid #e5e5e5;color:#4c4c4c;text-align:center;}
.wz_tbl_1 th span.last:after {border:none;}
.wz_tbl_1 td .numberic {text-align:right;padding-right:4px;}
</style>

<form name="fcouponform" action="./tpl_msg_form_update.php" method="post" onsubmit="return form_check(this);">
<input type="hidden" name="w" value="<?php echo $w; ?>">
<input type="hidden" name="at_id" value="<?php echo $at_id; ?>">
<input type="hidden" name="sst" value="<?php echo $sst; ?>">
<input type="hidden" name="sod" value="<?php echo $sod; ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
<input type="hidden" name="stx" value="<?php echo $stx; ?>">
<input type="hidden" name="page" value="<?php echo $page;?>">

<div class="tbl_frm01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col class="grid_4">
        <col>
    </colgroup>
    <tbody>
    <tr>
        <th scope="row"><label for="at_tplcode">템플릿코드</label></th>
        <td colspan="5">
            <?php echo help("템플릿 코드는 반드시 비즈엠에 등록이 되어야 합니다."); ?>
            <input type="text" name="at_tplcode" value="<?php echo stripslashes($at['at_tplcode']); ?>" id="at_tplcode" required class="required frm_input" size="30">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="at_subject">템플릿명</label></th>
        <td colspan="5">
           <input type="text" name="at_subject" value="<?php echo stripslashes($at['at_subject']); ?>" id="at_subject" required class="required frm_input" size="50">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="at_msg">템플릿 내용</label></th>
        <td colspan="5">
            <?php echo help("템플릿 내용은 반드시 비즈엠에 등록이 되어 있어야 하며 검수완료된 내용만 발송이 가능합니다."); ?>
            <?php echo help("사용가능 치환코드 : #{이름}, #{택배회사}, #{운송장번호}, #{입금액}, #{입금계좌}, #{주문번호}, #{주문금액}"); ?>
            <textarea name="at_msg" id="at_msg" required class="required"><?php echo $at['at_msg']; ?></textarea>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="">버튼타입</label></th>
        <td>
            <table cellspacing="0" border="1" class="wz_tbl_1" id="tbl-clr-list" style="width:100%;">
                <caption></caption>
                <colgroup>
                    <col width="10%"/>
                    <col width="20%"/>
                    <col width="20%"/>
                    <col width="40%"/>
                    <col width="10%"/>
                </colgroup>
                <thead>
                <tr>
                    <th scope="row">no</th>
                    <th scope="row">버튼타입</th>
                    <th scope="row">버튼명</th>
                    <th scope="row">버튼링크</th>
                    <th scope="row"><a href="#none" class="btn_frmline add-clr-tr">추가</a></th>
                </tr>
                </thead>
                <tbody>
                <?php
                $j = 0;
                for ($z = 1; $z <= 5; $z++) { 

                    if (!$at['at_button'.$z.'_type'])
                        continue;
                    ?>
                    <tr>
                        <td>
                            <span class="no"></span>
                        </td>
                        <td>
                            <select name="at_button_type[]" class="at-button-type">
                                <option value="DS" <?php echo $at['at_button'.$z.'_type'] == 'DS' ? 'selected=selected' : '';?>>배송조회</option>
                                <option value="WL" <?php echo $at['at_button'.$z.'_type'] == 'WL' ? 'selected=selected' : '';?>>웹링크</option>
                                <option value="AL" <?php echo $at['at_button'.$z.'_type'] == 'AL' ? 'selected=selected' : '';?>>앱링크</option>
                                <option value="BK" <?php echo $at['at_button'.$z.'_type'] == 'BK' ? 'selected=selected' : '';?>>봇키워드</option>
                                <option value="MD" <?php echo $at['at_button'.$z.'_type'] == 'MD' ? 'selected=selected' : '';?>>메시지전달</option>
                            </select>
                        </td>
                        <td><input type="text" name="at_button_name[]" value="<?php echo $at['at_button'.$z.'_name'];?>" required class="required frm_input" style="width:90%;" maxlength="150" /></td>
                        <td>
                            <span class="at-button-link">
                            <?php
                            switch ($at['at_button'.$z.'_type']) {
                                case 'DS':
                                    echo '알림톡 메시지 파싱을 통해 배송조회 카카오검색 페이지 링크가 자동 생성<input type="hidden" name="at_button_url_1[]"/><input type="hidden" name="at_button_url_2[]"/>';
                                break;
                                case 'WL':
                                    echo 'Mobile : <input type="text" name="at_button_url_1[]" value="'.$at['at_button'.$z.'_url_1'].'" required class="required frm_input" style="width:200px;" maxlength="150" /><br />PC(선택) : <input type="text" name="at_button_url_2[]" value="'.$at['at_button'.$z.'_url_2'].'" class="frm_input" style="width:200px;" maxlength="150" />';
                                break;
                                case 'AL':
                                    echo 'Android : <input type="text" name="at_button_url_1[]" value="'.$at['at_button'.$z.'_url_1'].'" required class="required frm_input" style="width:200px;" maxlength="150" /><br />iOS : <input type="text" name="at_button_url_2[]" value="'.$at['at_button'.$z.'_url_2'].'" required class="required frm_input" style="width:200px;" maxlength="150" />';
                                break;
                                default:
                                    echo '<input type="hidden" name="at_button_url_1[]"/><input type="hidden" name="at_button_url_2[]"/>';
                                break;
                            }
                            ?>
                            </span>
                        </td>
                        <td><a href="#none" class="btn_frmline del-clr-tr">삭제</a></td>
                    </tr>

                    <?php
                    $j++;
                }

                if (!$j) {
                    ?>
                    <tr class="clr-empty">
                        <td colspan="5">추가버튼을 클릭해서 추가해주세요.</td>
                    </tr>
                    <?php
                }
                ?>
                </tbody>
            </table>   
        </td>
    </tr>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <input type="submit" value="확인" class="btn_submi btn btn_01" accesskey="s" >
    <a href="./tpl_msg_list.php?<?php echo $qstr; ?>" class="btn_02 btn">목록</a>
</div>

</form>

<script>
function form_check(f)
{
    return true;
}
$(function() {
    $(document).on('click', '.add-clr-tr', function() {
        $('.clr-empty').remove();
        tbl_clr_tr_add();
    });
    $(document).on('click', '.del-clr-tr', function() {

        $(this).closest('tr').remove();
        var tr_cnt = $('#tbl-clr-list tbody tr').length;
        if (tr_cnt == 0) { 
            $('#tbl-clr-list').append('<tr class="clr-empty"><td colspan="5">추가버튼을 클릭해서 추가해주세요.</td></tr>');
        }
        tbl_numbering();
    });
    $(document).on('change', '.at-button-type', function() { // 버튼타입선택
        var button_type = $(this).val();
        var $el = $(this).closest('tr');
        switch (button_type) {
            case 'DS':
                $el.find('.at-button-link').html('알림톡 메시지 파싱을 통해 배송조회 카카오검색 페이지 링크가 자동 생성<input type="hidden" name="at_button_url_1[]"/><input type="hidden" name="at_button_url_2[]"/>');
            break;
            case 'WL':
                $el.find('.at-button-link').html('Mobile : <input type="text" name="at_button_url_1[]" required class="required frm_input" style="width:200px;" maxlength="150" /><br />PC(선택) : <input type="text" name="at_button_url_2[]" class="frm_input" style="width:200px;" maxlength="150" />');
            break;
            case 'AL':
                $el.find('.at-button-link').html('Android : <input type="text" name="at_button_url_1[]" required class="required frm_input" style="width:200px;" maxlength="150" /><br />iOS : <input type="text" name="at_button_url_2[]" required class="required frm_input" style="width:200px;" maxlength="150" />');
            break;
            default:
                $el.find('.at-button-link').html('<input type="hidden" name="at_button_url_1[]"/><input type="hidden" name="at_button_url_2[]"/>');
            break;
        }
    });
    tbl_numbering();

});
function tbl_clr_tr_add() {

    var tr_cnt = $('#tbl-clr-list tbody tr').length;
    if (tr_cnt >= 5) {
        alert("5개까지만 등록이 가능합니다.");
        return;
    }
    
    var tbl_tr_html = '';
        tbl_tr_html += '<tr>';
        tbl_tr_html += '    <td><span class="no"></span></td>';
        tbl_tr_html += '    <td>';
        tbl_tr_html += '    <select name="at_button_type[]" class="at-button-type">';
        tbl_tr_html += '        <option value="">선택</option>';
        tbl_tr_html += '        <option value="DS">배송조회</option>';
        tbl_tr_html += '        <option value="WL">웹링크</option>';
        tbl_tr_html += '        <option value="AL">앱링크</option>';
        tbl_tr_html += '        <option value="BK">봇키워드</option>';
        tbl_tr_html += '        <option value="MD">메시지전달</option>';
        tbl_tr_html += '    </select>';
        tbl_tr_html += '    </td>';
        tbl_tr_html += '    <td><input type="text" name="at_button_name[]" required class="required frm_input" style="width:90%;" maxlength="150" /></td>';
        tbl_tr_html += '    <td><span class="at-button-link"></span></td>';
        tbl_tr_html += '    <td><a href="#none" class="btn_frmline del-clr-tr">삭제</a></td>';
        tbl_tr_html += '</tr>';

    $('#tbl-clr-list').append(tbl_tr_html);
    tbl_numbering();
}
function tbl_numbering() {

    var i = 1;
    $('.no').each(
        function(){
            $(this).text(i);
            i++;
        }
        
    )
}
</script>

<?php
include_once (G5_ADMIN_PATH.'/admin.tail.php');
?>