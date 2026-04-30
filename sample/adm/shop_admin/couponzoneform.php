<?php
$sub_menu = '350520';
include_once('./_common.php');

$cz_id = isset($_REQUEST['cz_id']) ? (int) $_REQUEST['cz_id'] : 0;
$cp = array(
'cp_method'=>'',
'cz_subject'=>'',
'cp_target'=>'',
'cp_price'=>'',
'cp_trunc'=>'',
'cp_type'=>'',
'mb_id'=>'',
'cz_type'=>'',
'cz_point'=>'',
'cp_price'=>'',
'cz_file'=>'',
'cp_minimum'=>'',
'cp_maximum'=>'',
);

auth_check_menu($auth, $sub_menu, "w");


$g5['title'] = '쿠폰존 쿠폰관리';

if ($w == 'u') {
    $html_title = '쿠폰 수정';

    $sql = " select * from {$g5['g5_shop_coupon_zone_table']} where cz_id = '$cz_id' ";
    $cp = sql_fetch($sql);
    if (!$cp['cz_id']) alert('등록된 자료가 없습니다.');
}
else
{
    $html_title = '쿠폰 입력';
    $cp['cz_start'] = G5_TIME_YMD;
    $cp['cz_end'] = date('Y-m-d', (G5_SERVER_TIME + 86400 * 15));
    $cp['cz_period'] = 15;
}

if($cp['cp_method'] == 1) {
    $cp_target_label = '적용분류';
    $cp_target_btn = '분류검색';
} else {
    $cp_target_label = '적용상품';
    $cp_target_btn = '상품검색';
}

include_once (G5_ADMIN_PATH.'/admin.head.php');
include_once(G5_PLUGIN_PATH.'/jquery-ui/datepicker.php');
?>

<form name="fcouponform" action="./couponzoneformupdate.php" method="post" enctype="multipart/form-data" onsubmit="return form_check(this);">
<input type="hidden" name="w" value="<?php echo $w; ?>">
<input type="hidden" name="cz_id" value="<?php echo $cz_id; ?>">
<input type="hidden" name="stx" value="<?php echo $stx; ?>">
<input type="hidden" name="page" value="<?php echo $page;?>">

<style>
.gray_bg {
    background-color: #FC0 !important;
}

.tbl_frm01 textarea { min-height:50px !important;}
</style>

<div class="tbl_frm01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col class="grid_4">
        <col>
    </colgroup>
    <tbody>
    <tr>

        <th scope="row">
            <label for="cz_type">발행쿠폰타입</label>
        </th>

        <td>
           <?php 
             echo help("발행 쿠폰의 타입을 설정합니다.<br>포인트쿠폰은 회원의 포인트를 쿠폰으로 교환하는 쿠폰이며 다운로드 쿠폰은 회원이 다운로드하여 사용할 수 있는 쿠폰입니다.
             <br>코드입력쿠폰의 경우엔 사용자가 쿠폰코드 입력시 쿠폰함에 발급됩니다.<br> 쿠폰코드는 알림톡으로 전송됩니다.
             "); 
           ?>
           <select name="cz_type" id="cz_type"
             <?php
             if($w == "u"){
             ?>
              disabled
             <?php
             }
             ?>
           >
                <!-- 
                <option value="0"<?php echo get_selected('0', $cp['cz_type']); ?>>다운로드쿠폰</option> 
                -->
				<option value="2"<?php echo get_selected('2', $cp['cz_type']); ?>>포인트증가 쿠폰</option>
                <option value="3"<?php echo get_selected('3', $cp['cz_type']); ?>>코드입력 쿠폰(특정타겟)</option>
           </select>
        </td>
    </tr>
    
    
    
    <tr>
        <th scope="row" class=""><label for="mb_id">회원아이디</label></th>
        <td>
			<textarea name="ids" id="ids" class="frm_input" placeholder="회원아이디를 , 를 이용해서 넣으세요"><?=$cp["ids"]?></textarea>
            <button type="button" id="sch_member" class="btn_frmline">회원검색</button>
            <input type="checkbox" name="chk_all_mb" id="chk_all_mb" value="1" <?if($cp["ids"]=="allmember"){echo "checked";}?>>
            <label for="chk_all_mb">전체회원</label>
        </td>
    </tr>
    
	<script>
		$("#sch_member").click(function() {
			if($("#chk_all_mb").is(":checked")) {
				alert("전체회원 체크를 해제 후 이용해 주십시오.");
				return false;
			}

			var opt = "left=50,top=50,width=520,height=600,scrollbars=1";
			var url = "./couponzonemember.php";
			window.open(url, "win_member", opt);
		});
	</script>
    
    <tr>
        <th scope="row"><label for="cz_subject">쿠폰이름</label></th>
        <td>
            <input type="text" name="cz_subject" value="<?php echo get_text($cp['cz_subject']); ?>" id="cz_subject" required class="required frm_input" size="50">
        </td>
    </tr>

    <?php
    if($w ==  "u" && $cp['cz_type'] ==  "3"){
    ?>
        <tr>
            <th scope="row"><label for="cp_id_span">쿠폰코드번호</label></th>
            <td>
                <input type="text" name="cp_id_span" value="<?php echo get_text($cp['cp_id']); ?>" id="cp_id_span" required class="required frm_input" size="50" disabled>
            </td>
        </tr>
    <?php
    }
    ?>

    


    <tr>
        <th scope="row"><label for="cz_start">사용시작일</label></th>
        <td>
            <?php echo help('입력 예: '.date('Y-m-d')); ?>
            <input type="text" name="cz_start" value="<?php echo stripslashes($cp['cz_start']); ?>" id="cz_start" required class="frm_input required">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="cz_end">사용종료일</label></th>
        <td>
            <?php echo help('입력 예: '.date('Y-m-d')); ?>
            <input type="text" name="cz_end" value="<?php echo stripslashes($cp['cz_end']); ?>" id="cz_end" required class="frm_input required">
        </td>
    </tr>
    <tr id="tr_cz_point">
        <th scope="row"><label for="cz_point">쿠폰 증가 포인트</label></th>
        <td>
            <?php echo help("쿠폰으로 추가할 회원의 포인트를 지정합니다. 쿠폰 다운로드 때 설정한 값만큼 회원의 포인트를 증감 합니다."); ?>
            <input type="text" name="cz_point" value="<?php echo get_text($cp['cz_point']); ?>" id="cz_point" class="frm_input">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="cz_period">쿠폰사용기한</label></th>
        <td>
            <?php echo help("쿠폰 다운로드 후 사용할 수 있는 기간을 설정합니다."); ?>
            <input type="text" name="cz_period" value="<?php echo stripslashes($cp['cz_period']); ?>" id="cz_period" required class="frm_input required" size="5"> 일
        </td>
    </tr>
    <tr>
        <th scope="row">쿠폰이미지</th>
        <td>
            <input type="file" name="cp_img">
            <?php
            $cpimg_str = '';
            $cpimg = G5_DATA_PATH."/coupon/{$cp['cz_file']}";
            if (is_file($cpimg) && $cp['cz_id']) {
                $size = @getimagesize($cpimg);
                if($size[0] && $size[0] > 750)
                    $width = 750;
                else
                    $width = $size[0];

                echo '<input type="checkbox" name="cp_img_del" value="1" id="cp_img_del"> <label for="cp_img_del">삭제</label>';
                $cpimg_str = '<img src="'.G5_DATA_URL.'/coupon/'.$cp['cz_file'].'" width="'.$width.'">';
            }
            if ($cpimg_str) {
                echo '<div class="coupon_img">';
                echo $cpimg_str;
                echo '</div>';
            }
            ?>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="cp_method">발급쿠폰종류</label></th>
        <td>
           <select name="cp_method" id="cp_method">
                <!--<option value="0"<?php echo get_selected('0', $cp['cp_method']); ?>>개별상품</option>-->
                <!--<option value="1"<?php echo get_selected('1', $cp['cp_method']); ?>>카테고리할인</option>-->
                <!--<option value="2"<?php echo get_selected('2', $cp['cp_method']); ?>>주문금액할인</option> -->
                <!--<option value="3"<?php echo get_selected('3', $cp['cp_method']); ?>>배송비할인</option>-->
				<option value="4"<?php echo get_selected('4', $cp['cp_method']); ?>>포인트추가</option>
           </select>
        </td>
    </tr>
    <tr id="tr_cp_target">
        <th scope="row"><label for="cp_target"><?php echo $cp_target_label; ?></label></th>
        <td>
           <input type="text" name="cp_target" value="<?php echo stripslashes($cp['cp_target']); ?>" id="cp_target" required class="required frm_input">
           <button type="button" id="sch_target" class="btn_frmline"><?php echo $cp_target_btn; ?></button>
        </td>
    </tr>
    <!-- 
    <tr>
        <th scope="row"><label for="cp_type">할인금액타입</label></th>
        <td>
           <select name="cp_type" id="cp_type">
                <option value="0"<?php echo get_selected('0', $cp['cp_type']); ?>>정액할인(원)</option>
                <option value="1"<?php echo get_selected('1', $cp['cp_type']); ?>>정률할인(%)</option>
           </select>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="cp_price"><?php echo $cp['cp_type'] ? '할인비율' : '할인금액'; ?></label></th>
        <td>
            <input type="text" name="cp_price" value="<?php echo stripslashes($cp['cp_price']); ?>" id="cp_price" required class="frm_input"> <span id="cp_price_unit"><?php echo $cp['cp_type'] ? '%' : '원'; ?></span>
        </td>
    </tr>
    <tr id="tr_cp_trunc">
        <th scope="row"><label for="cp_trunc">절사금액</label></th>
        <td>
            <select name="cp_trunc" id="cp_trunc">
            <option value="1"<?php echo get_selected('1', $cp['cp_trunc']); ?>>1원단위</option>
            <option value="10"<?php echo get_selected('10', $cp['cp_trunc']); ?>>10원단위</option>
            <option value="100"<?php echo get_selected('100', $cp['cp_trunc']); ?>>100원단위</option>
            <option value="1000"<?php echo get_selected('1000', $cp['cp_trunc']); ?>>1,000원단위</option>
           </select>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="cp_minimum">최소주문금액</label></th>
        <td>
            <input type="text" name="cp_minimum" value="<?php echo stripslashes($cp['cp_minimum']); ?>" id="cp_minimum" class="frm_input"> 원
        </td>
    </tr>
    <tr id="tr_cp_maximum">
        <th scope="row"><label for="cp_maximum">최대할인금액</label></th>
        <td>
            <input type="text" name="cp_maximum" value="<?php echo stripslashes($cp['cp_maximum']); ?>" id="cp_maximum" class="frm_input"> 원
        </td>
    </tr> 
    -->
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <a href="./couponzonelist.php?<?php echo $qstr; ?>" class="btn_02 btn">목록</a>
    <input type="submit" value="확인" class="btn_submit btn" accesskey="s">
</div>

</form>

<script>
$(function() {
	
	$("#tr_cp_target").hide();
    $("#tr_cp_target").find("input").attr("required", false).removeClass("required");

    <?php if(!$cp['cz_type']) { ?>
      // $("#tr_cz_point").hide();
    <?php } ?>
    <?php if($cp['cp_method'] == 2 || $cp['cp_method'] == 3|| $cp['cp_method'] == 4) { ?>
    //$("#tr_cp_target").hide();
    //$("#tr_cp_target").find("input").attr("required", false).removeClass("required");
    <?php } ?>


	if($("#cp_method").val()=="4"){
		$("#cp_price").attr("readonly",true);
	}

    <?php if($cp['cp_type'] != 1) { ?>
    $("#tr_cp_maximum").hide();
    $("#tr_cp_trunc").hide();
    <?php } ?>
    // function toggle_all_member(cz_type) {
    //     if(cz_type == "3") {
    //         $("#chk_all_mb").prop("checked", false);
    //         $("#chk_all_mb, label[for='chk_all_mb']").hide();
    //     } else {
    //         $("#chk_all_mb, label[for='chk_all_mb']").show();
    //     }
    // }

    // toggle_all_member($("#cz_type").val());

    // $("#cz_type").change(function() {
    //     toggle_all_member($(this).val());
    // });
    $("#cp_method").change(function() {
        var cp_method = $(this).val();
        change_method(cp_method);
    });

    $("#cp_type").change(function() {
        var cp_type = $(this).val();
        change_type(cp_type);
    });

    $("#sch_target").click(function() {
        var cp_method = $("#cp_method").val();
        var opt = "left=50,top=50,width=520,height=600,scrollbars=1";
        var url = "./coupontarget.php?sch_target=";

        if(cp_method == "0") {
            window.open(url+"0", "win_target", opt);
        } else if(cp_method == "1") {
            window.open(url+"1", "win_target", opt);
        } else {
            return false;
        }
    });

    $("#cz_start, #cz_end").datepicker(
        { changeMonth: true, changeYear: true, dateFormat: "yy-mm-dd", showButtonPanel: true, yearRange: "c-99:c+99" }
    );
});

function change_method(cp_method)
{

    if(cp_method == "0") {
        $("#sch_target").text("상품검색");
        $("#tr_cp_target").find("label").text("적용상품");
        $("#tr_cp_target").find("input").attr("required", true).addClass("required");
        $("#tr_cp_target").show();
		$("#cp_price").attr("readonly",false);
    } else if(cp_method == "1") {
        $("#sch_target").text("분류검색");
        $("#tr_cp_target").find("label").text("적용분류");
        $("#tr_cp_target").find("input").attr("required", true).addClass("required");
        $("#tr_cp_target").show();
		$("#cp_price").attr("readonly",false);
	}else if(cp_method == "2"){
		$("#tr_cp_target").hide();
        $("#tr_cp_target").find("input").attr("required", false).removeClass("required");
		$("#cp_price").attr("readonly",false);
    } else {

        $("#tr_cp_target").hide();
        $("#tr_cp_target").find("input").attr("required", false).removeClass("required");

		$("#cp_price").attr("readonly",true).val(0);
    }
}

function change_type(cp_type)
{
    if(cp_type == "0") {
        $("#cp_price_unit").text("원");
        $("#cp_price_unit").closest("tr").find("label").text("할인금액");
        $("#tr_cp_maximum").hide();
        $("#tr_cp_trunc").hide();
    } else {
        $("#cp_price_unit").text("%");
        $("#cp_price_unit").closest("tr").find("label").text("할인비율");
        $("#tr_cp_maximum").show();
        $("#tr_cp_trunc").show();
    }
}

function form_check(f)
{
    var sel_type = f.cp_type;
    var cp_type = sel_type.options[sel_type.selectedIndex].value;
    var cp_price = f.cp_price.value;

    <?php if(!$cpimg_str) { ?>
    if(f.cp_img.value == "") {
        alert("쿠폰이미지를 업로드해 주십시오.");
        return false;
    }
    <?php } ?>

    if(isNaN(cp_price)) {
        if(cp_type == "1")
            alert("할인비율을 숫자로 입력해 주십시오.");
        else
            alert("할인금액을 숫자로 입력해 주십시오.");

        return false;
    }

    cp_price = parseInt(cp_price);

    if(cp_type == "1" && (cp_price < 1 || cp_price > 99)) {
        alert("할인비율을 1과 99 사이의 숫자로 입력해 주십시오.");
        return false;
    }

    return true;
}
</script>

<?php
include_once (G5_ADMIN_PATH.'/admin.tail.php');