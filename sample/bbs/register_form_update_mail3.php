<?php
// E-mail 수정시 인증 메일 (회원님께 발송)
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
?>

<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>회원 인증 메일</title>

<style>
body { background-color:#f8f8f9;
font-family: 'Nanum Gothic', 'Noto Sans KR',sans-serif;
}

a { text-decoration:none;}
p, ul, li { padding:0; margin:0; list-style:none;}

</style>

<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&Noto+Sans+KR:wght@400;500&display=swap" rel="stylesheet">



</head>

<body style="margin:0;">

<div style="width:600px; margin:40px auto;">    
    <table width="600px" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFF; border:10px solid #f8f8f9;">
		<tr>
			<td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative;">
            	<div style=" width:600px; float:left;">
                	<span style="float:left;">
                   	<img src="https://sajumoon.co.kr/img/mail/logo.png" style="width:120px;">
            			<p style="margin-top:20px;">
       	    			  <img src="https://sajumoon.co.kr/img/mail/register_form_update_mail3_title.png" style="width:280px;"> 	
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
                    	<?php if($w == 'u') { ?>
            			<b><?php echo $mb_name ?></b> 님의 E-mail 주소가 변경되었습니다.<br><br>
            			<?php } ?>

            			아래의 주소를 클릭하시면 인증이 완료됩니다.<br>
            			<a href="<?php echo $certify_href ?>" target="_blank"><b><?php echo $certify_href ?></b></a><br><br>

            			회원님의 성원에 보답하고자 더욱 더 열심히 하겠습니다.<br>
            			감사합니다.
            		</p>
					
                    <br>

               	  <a href="<?php echo G5_BBS_URL ?>/login.php" target="_blank" style=" display:inline-block;padding:12px 60px; border-radius:5px; background:#000;color:#fff;text-decoration:none;text-align:center; font-size:16px; font-weight:600; margin-top:10px;">
                        로그인
           		  </a>
                        
                        <br><br>

                    
                    
              </div>
            </td>
		</tr>        
        
        <tr>
            <td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative; font-size:13px;color:#222;line-height:160%;"> 본 메일은 발신전용 입니다. <br>
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
