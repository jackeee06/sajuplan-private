
<style>
#smb_my_ov_02.manager { padding-top:20px;}
#smb_my_ov_02.manager .my_name .my_img img { border:none;}
#smb_my_ov_02 .my_name.manager { padding-bottom:30px;}
</style>

<section id="smb_my_ov_02" class="manager">
	<h2>회원정보 개요</h2>

    <div class="my_name manager point_02_bg">
		<div class="my_img">
			<a href="<?php echo G5_URL; ?>/sub/mypage.php"> 
               	<img src="https://ykapp.kr/img/no_profile.gif" alt="profile_image">            	
            </a>
        </div>
        
        
        <?php
	

		if($mb_id){
				$store_info = get_my_store_name($mb_id);
				$mb= get_member($mb_id);
		}elseif(!$mb_id && $jisa_id){
				$store_info = get_my_store_name($jisa_id);
				$mb= get_member($jisa_id);
		}elseif(!$mb_id && !$jisa_id && $member["mb_id"]){
				$store_info = get_my_store_name($member["mb_id"]);
				$mb= $member;
		}

		
		?>
        
        <div>
        	<a href="<?php echo G5_URL; ?>/sub/mypage.php"> 
            	<p class="point_02_bg white">
            		<strong>
						<span class="white"><?=$mb['mb_2']?$mb['mb_2']:'지정된 지점이 없습니다.'?></span> 
						
						<? if($store_info["wr_2"]){?>
							<span style=" display:inline-block; padding:1px 8px; border-radius:50px; background-color:rgba(255,255,255,.2); font-size:14px;"><img src="<?php echo G5_IMG_URL; ?>/common/icon_tel_02.png" style=" width:auto; height:12px; border-radius:0; vertical-align:-1px;" /> <?=$store_info["wr_2"]?$store_info["wr_2"]:''?></span>
						<? }?>

                    </strong>
					<?php echo $mb['mb_id'] ? $mb['mb_nick'] : '<span class="point_02">로그인</span>해 주세요 <i class="xi-angle-right"></i>'; ?>
					(<?php echo $mb['mb_id'] ? $mb['mb_id'] : ''; ?>)
                </p>
        	</a>
            
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=register_form_edit.php"><span class="my_edit set black"><i class="xi-cog"></i></span></a>			
		</div>
        
        <?// }?>
    </div>

</section>