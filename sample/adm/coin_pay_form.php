<?php
$sub_menu = "350460";
require_once './_common.php';

auth_check_menu($auth, $sub_menu, 'r');
#################################################3

$listall = '<a href="' . $_SERVER['SCRIPT_NAME'] . '" class="ov_listall">전체목록</a>';

$g5['title'] = '충전금액 설정';
require_once './admin.head.php';

?>


    <style>
        .frm_input { height:34px;}
        .tbl_frm01 tr:nth-child(1) th { text-align:center;}
        .tbl_frm01 td { padding:5px 10px;}

        .tbl_head01 tbody tr:nth-child(even) { background-color:#fff;}
        .tbl_head01 tbody th { background-color:#f5f5f5;}
        .tbl_head01 tbody td .frm_input { width:auto;}
    </style>

    <form name="fboardlist" id="fboardlist" action="./coin_pay_form_update.php" onsubmit="return check_submit(this);" method="post">
        <input type="hidden" name="sst" value="<?php echo $sst ?>">
        <input type="hidden" name="sod" value="<?php echo $sod ?>">
        <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
        <input type="hidden" name="stx" value="<?php echo $stx ?>">
        <input type="hidden" name="page" value="<?php echo $page ?>">
        <input type="hidden" name="token" value="<?php echo isset($token) ? $token : ''; ?>">

        <section>
            <!--<h2 class="h2_frm">상품 결제금액</h2>-->
            <p style="text-align:left; font-size:13px; margin-bottom:10px;">
                ※ 주의사항: 입력한 대로 노출 / 숫자 입력 시 콤마(,) 금지
            </p>
            <div class="tbl_head01 tbl_wrap">
                <table>
                    <thead>
                    <tr>
                        <th>결제금액(VAT 별도)</th>
                        <!--<th>지급 포인트</th>-->
                        <th>보너스 적립</th>
                        <th>총 지급 포인트</th>
                        <th>문구</th>
                    </tr>
                    </thead>
                    <tbody>

                    <?for($i=1;$i<=5;$i++){

                        $row = array();
                        $csql = "select * from account_config where product_id='".$i."'";
                        $result= sql_query($csql);

                        if($result){
                            $row=sql_fetch_array($result);
                        }
                        ?>
                        <tr>
                            <td class="center">
                                <!--                                <input type="text" id="it_price_--><?php //=$i?><!--" name="it_price_--><?php //=$i?><!--" class="frm_input required right" size="14" value="--><?php //=$row["price"]?><!--"/> 원-->
                                <input type="text" id="it_price_<?=$i?>" name="it_price_<?=$i?>" class="frm_input required right" size="14" value="<?=$row["price"]?>" oninput="recalc(<?=$i?>)"/> 원
                            </td>
                            <!--<td class="center">
						<input type="text" id="it_point_<?=$i?>" name="it_point_<?=$i?>" class="frm_input required right" size="14" value="<?=$row["point"]?>"/> P
					</td>-->
                            <td class="center">
                                <!--                                <input type="text" id="it_spoint_--><?php //=$i?><!--" name="it_spoint_--><?php //=$i?><!--" class="frm_input required right" size="14" value="--><?php //=$row["bonus_percent"]?><!--"/> %-->
                                <input type="text" id="it_spoint_<?=$i?>" name="it_spoint_<?=$i?>" class="frm_input required right" size="14" value="<?=$row["bonus_percent"]?>" oninput="recalc(<?=$i?>)"/> %
                            </td>
                            <td class="center">
                                <input type="text" id="it_tpoint_<?=$i?>" name="it_tpoint_<?=$i?>" class="frm_input required right" size="14" value="<?=$row["total_point"]?>"/> P
                            </td>
                            <td class="center">
                                <input type="text" id="it_msg_<?=$i?>" name="it_msg_<?=$i?>" class="frm_input required left" size="30" value="<?=$row["message"]?>" maxlength="15" placeholder="15글자 미만" />
                            </td>
                        </tr>

                        <?


                    }?>
                    </tbody>
                </table>
            </div>
        </section>



        <div class="btn_fixed_top">
            <?php if ($is_admin == 'super') { ?>
                <input type="submit" id="btn_submit" name="btn_submit" value="저장" class="btn btn_01" >
            <?php } ?>
            <!--

            <a href="./member_form.php" id="member_add" class="btn btn_01">회원추가</a>

            -->
        </div>




    </form>

<?php echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, $_SERVER['SCRIPT_NAME'] . '?' . $qstr . '&amp;page='); ?>

    <script>
        function check_submit(f){
            var f = f;

            f.submit();
        }
    </script>
    <script>
        // 콤마 제외 숫자만
        const onlyNum = v => (v||'').replace(/[^0-9]/g,'');

        function recalc(i){
            const price = parseInt( onlyNum(document.getElementById('it_price_'+i).value) || 0, 10 );
            const bonus = parseInt( onlyNum(document.getElementById('it_spoint_'+i).value) || 0, 10 );
            const total = Math.round(price * (100 + bonus) / 100);
            document.getElementById('it_tpoint_'+i).value = total;
        }
    </script>


<?php
require_once './admin.tail.php';
