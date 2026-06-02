<?php
// 회원가입축하 메일 (회원님께 발송)
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
?>

<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>회원가입 축하 메일</title>
</head>

<body>

<div style="width:600px; margin:40px auto;">    
    <table width="600px" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFF; border:10px solid #f8f8f9;">
		<tr>
			<td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative;">
            	<div style=" width:600px; float:left; position:relative;">
                	<span style="float:left;">
                   		<img src="https://sajumoon.co.kr/img/mail/logo.png" style="width:120px;">
            			<p style="margin-top:20px;">
           	    			<img src="https://sajumoon.co.kr/img/mail/register_form_update_mail1_title.png" style="width:280px;"> 	
                        </p>
                    </span>
                    <span style="float:right; display:inline-block; vertical-align:bottom;">
                    	<img src="https://sajumoon.co.kr/img/mail/logo_02.png" style="width:100px; vertical-align:bottom;"> 
                    </span>
                </div>
            </td>
        </tr>
        <tr>
            <td style=" padding:20px; position:relative;">
            	<div style="width:100%; float:left; color:#222; font-size:14px; line-height:160%; min-height:140px;">
                	<p style="font-size:16px; margin-bottom:10px;">
                    	안녕하세요,  
                        <b style=" color:#f15c22; font-weight:800;"><?php echo $mb_name ?></b> 회원님.
                    </p>
                    사주플랜 회원으로 가입해 주셔서 감사합니다.
                    <br>
                    회원님의 정보는 철저한 보안 아래 안전하게 유지됩니다.
                    <br>
                    <?php if ($config['cf_use_email_certify']) { ?>
                    	<span style="line-height:40px;">
                        아래의 <strong>메일인증</strong>을 클릭하시면 회원가입이 완료됩니다.
                    	</span><br>
                    <?php } ?>
                    
                    <?php if ($config['cf_use_email_certify']) { ?>
                    	<p style="text-align:center; margin-top:20px;">
                        <a href="<?php echo $certify_href ?>" target="_blank" style=" display:inline-block;padding:12px 60px; border-radius:5px; background:#000;color:#fff;text-decoration:none;text-align:center; font-size:16px; font-weight:600; margin-top:10px;">
                        메일인증
                  		</a>
                        </p>
			        <?php } else { ?>
        				<!--
                        <a href="<?php echo G5_URL ?>" target="_blank" style=" display:inline-block;padding:12px 60px; border-radius:5px; background:#000;color:#fff;text-decoration:none;text-align:center; font-size:16px; font-weight:600; margin-top:10px;">서비스 둘러보기</a>
                        -->
                        
        			<?php } ?>
                    
                    
              </div>
            </td>
		</tr>        
        
        <tr>
            <td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative; font-size:13px;color:#222;line-height:160%;">
            	
                본 메일은 발신전용 입니다.
                <br>
                서비스관련 궁금하신 사항은 <a href="mailto:themaj@naver.com" target="_blank" style="text-decoration:underline; font-weight:600; color:#222;"> themaj@naver.com</a>로 문의주세요.
            </td>
		</tr>
        
        <tr>
            <td style=" padding:20px; position:relative; font-size:12px;color:#999;line-height:160%; background-color:#eee;">
            	
                <img src="https://sajumoon.co.kr/img/mail/copy.png">
            </td>
		</tr>
	</table>

</div>
</body>
</html>
