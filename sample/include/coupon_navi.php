
<!-- 하단 메뉴 HOVER -->
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/tail_hover_coin.css" type="text/css">
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/coin.css" type="text/css">


<?php
// 현재 페이지가 쿠폰함(coupon.php)일 때만 입력창 노출
$is_coupon_page = (basename($_SERVER['SCRIPT_NAME']) === 'coupon.php');
?>

<style>
.coupon_input_box {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 10px 15px 0;
    width: 100%;
    box-sizing: border-box;
}
.coupon_input_box input[type="text"] {
    flex: 1;
    min-width: 0;
    height: 40px;
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 1px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    text-transform: uppercase;
}
.coupon_input_box input[type="text"]:focus {
    border-color: #e8426c;
    outline: none;
}
.coupon_input_box .separator {
    color: #ccc;
    font-size: 16px;
    flex-shrink: 0;
}
.coupon_input_box .btn_coupon_check {
    height: 40px;
    padding: 0 16px;
    margin-left: 5px;
    background: #e8426c;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}
.coupon_input_box .btn_coupon_check:hover {
    background: #e8426c;
}
</style>

<div class="top_nav">
    <a href="../shop/coupon.php"><ul class="top_nav_01">쿠폰함</ul></a>
    <a href="../shop/couponzone.php"><ul class="top_nav_02">쿠폰다운로드</ul></a>
    <a href="../bbs/board.php?bo_table=event"><ul class="top_nav_03">이벤트</ul></a>
</div>

<?php if($is_coupon_page): ?>
<div class="coupon_input_box">
    <input type="text" id="coupon_code_1" maxlength="4" placeholder="XXXX" autocomplete="off">
    <span class="separator">-</span>
    <input type="text" id="coupon_code_2" maxlength="4" placeholder="XXXX" autocomplete="off">
    <span class="separator">-</span>
    <input type="text" id="coupon_code_3" maxlength="4" placeholder="XXXX" autocomplete="off">
    <span class="separator">-</span>
    <input type="text" id="coupon_code_4" maxlength="4" placeholder="XXXX" autocomplete="off">
    <button type="button" class="btn_coupon_check" id="btn_coupon_register">확인</button>
</div>
<?php endif; ?>




<?php if($is_coupon_page): ?>
<script>

$(function() {
    // 4자리 입력 시 다음 칸으로 자동 이동
    $('#coupon_code_1, #coupon_code_2, #coupon_code_3, #coupon_code_4').on('input', function() {
        var $this = $(this);
        var val = $this.val().toUpperCase().replace(/[^A-Z0-9]/g, '');
        $this.val(val);
        
        if(val.length >= 4) {
            var id = $this.attr('id');
            if(id === 'coupon_code_1') {
                $('#coupon_code_2').focus();
            } else if(id === 'coupon_code_2') {
                $('#coupon_code_3').focus();
            } else if(id === 'coupon_code_3') {
                $('#coupon_code_4').focus();
            }
        }
    });
    
    // 백스페이스로 이전 칸으로 이동
    $('#coupon_code_2, #coupon_code_3, #coupon_code_4').on('keydown', function(e) {
        if(e.keyCode === 8 && $(this).val() === '') {
            var id = $(this).attr('id');
            if(id === 'coupon_code_2') {
                $('#coupon_code_1').focus();
            } else if(id === 'coupon_code_3') {
                $('#coupon_code_2').focus();
            } else if(id === 'coupon_code_4') {
                $('#coupon_code_3').focus();
            }
        }
    });
    
    // 확인 버튼 클릭
    $('#btn_coupon_register').on('click', function() {
        
        var code1 = $('#coupon_code_1').val().trim();
        var code2 = $('#coupon_code_2').val().trim();
        var code3 = $('#coupon_code_3').val().trim();
        var code4 = $('#coupon_code_4').val().trim();

        if(!code1 || !code2 || !code3 || !code4) {
            webAlert('쿠폰번호를 모두 입력해주세요.');
            return;
        }
        if(code1.length !== 4 || code2.length !== 4 || code3.length !== 4 || code4.length !== 4) {
            webAlert('쿠폰 코드는 각 4자리씩 입력해 주세요.');
            return;
        }
        
        var fullCode = code1 + '-' + code2 + '-' + code3 + '-' + code4;
        console.log(fullCode);

        $.ajax({
            url: './ajax.coupon_reg.php',
            type: 'POST',
            data: { 
                'cp_id' : fullCode
            },
            dataType: 'json',  // JSON 응답 받는다고 명시!
            success: function(res) {
               if(res.result){
                 webAlertAction(res.msg,'reload');
               }else{
                 webAlertAction(res.msg,'');
               }
            },
            error: function(xhr, status, error) {
                console.error('Ajax 오류:', error);
            }
        });

        
        // TODO: 쿠폰 등록 AJAX 처리
        // ajax 처리 필요 발급 처리만 해주면 끝남. insert만 해주면될듯함.
        // 회원체크하고 처리만 하면됨.
        // 발급처리하기.

        // alert('쿠폰 코드: ' + fullCode + '\n현재 준비중 입니다.');
    });
    
    // 엔터키로 확인
    $('#coupon_code_1, #coupon_code_2, #coupon_code_3, #coupon_code_4').on('keypress', function(e) {
        if(e.keyCode === 13) {
            $('#btn_coupon_register').click();
        }
    });
});
</script>
<?php endif; ?>
