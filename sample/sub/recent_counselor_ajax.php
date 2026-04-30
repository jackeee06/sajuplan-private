<?php
include_once('../common.php');
include_once('./_common.php'); // Gnuboard 공통파일

// 로그인 체크 및 데이터 준비 (세션 등 활용)
$membid = $member['mb_1'];
$sql = "select * from platform_consulting where membid = '{$membid}' and (reason= 'DISCONNECT' or reason='END_CHAT') group by csrid order by wr_datetime desc limit 3";
$result = sql_query($sql);
//echo $sql;
$recent_list = [];
while ($row = sql_fetch_array($result)) {
//while($row = sql_fetch_array($sql)){
    $recent_list[] = $row;
}
foreach ($recent_list as $row) {
    $csrid = $row['csrid'];
    $cinfo = get_csrid($csrid);

    // 상담사 wr_id, on_class, profile_url 선언
    $wr = sql_fetch("SELECT wr_id FROM g5_write_counselor WHERE mb_id = '{$cinfo['mb_id']}' ORDER BY wr_num ASC LIMIT 1");
    $wr_id = $wr['wr_id'];
    $profile_url = "/bbs/board.php?bo_table=counselor&wr_id={$wr_id}";

    // 상담사 상태
    $state = isset($cinfo['state']) ? $cinfo['state'] : '';
    $on_class = ($state == 'IDLE' || $state == 'RDVC' || $state == 'RDCH') ? 'on' : '';

    if (!$state) {
        $msql = "SELECT state FROM g5_member WHERE mb_1 = '{$csrid}'";
        $mrow = sql_fetch($msql);
        $state = $mrow['state'];
    }

    $wait_sec = 0;
    $min = 0;
    if ($state == 'CONN') {
        $sql="SELECT m.mb_point FROM platform_consulting t JOIN 
        g5_member m ON t.`from` = m.mb_1 WHERE t.membid = m.mb_1
    ORDER BY t.wr_datetime DESC";
        $cur_chat = sql_fetch($sql);
        $c_point = (int)$cur_chat['mb_point']; ///상담사랑 상담하는 사용자의 포인트

        if ($cur_chat) {

            if ( $c_point > 0) {
                $units = (int)($c_point / 30);
                $wait_sec = $units;
                $min = (int)ceil($wait_sec / 60);
            }
        }
    }

    ?>
    <li class="swiper-slide <?= $on_class ?>" onclick="location.href='<?= $profile_url ?>'">
        <p><?= ($cinfo['mb_nick']) ?></p>
        <div class="d-flex">
            <span class="call_c"></span>
            <p>
                <?php
                // "바로 연결": 상담사가 'CONN'이 아니거나, 대기시간 0 이하
                if ($state != 'CONN' && $wait_sec <= 0 && $state != 'ABSE') {
                    echo "바로 연결";
                } else if($wait_sec > 15){
                    echo "15분 이상";
                } else if ($state == 'ABSE'){
                    echo "부재중";
                }
                else {
                    echo "{$min}분 후";
                }
                ?>
            </p>
        </div>
    </li>
    <?php
    // 개발/테스트 중이면 아래 주석 해제 가능
    // var_dump($units);
    // echo $c_point;
    // echo $on_class;
    // var_dump($on_class);
}
?>

