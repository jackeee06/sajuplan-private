<?php //추천상품 ?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title><?php echo $config['cf_title']; ?> - <?php echo $from_name; ?> 의 상품 추천 메일</title>
</head>

<?php
$cont_st = 'margin:0 auto 20px;width:94%;border:0';
$caption_st = 'padding:0 0 5px;font-weight:bold';
$th_st = 'padding:5px;border-top:1px solid #e9e9e9;border-bottom:1px solid #e9e9e9;background:#f5f6fa;text-align:left';
$td_st = 'padding:5px;border-top:1px solid #e9e9e9;border-bottom:1px solid #e9e9e9';
$empty_st = 'padding:30px;border-top:1px solid #e9e9e9;border-bottom:1px solid #e9e9e9;text-align:center';
$ft_a_st = 'display:block;padding:30px 0;background:#484848;color:#fff;text-align:center;text-decoration:none';
?>

<body>


<div style="width:600px; margin:40px auto;">    
  <table width="600px" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFF; border:10px solid #f8f8f9;">
		<tr>
			<td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative;">
            	<div style=" width:600px; float:left; position:relative;">
                	<span style="float:left;">
                   		<img src="https://sajumoon.co.kr/img/mail/logo.png" style="width:120px;">
            			<p style="margin-top:20px;">
       	    			  <img src="https://sajumoon.co.kr/img/mail/itemrecommend_mail_title.png" style="width:280px;"> 	
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
                	<p style="<?php echo $cont_st; ?>"><b><?php echo $from_name; ?></b> 님께서 추천하신 상품입니다.</p>

        <div style="margin:0 0 10px;text-align:center">
            <a href="<?php echo shop_item_url($it_id); ?>" target="_blank" style="display:inline-block;margin:0 0 10px"><?php echo $it_mimg; ?></a><br>
            <?php echo $it_name; ?>
        </div>

        <p style="<?php echo $cont_st; ?>">
            <br>
            <strong><?php echo $subject; ?></strong>
        </p>

        <p style="<?php echo $cont_st; ?>"><?php echo $content; ?></p>

            
          <p style="text-align:center; margin-top:20px;">
                    	<a href="<?php echo shop_item_url($it_id); ?>" target="_blank" style=" display:inline-block;padding:12px 60px; border-radius:5px; background:#465bf0;color:#fff;text-decoration:none;text-align:center; font-size:16px; font-weight:600; margin-top:10px;">
                       상품 자세히 보기
                  		</a>
                    </p>  
                 
                             

                    
              </div>
            </td>
		</tr>        
        
        <tr>
            <td style=" padding:20px; border-bottom:1px solid #e5e5e5; position:relative; font-size:13px;color:#222;line-height:160%;">
            	
                본 메일은 발신전용 입니다.
                <br>
                서비스관련 궁금하신 사항은 <a href="mailto:themaj@naver.com" target="_blank" style="text-decoration:underline; font-weight:600; color:#222;">themaj@naver.com</a>로 문의주세요.
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
