<?php
// 게시물 입력시 게시자, 관리자에게 드리는 메일을 수정하고 싶으시다면 이 파일을 수정하십시오.
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title><?php echo $wr_subject ?> 메일</title>
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
       	    			  <img src="https://sajumoon.co.kr/img/mail/write_update_mail_title.png" style="width:160px;"> 	
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
            			<?php echo $wr_subject ?>
                    </p>
                  <p style="margin-bottom:10px; text-align:right;">
                    	작성자 <?php echo $wr_name ?>
                  </p>
                   <?php echo $wr_content ?>                    
                    
                    
                  <p style="text-align:center; margin-top:20px;">
                    	<a href="<?php echo $link_url ?>" target="_blank" style=" display:inline-block;padding:12px 60px; border-radius:5px; background:#000;color:#fff;text-decoration:none;text-align:center; font-size:16px; font-weight:600; margin-top:10px;">
                        게시물 확인하기
                  		</a>
                    </p>
                    
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
