    
        <div id="gnb" class="hd_div <?php if($member['mb_level']>2){ ?>manager<? } ?>">
        

            
        	<ul class="gnb_close" style="">
        
            	<button type="button" id="gnb_close_btn" class="hd_closer"><span class="sound_only">메뉴 닫기</span><i class="xi-close"></i></button>
            
            </ul>
			
			
			<?php //echo outlogin('theme/basic'); // 외부 로그인 ?>
            
            

        
            <? if ($is_member) {?>
			
			<? } else {?>

			<? } ?>


 
            <!--
            <ul id="gnb_1dul">
            <?php
            $menu_datas = get_menu_db(1, true);
			$i = 0;
			foreach( $menu_datas as $row ){
				if( empty($row) ) continue;
            ?>
                <li class="gnb_1dli">
                    <a href="<?php echo $row['me_link']; ?>" target="_<?php echo $row['me_target']; ?>" class="gnb_1da"><?php echo $row['me_name'] ?></a>
                    <?php
                    $k = 0;
                    foreach( (array) $row['sub'] as $row2 ){
						if( empty($row2) ) continue;
                        if($k == 0)
                            echo '<button type="button" class="btn_gnb_op"><span class="sound_only">하위분류</span></button><ul class="gnb_2dul">'.PHP_EOL;
                    ?>
                        <li class="gnb_2dli"><a href="<?php echo $row2['me_link']; ?>" target="_<?php echo $row2['me_target']; ?>" class="gnb_2da"><span></span><?php echo $row2['me_name'] ?></a></li>
                    <?php
					$k++;
                    }	//end foreach $row2

                    if($k > 0)
                        echo '</ul>'.PHP_EOL;
                    ?>
                </li>
            <?php
			$i++;
            }	//end foreach $row

            if ($i == 0) {  ?>
                <li id="gnb_empty">메뉴 준비 중입니다.<?php if ($is_admin) { ?> <br><a href="<?php echo G5_ADMIN_URL; ?>/menu_list.php">관리자모드 &gt; 환경설정 &gt; 메뉴설정</a>에서 설정하세요.<?php } ?></li>
            <?php } ?>
                <li class="gnb_1dli"><a href="<?php echo G5_SHOP_URL ?>" class="gnb_1da"> 쇼핑몰</a></li>
            </ul>
            -->
			
            <!--
            <ul id="hd_nb">
            	<li class="hd_nb1"><a href="<?php echo G5_BBS_URL ?>/faq.php" id="snb_faq"><i class="fa fa-question" aria-hidden="true"></i>FAQ</a></li>
                <li class="hd_nb2"><a href="<?php echo G5_BBS_URL ?>/qalist.php" id="snb_qa"><i class="fa fa-comments" aria-hidden="true"></i>1:1문의</a></li>
                <li class="hd_nb3"><a href="<?php echo G5_BBS_URL ?>/current_connect.php" id="snb_cnt"><i class="fa fa-users" aria-hidden="true"></i>접속자 <span><?php echo connect('theme/basic'); // 현재 접속자수 ?></span></a></li>
                <li class="hd_nb4"><a href="<?php echo G5_BBS_URL ?>/new.php" id="snb_new"><i class="fa fa-history" aria-hidden="true"></i>새글</a></li>   
            </ul>
            -->
        </div>
