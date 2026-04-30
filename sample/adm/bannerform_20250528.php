<?php
$sub_menu = '350600';
include_once('./_common.php');

auth_check_menu($auth, $sub_menu, "w");

$bn_id = isset($_REQUEST['bn_id']) ? preg_replace('/[^0-9]/', '', $_REQUEST['bn_id']) : 0;
$bn = array(
'bn_id'=>0,
'bn_alt'=>'',
'bn_device'=>'',
'bn_position'=>'',
'bn_border'=>'',
'bn_new_win'=>'',
'bn_order'=>''
);

$html_title = '배너';
$g5['title'] = $html_title.'관리';

if ($w=="u")
{
    $html_title .= ' 수정';
    $sql = " select * from {$g5['g5_shop_banner_table']} where bn_id = '$bn_id' ";
    $bn = sql_fetch($sql);
}
else
{
    $html_title .= ' 입력';
    $bn['bn_url']        = "http://";
    $bn['bn_begin_time'] = date("Y-m-d 00:00:00", time());
    $bn['bn_end_time']   = date("Y-m-d 00:00:00", time()+(60*60*24*31));
}

// 접속기기 필드 추가
if(!sql_query(" select bn_device from {$g5['g5_shop_banner_table']} limit 0, 1 ")) {
    sql_query(" ALTER TABLE `{$g5['g5_shop_banner_table']}`
                    ADD `bn_device` varchar(10) not null default '' AFTER `bn_url` ");
    sql_query(" update {$g5['g5_shop_banner_table']} set bn_device = 'pc' ");
}

include_once (G5_ADMIN_PATH.'/admin.head.php');
?>

<form name="fbanner" action="./bannerformupdate.php" method="post" enctype="multipart/form-data">
<input type="hidden" name="w" value="<?php echo $w; ?>">
<input type="hidden" name="bn_id" value="<?php echo $bn_id; ?>">

<div class="tbl_frm01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?></caption>
    <colgroup>
        <col class="grid_4">
        <col>
    </colgroup>
    <tbody>
    <tr>
        <th scope="row">이미지</th>
        <td>
            <input type="file" name="bn_bimg">
            <?php
            $bimg_str = "";
            $bimg = G5_DATA_PATH."/banner/{$bn['bn_id']}";
            if (file_exists($bimg) && $bn['bn_id']) {
                $size = @getimagesize($bimg);
                if($size[0] && $size[0] > 750)
                    $width = 750;
                else
                    $width = $size[0];

                echo '<input type="checkbox" name="bn_bimg_del" value="1" id="bn_bimg_del"> <label for="bn_bimg_del">삭제</label>';
                $bimg_str = '<img src="'.G5_DATA_URL.'/banner/'.$bn['bn_id'].'" width="'.$width.'">';
            }
            if ($bimg_str) {
                echo '<div class="banner_or_img">';
                echo $bimg_str;
                echo '</div>';
            }
            ?>
             <?php echo help("· 메인-비주얼: 1000*520px
			· 메인-상단띠배너: 1000*80px
			· 메인-중앙배너 : 1000*160px
			· 로그인-상단띠배너 : 1000*80px
			· 마이페이지: 1000*220px
			· 일반-상담후기: 1000*240px
			· 일반-이용안내: 1000*270px
			· 일반-상담사신청: 1000*530px
			· 상담사-정산내역: 1000*270px
			· 상담사-공지사항: 1000*270px
			· 이벤트1,2,3: 1000*270px
			· 오늘의운세: 1000*520px
			· 소원다락방-상단: 1000*520px
			· 소원다락방-하단: 1000*XXXpx
			· 사주문의길: 1000*1100px
			"); ?>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_alt">이미지 설명</label></th>
        <td>
            <?php echo help("img 태그의 alt, title 에 해당되는 내용입니다.\n배너에 마우스를 오버하면 이미지의 설명이 나옵니다."); ?>
            <input type="text" name="bn_alt" value="<?php echo get_text($bn['bn_alt']); ?>" id="bn_alt" class="frm_input" size="80">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_url">링크</label></th>
        <td>
            <?php echo help("배너클릭시 이동하는 주소입니다."); ?>
            <input type="text" name="bn_url" size="80" value="<?php echo get_sanitize_input($bn['bn_url']); ?>" id="bn_url" class="frm_input">
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_position">출력위치</label></th>
        <td>
           
            <select name="bn_position" id="bn_position">
                <option value="메인-비주얼" <?php echo get_selected($bn['bn_position'], '메인-비주얼'); ?>>메인-비주얼</option>
                <option value="메인-상단띠배너" <?php echo get_selected($bn['bn_position'], '메인-상단띠배너'); ?>>메인-상단띠배너</option>
                <option value="메인-중앙배너" <?php echo get_selected($bn['bn_position'], '메인-중앙배너'); ?>>메인-중앙배너</option>
                <option value="로그인-상단띠배너" <?php echo get_selected($bn['bn_position'], '로그인-상단띠배너'); ?>>로그인-상단띠배너</option>
                <option value="마이페이지" <?php echo get_selected($bn['bn_position'], '마이페이지'); ?>>마이페이지</option>
                <option value="일반-상담후기" <?php echo get_selected($bn['bn_position'], '일반-상담후기'); ?>>일반-상담후기</option>
                <option value="일반-이용안내" <?php echo get_selected($bn['bn_position'], '일반-이용안내'); ?>>일반-이용안내</option>
                <option value="일반-상담사신청" <?php echo get_selected($bn['bn_position'], '일반-상담사신청'); ?>>일반-상담사신청</option>
                <option value="상담사-코인내역" <?php echo get_selected($bn['bn_position'], '상담사-코인내역'); ?>>상담사-코인내역</option>
                <option value="상담사-공지사항" <?php echo get_selected($bn['bn_position'], '상담사-공지사항'); ?>>상담사-공지사항</option>
                <option value="이벤트1" <?php echo get_selected($bn['bn_position'], '이벤트1'); ?>>이벤트1</option>
                <option value="이벤트2" <?php echo get_selected($bn['bn_position'], '이벤트2'); ?>>이벤트2</option>
                <option value="이벤트3" <?php echo get_selected($bn['bn_position'], '이벤트3'); ?>>이벤트3</option>
		        <option value="오늘의운세"<?php echo get_selected($bn['bn_position'], '오늘의운세'); ?>>오늘의운세</option>
        		<option value="소원다락방-상단"<?php echo get_selected($bn['bn_position'], '소원다락방-상단'); ?>>소원다락방-상단</option>
		        <option value="소원다락방-하단"<?php echo get_selected($bn['bn_position'], '소원다락방-하단'); ?>>소원다락방-하단</option>
                <option value="사주문의길"<?php echo get_selected($bn['bn_position'], '사주문의길'); ?>>사주문의길</option>
        	</select>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_begin_time">시작일시</label></th>
        <td>
            <?php echo help("배너 게시 시작일시를 설정합니다."); ?>
            <input type="text" name="bn_begin_time" value="<?php echo $bn['bn_begin_time']; ?>" id="bn_begin_time" class="frm_input"  size="21" maxlength="19">
            <input type="checkbox" name="bn_begin_chk" value="<?php echo date("Y-m-d 00:00:00", time()); ?>" id="bn_begin_chk" onclick="if (this.checked == true) this.form.bn_begin_time.value=this.form.bn_begin_chk.value; else this.form.bn_begin_time.value = this.form.bn_begin_time.defaultValue;">
            <label for="bn_begin_chk">오늘</label>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_end_time">종료일시</label></th>
        <td>
            <?php echo help("배너 게시 종료일시를 설정합니다."); ?>
            <input type="text" name="bn_end_time" value="<?php echo $bn['bn_end_time']; ?>" id="bn_end_time" class="frm_input" size=21 maxlength=19>
            <input type="checkbox" name="bn_end_chk" value="<?php echo date("Y-m-d 23:59:59", time()+60*60*24*31); ?>" id="bn_end_chk" onclick="if (this.checked == true) this.form.bn_end_time.value=this.form.bn_end_chk.value; else this.form.bn_end_time.value = this.form.bn_end_time.defaultValue;">
            <label for="bn_end_chk">오늘+31일</label>
        </td>
    </tr>
    <tr>
        <th scope="row"><label for="bn_order">출력 순서</label></th>
        <td>
           <?php echo help("배너를 출력할 때 순서를 정합니다. 숫자가 작을수록 먼저 출력됩니다."); ?>
           <?php echo order_select("bn_order", $bn['bn_order']); ?>
        </td>
    </tr>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <a href="./bannerlist.php" class="btn_02 btn">목록</a>
    <input type="submit" value="확인" class="btn_submit btn" accesskey="s">
</div>

</form>

<?php
include_once (G5_ADMIN_PATH.'/admin.tail.php');