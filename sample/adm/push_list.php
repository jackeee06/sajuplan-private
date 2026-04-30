<?php
$sub_menu = "900050";
include_once('./_common.php');

auth_check($auth[$sub_menu], 'r');

$sql_common = " from member_push ";

$gubun = isset($_GET['gubun']) ? $_GET['gubun'] : '';

$sql_search = " where (1) ";

if ($stx) {
    $sql_search .= " and ( ";
    switch ($sfl) {
        case 'kind' :
			$sql_search .= " ({$sfl} = '{$stx}') ";
            break;
        default :
            $sql_search .= " ({$sfl} like '%{$stx}%') ";
            break;
    }
    $sql_search .= " ) ";
}

if ($gubun !== '') {
    if ($gubun === '2') {
        $sql_search .= " and gubun in ('1','2') and id <> 'all' ";
    } else {
        $sql_search .= " and gubun = '{$gubun}' ";
    }
}

if (!$sst) {
    $sst  = "regdate";
    $sod = "desc";
}
$sql_order = " order by {$sst} {$sod} ";

$sql = " select count(*) as cnt
            {$sql_common}
            {$sql_search}
            {$sql_order} ";
$row = sql_fetch($sql);
$total_count = $row['cnt'];

$rows = $config['cf_page_rows'];
$total_page  = ceil($total_count / $rows);  // 전체 페이지 계산
if ($page < 1) $page = 1; // 페이지가 없으면 첫 페이지 (1 페이지)
$from_record = ($page - 1) * $rows; // 시작 열을 구함

$sql = " select *
            {$sql_common}
            {$sql_search}
            {$sql_order}
            limit {$from_record}, {$rows} ";





$result = sql_query($sql);

$gubun_qs = '';
if ($sfl) $gubun_qs .= 'sfl='.urlencode($sfl);
if ($stx !== '') {
    if ($gubun_qs) $gubun_qs .= '&';
    $gubun_qs .= 'stx='.urlencode($stx);
}
$gubun_qs = $gubun_qs ? '&'.$gubun_qs : '';

$listall = '<a href="'.$_SERVER['SCRIPT_NAME'].'" class="ov_listall">전체목록</a>';

$mb = array();
if ($sfl == 'mb_id' && $stx)
    $mb = get_member($stx);

$g5['title'] = '푸시알림내역';
include_once ('./admin.head.php');

$colspan = 9;

$po_expire_term = '';
if($config['cf_point_term'] > 0) {
    $po_expire_term = $config['cf_point_term'];
}

if (strstr($sfl, "mb_id"))
    $mb_id = $stx;
else
    $mb_id = "";


if(isset($_SERVER['HTTPS']) && $_SERVER['HTTPS']=='on') {   //https 통신일때 daum 주소 js
    echo  '<script src="https://spi.maps.daum.net/imap/map_js_init/postcode.v2.js"></script>';
} else {  //http 통신일때 daum 주소 js
    echo  '<script src="http://dmaps.daum.net/map_js_init/postcode.v2.js"></script>';
}
?>



<div class="local_ov01 local_ov">
    <?php echo $listall ?>
    <a href="<?php echo $_SERVER['SCRIPT_NAME']; ?>?gubun=10<?php echo $gubun_qs; ?>" class="ov_listall">전체공지</a>
    <a href="<?php echo $_SERVER['SCRIPT_NAME']; ?>?gubun=2<?php echo $gubun_qs; ?>" class="ov_listall">일반회원</a>
    <a href="<?php echo $_SERVER['SCRIPT_NAME']; ?>?gubun=5<?php echo $gubun_qs; ?>" class="ov_listall">상담사</a>
    <!-- <a href="<?php echo $_SERVER['SCRIPT_NAME']; ?>" class="ov_listall">전체</a> -->
    <span class="btn_ov01"><span class="ov_txt">전체 </span><span class="ov_num"> <?php echo number_format($total_count) ?> 건 </span></span>
</div>
<?
//echo $sql;
?>
<form name="fsearch" id="fsearch" class="local_sch01 local_sch" method="get">
<label for="sfl" class="sound_only">검색대상</label>

<select name="sfl" id="sfl">
    <option value="title"<?php echo get_selected($_GET['sfl'], "title"); ?>>제목</option>
    <option value="url"<?php echo get_selected($_GET['sfl'], "url"); ?>>url</option>
</select>

<label for="stx" class="sound_only">검색어<strong class="sound_only"> 필수</strong></label>
<input type="text" name="stx" value="<?php echo $stx ?>" id="stx" required class="required frm_input">
<input type="submit" class="btn_submit" value="검색">
</form>

<form name="fpointlist" id="fpointlist" method="post" action="./push_delete.php" onsubmit="return fpointlist_submit(this);">
<input type="hidden" name="sst" value="<?php echo $sst ?>">
<input type="hidden" name="sod" value="<?php echo $sod ?>">
<input type="hidden" name="sfl" value="<?php echo $sfl ?>">
<input type="hidden" name="stx" value="<?php echo $stx ?>">
<input type="hidden" name="gubun" value="<?php echo $gubun ?>">
<input type="hidden" name="page" value="<?php echo $page ?>">
<input type="hidden" name="token" value="">

<div class="tbl_head01 tbl_wrap">
    <table>
    <caption><?php echo $g5['title']; ?> 목록</caption>
    <thead>
    <tr>
        <th scope="col">
            <label for="chkall" class="sound_only">전체</label>
            <input type="checkbox" name="chkall" value="1" id="chkall" onclick="check_all(this.form)">
        </th>
        <th scope="col"><?php echo subject_sort_link('regdate') ?>일시</a></th>
        <th scope="col"><?php echo subject_sort_link('title') ?>제목</a></th>
		<th scope="col">아이디</th>
        <!--<th scope="col">내용</th>-->
        <th scope="col" >url</th>
    </tr>
    </thead>
    <tbody>
    <?php
    for ($i=0; $row=sql_fetch_array($result); $i++) {
        $bg = 'bg'.($i%2);
    ?>

    <tr class="<?php echo $bg; ?>">
        <td class="td_chk">
            <input type="hidden" name="idx[<?php echo $i ?>]" value="<?php echo $row['idx'] ?>" id="idx_<?php echo $i ?>">
            <label for="chk_<?php echo $i; ?>" class="sound_only"><?php echo $row['idx'] ?> 내역</label>
            <input type="checkbox" name="chk[]" value="<?php echo $i ?>" id="chk_<?php echo $i ?>">
        </td>
        <td class="td_datetime"><?php echo $row['regdate'] ?></td>
        
		<td class="td_left"><?php echo get_text($row['title']) ?></td>
		<td class="" style="width:100px;"><?php echo get_text($row['id']) ?></td>
        <td class=""><?php echo $row['url'] ?></td>
        <!--<td class="td_left"><?php echo get_text($row['content']); ?></td>-->
    </tr>

    <?php
    }

    if ($i == 0)
        echo '<tr><td colspan="'.$colspan.'" class="empty_table">자료가 없습니다.</td></tr>';
    ?>
    </tbody>
    </table>
</div>

<div class="btn_fixed_top">
    <input type="submit" name="act_button" value="선택삭제" onclick="document.pressed=this.value" class="btn btn_02">
</div>

</form>

<?php 
$paging_qstr = $qstr;
if ($gubun !== '') {
    $paging_qstr .= ($paging_qstr ? '&' : '') . 'gubun=' . urlencode($gubun);
}
echo get_paging(G5_IS_MOBILE ? $config['cf_mobile_pages'] : $config['cf_write_pages'], $page, $total_page, "{$_SERVER['SCRIPT_NAME']}?{$paging_qstr}&amp;page="); 
?>


<style>
.push_guide { width:100%; float:left;border:1px solid #ddd; background-color:#f5f5f5; padding:10px; color:#333; border-radius:5px; font-size:13px; margin-bottom:20px;}
.push_guide ul {}
.push_guide ul.title {font-weight:800; line-height:200%; color:#F30;}
.push_guide ul.item { line-height:160%; font-size:13px; padding:5px 0px 5px 18px; border:none !important; background-color:#f5f5f5;}
.push_guide ul.item span { font-weight:bold;}
p.name {width:130px; display:inline-block; font-weight:bold;}
.push_btn {margin-left:5px; padding:1px 5px 4px; border-radius:3px; background-color:#999; color:#FFF !important;}
</style>

<section id="point_mng">
    <h2 class="h2_frm">푸시 알람 입력</h2>

    <div class="push_guide">	
    	<ul class="title">
        	<i class="xi-bell"></i> 푸시알림 전송방법        
        </ul>
        <ul class="item">
        	<p class="name">Step 1. 알림내용</p>
        	: 고객에게 전달할 <span>뉴스 또는 이벤트 내용을 입력</span>합니다.     
        </ul>
        <ul class="item">
        	<p class="name">Step 2. 주소</p>
        	: 공지사항에 전달하실 내용의 글을 쓰고 <span>해당 게시물의 URL을 "주소" 항목에 붙여넣기</span> 하시면 됩니다. <a href="../bbs/write.php?bo_table=notice" target="_blank" class="push_btn">공지사항 쓰러가기 →</a></li>
        </ul>
        <ul class="item">
        	<p class="name">Step 3. 전송</p>
        	: 알림내용과 주소항목을 입력한 후 <span>하단 [푸시알림 보내기] 클릭</span>하시면 <span>전체 고객에게 푸시알림이 전송</span>됩니다.
        </ul>
    </div>

    <form name="fcalllist" method="post" id="fcalllist" action="./push_update.php" autocomplete="off">
        <input type="hidden" name="sfl" value="<?php echo $sfl ?>">
        <input type="hidden" name="stx" value="<?php echo $stx ?>">
        <input type="hidden" name="sst" value="<?php echo $sst ?>">
        <input type="hidden" name="sod" value="<?php echo $sod ?>">
        <input type="hidden" name="page" value="<?php echo $page ?>">
        <input type="hidden" name="token" value="<?php echo $token ?>">
        <div class="tbl_frm01 tbl_wrap">
            <table>
            <colgroup>
                <col class="grid_4">
                <col>
            </colgroup>
            <tbody>
            <tr>
                <th scope="row" style="min-width:100px">
                    <label for="gubun">구분<strong class="sound_only">필수</strong></label>
                </th>
                <td>
                    <select name="gubun" id="gubun" class="required">
                        <option value="10">전체공지</option>
                        <option value="2">일반회원</option>
                        <option value="5">상담사</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row" style="min-width:100px"><label for="title">알림내용<strong class="sound_only">필수</strong></label></th>
                <td>
                    <input type="text" name="title" id="title" required class="required frm_input" size="120" placeholder="푸시알림 제목" >	
                </td>
            </tr>
            <tr>
                <th scope="row" style="min-width:100px"><label for="url">주소<strong class="sound_only">필수</strong></label></th>
                <td>
                <input type="text" name="url" id="url" required class="required frm_input" size="120" placeholder="전송할 게시물 URL">
                </td>
            </tr>
            </tbody>
            </table>
        </div>
        <div class="btn_confirm01 btn_confirm">
            <input type="submit" value="푸시알림 보내기" class="btn_submit btn">
        </div>
        
    </form>

</section>

<script>
function fpointlist_submit(f)
{
    if (!is_checked("chk[]")) {
        alert(document.pressed+" 하실 항목을 하나 이상 선택하세요.");
        return false;
    }

    if(document.pressed == "선택삭제") {
        if(!confirm("선택한 자료를 정말 삭제하시겠습니까?")) {
            return false;
        }
    }

    return true;
}
</script>

<?php
include_once ('./admin.tail.php');
?>
