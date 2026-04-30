<?php
include_once('../common.php');
include_once('./_common.php'); // Gnuboard 공통파일

// 로그인 체크 및 데이터 준비 (세션 등 활용)
$membid = $member['mb_1'];
$sql = "select * from platform_consulting where membid = '{$membid}' and (reason= 'DISCONNECT' or reason='END_CHAT') group by csrid order by wr_datetime desc limit 3";
$result = sql_query($sql);
//echo $sql;
$recent_list =[];
while($row = sql_fetch_array($result)){
//while($row = sql_fetch_array($sql)){
    $recent_list[] = $row;
}

foreach ($recent_list as $row) {
    $csrid = $row['csrid'];
    $cinfo = get_csrid($csrid);
    //$wr = sql_fetch("SELECT wr_id FROM g5_write_counselor WHERE mb_id = '{$row['mb_id']}' ORDER BY wr_num ASC LIMIT 1");
    $wr = sql_fetch("SELECT wr_id FROM g5_write_counselor WHERE mb_id = '{$cinfo['mb_id']}' ORDER BY wr_num ASC LIMIT 1");
    $wr_id = $wr['wr_id'];

    if (isset($cinfo['wr_id']) && $cinfo['wr_id']) $wr_id = $cinfo['wr_id'];

    $state = isset($cinfo['state']) ? $cinfo['state'] : '';
    if (!$state) {
        // $msql = "select state from g5_member where mb_id = '{$csrid}'";
        $msql = "select state from g5_member where mb_1 = '{$csrid}'";
        $mrow = sql_fetch($msql);
        $state = $mrow['state'];
    }
    $on_class = ($state == 'IDLE' or $state == 'RDVC') ? 'on' : '';
    // echo $state;
    $profile_url = "/bbs/board.php?bo_table=counselor&wr_id={$wr_id}";

    // 대기시간 계산 - 현재는 로그인한 사용자의 시간임
    $wait_sec = 0;
    $min = 0;
    if ($state == 'CONN') {
        $wait_sec = ((int)$row["mb_5"] * (int)$member["mb_point"]) / (int)$row["mb_4"];
        $min = ((int)round($wait_sec/60));
    }
    if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){
        //  var_dump($csrid); // csrid에 뭐가 들어가는지 확인
        //  var_dump($cinfo); // cinfo 값 전체 확인\

        //echo $wr;

    }
    ?>
    <li class="swiper-slide <?=$on_class?>" onclick="location.href='<?=$profile_url?>'">
        <p><?=($cinfo['mb_nick'])?></p>
        <!--        --><?php //var_dump($cinfo) ?>
        <div class="d-flex">
            <span class="call_c"></span>
            <p>
                <?php
                if ($wait_sec <= 0 && $state != 'ABSE' && $cinfo != null) {
                    echo "바로 연결";
                     // echo $state;
                    //  echo $on_class;
                }
                else {
                    echo "{$min}분 후";
                }
                ?>
            </p>
        </div>
    </li>
    <?php
}
?>
