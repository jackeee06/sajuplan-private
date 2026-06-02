<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH . '/head_chat.php'); //헤드 채팅용

if ($_SESSION['ss_mb_id'] == "") {
    alert("로그인이 필요합니다.", '/bbs/login.php?url=/counsel/chat.php?token=' . $_GET['token']);
    exit;
}

if (!$room_row) {
    alert('채팅방 생성에 실패했습니다.', '/index.php');
    // var_dump($room_row);
    exit;
}

if ($room_row['csr_id'] == "") {
    alert("잘못된 접근입니다", '/index.php');
    exit;
}

$chat_sql = "SELECT ct.* FROM chat_t ct LEFT JOIN chat_room crt ON ct.token = crt.room_token WHERE  ct.token = '{$room_token}' ORDER BY ct.wdate ASC";

// echo $chat_sql;
$chat_list = sql_query($chat_sql);

// mb_row , csr_row head_chat에 있음

$dt = new DateTime($room_row['room_wdate']); // 예: "2024-12-10 13:00:00"

// 요일 배열
$weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 날짜 + 요일 조합
$formatted = $dt->format('Y년 n월 j일') . ' ' . $weekdays[(int)$dt->format('w')];
?>
<!--20250730 eun 상담 종료 후 상담사 추천 및 후기 작성 시작-->
<style>
    .recommend-slide {
        padding: 12px 0 0 0;
        border-radius: 12px;
        margin-bottom: 8px;
        text-decoration-line: none;
    }

    .recommend-slide ul {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        justify-content: center;
        padding: 0;
        margin: 0;
        list-style: none;
    }

    .recommend-slide li {
        width: calc(50% - 7px);
        margin: 0;
    }

    .recommend-reviews img {
        width: 13px;
        height: 13px;
        margin-right: 1.5px;
    }

    .modal.chat .modal-box {
        /*top: auto;*/
        top: 20% !important;
    }

    .counselor_s_info {
        text-decoration-line: none;
        text-decoration: none;
    }

    .recommend-slide a {
        text-decoration: none !important;
    }

    .recommend-slide p {
        margin-bottom: 0px;
    }

    .modal-box {
        box-shadow: 0 8px 32px 0 rgba(60, 70, 110, 0.18), 0 1.5px 6px 0 rgba(20, 25, 40, 0.07);
    }
</style>
<!--20250730 eun 상담 종료 후 상담사 추천 및 후기 작성 마감-->
<input type="hidden" value="<?= $sec ?>" id="deadline">
<input type="hidden" value="<?= $is_csr ?>" id="is_csr">
<input type="hidden" value="<?= $member['mb_id'] ?>" id="mbid">
<input type="hidden" value="<?= $room_row['csr_id'] ?>" id="csrid">
<input type="hidden" value="<?= $csr_row['mb_nick'] ?>" id="csrname">
<input type="hidden" value="<?= $mb_row['mb_nick'] ?>" id="mbnick">
<input type="hidden" value="<?= $room_row['status'] ?>" id="status">
<input type="hidden" value="N" id="is_op_join">
<div class="counsel_chat scroll_bar_none msg_history">
    <div class="day_section">
        <div class="mb_20">
            <p class="day" style="margin-top: 10px;"><?php echo $formatted; ?></p>
        </div>

        <? while ($row = sql_fetch_array($chat_list)) {
            $id_row = sql_fetch("SELECT mb_1,mb_nick FROM g5_member WHERE mb_id = '{$row['mb_id']}'");
            $chat_mb_id = $id_row['mb_1'];
            $msg = $row['msg'];

            if (strpos($msg, '[img]') === 0) {
                // [img]로 시작하면 이미지 처리
                $imgPath = trim(substr($msg, 5)); // [img] 이후의 경로 추출
                $msg = '<div class="img-box"><img src="' . G5_DATA_URL . '/chat/' . $imgPath . '" alt="이미지" style="max-width:100%;"></div>';
                $is_html = true;
            } else {
                // 일반 메시지라면 htmlspecialchars로 출력
                $msg = htmlspecialchars($msg);
                $is_html = false;
            }

            if ($chat_mb_id != $member['mb_1']) {
                ?>
                <div class="mb_20 chat_temp">
                    <div class="flex align-items-start bubble_left gap_10">
                        <div class="flex align-items-center gap_10 ">
                            <? if ($is_csr == 'N') { ?>
                                <!--            <a href="./membership_profile.php">-->
                                <div class="feed-profile">
                                    <!-- <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt=""> -->
                                    <? if ($op_id) {
                                        $img_src = get_con_img($op_id, '70', '70');
                                        ?>
                                        <img src="<?= $img_src ?>">
                                    <? } ?>
                                </div>
                                <!--            </a>-->
                            <? } ?>
                        </div>
                        <!-- 말풍선 오른쪽 / 왼쪽 클래스명 확인해주세요
                        .speech_bubble.speech_bubble_left : 말풍선 왼쪽일 때
                        .speech_bubble.speech_bubble_right : 말풍선 오른쪽일 때
                          -->
                        <div class="chat-speech">
                            <div class="chat-name incoming_msg_img"><?= $id_row['mb_nick'] ?></div>
                            <div class="mb_10">
                                <div class="speech_bubble speech_bubble_left msg"
                                     style="word-break: break-all !important;"><?php
                                    if ($is_html) {
                                        echo $msg; // 이미지 HTML 그대로 출력
                                    } else {
                                        echo nl2br($msg); // 일반 텍스트 출력 (줄바꿈 포함)
                                    }
                                    ?></div>
                            </div>
                            <div class="flex align-items-center bottom_time">
                                <span class="chat-time time_date"><? echo $row['wdate'] ?></span>
                            </div>
                        </div>
                    </div>
                </div>
            <? } else { ?>
                <div class="mb_20 chat_temp">
                    <div class="flex align-items-start bubble_right gap_10">
                        <div class="chat-speech outgoing_msg_img">
                            <div class="chat-name incoming_msg_img"></div>
                            <div class="mb_10">
                                <div class="speech_bubble speech_bubble_right msg" data-toggle="modal"
                                     style="word-break: break-all !important; text-align: start;"
                                     data-target="#request_flor_btn">    <?php
                                    if ($is_html) {
                                        echo $msg; // 이미지 HTML 그대로 출력
                                    } else {
                                        echo nl2br($msg); // 일반 텍스트 출력 (줄바꿈 포함)
                                    }
                                    ?></div>
                            </div>
                            <div class="flex align-items-center bottom_time gap_05">
                                <span class="chat-time read"></span> <!-- 상대방이 읽었을 때 -->
                                <!-- <span class="chat-time read-no">1</span> -->
                                <span class="g-ling"></span>
                                <span class="chat-time time_date"><? echo $row['wdate'] ?></span>
                            </div>
                        </div>
                    </div>
                </div>

            <? } ?>
        <? } ?>
        <template data-template="in_msg_temp">
            <div class="mb_20 chat_temp">
                <div class="flex align-items-start bubble_left gap_10">
                    <div class="flex align-items-center gap_10 ">
                        <? if ($is_csr == 'N') { ?>
                            <!-- <a href="./membership_profile.php"> -->
                            <div class="feed-profile">
                                <!-- <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt=""> -->
                                <?php if ($op_id) {
                                    $img_src = get_con_img($op_id, '70', '70');
                                    ?>
                                    <img src="<?= $img_src ?>">
                                    <? ?>
                                <? } ?>
                            </div>
                            <!-- </a> -->
                        <? } ?>
                    </div>
                    <!-- 말풍선 오른쪽 / 왼쪽 클래스명 확인해주세요
                    .speech_bubble.speech_bubble_left : 말풍선 왼쪽일 때
                    .speech_bubble.speech_bubble_right : 말풍선 오른쪽일 때
                      -->
                    <div class="chat-speech">
                        <div class="chat-name incoming_msg_img">
                        </div>
                        <div class="mb_10">
                            <div class="speech_bubble speech_bubble_left msg"
                                 style="word-break: break-all !important;"></div>
                        </div>
                        <div class="flex align-items-center bottom_time">
                            <span class="chat-time time_date"></span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template data-template="out_msg_temp">
            <div class="mb_20 chat_temp">
                <div class="flex align-items-start bubble_right gap_10">
                    <div class="chat-speech outgoing_msg_img">
                        <div class="mb_10">
                            <div class="speech_bubble speech_bubble_right msg" data-toggle="modal"
                                 data-target="#request_flor_btn" style="word-break: break-all !important; text-align: start;"></div>
                        </div>
                        <div class="flex align-items-center bottom_time gap_05">
                            <span class="chat-time read"></span> <!-- 상대방이 읽었을 때 -->
                            <!-- <span class="chat-time read-no">1</span> -->
                            <!-- <span class="chat-time read-show">읽음</span> -->
                            <span class="g-ling"></span>
                            <span class="chat-time time_date"></span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <!-- <div class="flex align-items-start bubble_left gap_10">
                <div class="flex align-items-center gap_10">
                    <a href="./membership_profile.php">
                        <div class="feed-profile">
                            <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt="">
                        </div>
                    </a>
                </div>
                <div class="chat-speech">
                    <div class="chat-name">
                        <p>신비님</p>
                    </div>
                    <div class="mb_10">
                        <div class="img-box speech_bubble_left">
                            <img src="../../../img/sample/test-img.png" alt="">
                        </div>
                    </div>
                    <div class="mb_10">
                        <div class="speech_bubble speech_bubble_left">어떤 고민이 있을꼬?</div>
                    </div>
                    <div class="flex align-items-center bottom_time">
                        <span class="chat-time">오후 02:00</span>
                    </div>
                </div>
            </div> -->
    </div>
    <!-- <div class="flex align-items-start bubble_left gap_10">
            <div class="flex align-items-center gap_10">
                <a href="./membership_profile.php">
                    <div class="feed-profile">
                        <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt="">
                    </div>
                </a>
            </div>
            <div class="chat-speech">
                <div class="chat-name">
                    <p>신비님</p>
                </div>
                <div class="mb_10">
                    <div class="speech_bubble entering speech_bubble_left">
                        <img src="../../../img/common/typing_animation.gif" alt="" >
                    </div>
                </div>
            </div>
        </div> -->
</div>
</div>
</div>
<div class="bottom_btn">
    <div class="flex align-items-center gap_10">
        <input type="file" id="imageInput" accept="image/*" style="display: none;">
        <div class="upload-btn">
            <button type="button" id="uploadTrigger">
                <img src="../../../img/common/more.svg" alt="사진 업로드">
            </button>
        </div>
        <div class="chat-box">
            <form class="flex align-items-center gap_10" onsubmit="SendMsg2ServerSubmit(); return false;">
                <input oninput="typing_chat()" type="text" id="textinput" class="form-control flex-fill border-0"
                       placeholder="입력하세요" data-has-listeners="true">
                <button class="btn send-btn mt-0" type="button" onclick="SendMsg2ServerSubmit()">전송</button>
            </form>
        </div>
    </div>
</div>

<!-- 상담시간이 1분 남았을 때 나오는 모달 -->
<div class="modal chat" id="plus-time"><!-- 나타날때 - show 클래스 추가 -->
    <div class="modal-box">
        <div class="modal-head">
            <p>상담시간이 1분 남았습니다!</p>
        </div>
        <div class="modal-body">
            <p>추가 결제하고 상담을 더 받으시겠습니까?</p>
        </div>
        <div class="modal-footer">
            <button class="cancle-btn">취소</button>
            <button class="color-btn" onclick="location.href='../coin/coin_fill.php' ">결제하기</button>
        </div>
    </div>
</div>

<!--20250730 eun 상당 종료 여부 확인 모달 작업 시작-->
<!-- 나가기 버튼을 눌렀을 때 나가는 거 확인하는 모달 -->
<div class="modal chat" id="chat-exit"><!-- 나타날때 - show 클래스 추가 -->
    <div class="modal-box">
        <div class="modal-head">
            <p>상담 종료</p>
        </div>
        <div class="modal-body">
            <p>채팅 상담을 종료하시겠습니까?</p>
        </div>
        <div class="modal-footer">
            <button class="cancle-btn" onclick="dismiss_chat_exit_modal()">취소</button>
            <button class="color-btn" onclick="exit_chat()">종료하기</button>
        </div>
    </div>
</div>
<!--20250730 eun 상당 종료 여부 확인 모달 작업 마감-->

<!-- 상담시간이 종료되었을때 나오는 모달 -->
<!--<div class="modal chat" id="timer-end">
	<div class="modal-box">
		<div class="modal-head">
			<p>상담이 종료되었습니다.</p>
		</div>

		<div class="modal-body">
			<p>상담은 어떠셨나요?<br>솔직한 후기를 남겨주세요.</p>
		</div>
		<div class="modal-footer">
			<button class="cancle-btn">취소</button>
			<button class="color-btn" onclick="location.href='../bbs/write.php?bo_table=review&csr_id=<?php /*=$csr_row["mb_id"]*/ ?>' ">후기쓰기</button>
		</div>
	</div>
</div>-->

<!--20250730 eun 상담사 2명 추천 추가 및 분기 작업 시작-->
<!-- 상담시간이 종료되었을때 나오는 모달 -->
<div class="modal chat" id="timer-end">
    <div class="modal-box">
        <div class="modal-head">
            <p>상담이 종료되었습니다.</p>
        </div>
        <?php if ($member['mb_level'] != 5) { ?>
            <div class="modal-body" style="margin-bottom: 0px !important;">
                <p>상담은 어떠셨나요?<br>솔직한 후기를 남겨주세요.</p>
            </div>
        <?php } else { ?>
            <div class="modal-body" style="margin-bottom: 0px !important;">
                <p>상담은 어떠셨나요?<br>상담 메모를 작성해주세요.</p>
            </div>
        <?php } ?>
        <?php if ($member['mb_level'] != 5) { ?>
            <div class="recommend-slide">
                <p style="margin-bottom: 2.5px; text-align: center"><strong>다음번엔 사주플랜 추천 상담사와 상담 어떠신가요?</strong></p>
                <ul>
                    <?php
                    // 상담한 상담사 ID 목록을 반환하는 함수
                    function get_consulted_counselors($user_mb_id)
                    {
                        if (!$user_mb_id) {
                            return []; // 로그인 정보 없으면 빈 배열 리턴
                        }
                        // SQL 인젝션 방지
                        $user_mb_id = sql_real_escape_string($user_mb_id);
                        // 중복 제거를 위해 DISTINCT 사용
                        $sql = "SELECT DISTINCT csrid FROM platform_consulting
                        WHERE membid = '{$user_mb_id}'
                           AND reason = 'DISCONNECT'
                        ";
                        $result = sql_query($sql);
                        $ids = [];
                        while ($r = sql_fetch_array($result)) {
                            $ids[] = $r['csrid'];
                        }
                        return $ids;
                    }

                    // ────────────────────────────────────────────────────────────
                    // 1. 현재 로그인한 사용자 ID
                    // ────────────────────────────────────────────────────────────
                    $user_mb_id = $member['mb_id'];
                    // 2. 방금 상담한 상담사 목록 (csrid) 조회
                    $consulted_mb_ids = get_consulted_counselors($user_mb_id);

                    // 2-1. 방금 상담한 상담사(현재 CSR)도 제외
                    $current_csr = $room_row['csr_id'];
                    if ($current_csr) {
                        $consulted_mb_ids[] = $current_csr;
                    }
                    $consulted_mb_ids = array_unique(array_filter($consulted_mb_ids));

                    // ────────────────────────────────────────────────────────────
                    // 3. 추천 상담사 쿼리
                    //    • mb_sort 1~20위      (사주플랜 추천 순위)
                    //    • state = 'IDLE'      (상담 가능)
                    //    • 상담한 사람 제외
                    //    • 랜덤 2명 추출
                    // ────────────────────────────────────────────────────────────

                    // 3. 추천 쿼리 생성 (방금 상담한 상담사 포함 모든 상담사 제외)
                    $in_clause = "";
                    if (!empty($consulted_mb_ids)) {
                        // SQL 인젝션 방지 위해 sql_real_escape_string() 사용을 가정
                        $safe_ids = array_map('sql_real_escape_string', $consulted_mb_ids);
                        $in_clause = "AND mb_1 NOT IN ('" . implode("','", $safe_ids) . "')";
                    }

                    //$sql = "SELECT mb_id, mb_nick, mb_4, mb_5, mb_sort, state
                    $sql = "SELECT mb_id, mb_nick, mb_13, mb_12, mb_sort, state
                        FROM {$g5['member_table']}
                         WHERE mb_sort BETWEEN 1 AND 20
                             AND state = 'IDLE' {$in_clause}
                         ORDER BY RAND() LIMIT 2";

                    /*// 5. (디버깅용) SQL 확인
                    if ($_SERVER['REMOTE_ADDR'] === "115.93.39.5") {
                        echo '<pre style="background:#eef; padding:10px;">';
                        echo "recommendation SQL:\n{$sql}\n";
                        echo '</pre>';
                    }*/

                    $result = sql_query($sql);
                    // ────────────────────────────────────────────────────────────
                    // 4. 화면에 출력
                    // ────────────────────────────────────────────────────────────
                    while ($row = sql_fetch_array($result)) {
                        // (1) 상담사 대표글 정보
                        $wr = sql_fetch("
                                        SELECT wr_id, ca_name
                                          FROM g5_write_counselor
                                         WHERE mb_id = '{$row['mb_id']}'
                                         ORDER BY wr_num ASC
                                         LIMIT 1
                                        ");
                        $wr_id = $wr['wr_id'];
                        $ca_name = $wr['ca_name'];
                        $cate_bg = ['타로' => 'tarot', '신점' => 'sinjeom', '사주' => 'saju', '심리' => 'simli'];
                        // (2) 썸네일
                        if ($wr_id) {
                            $thumb = get_list_thumbnail('counselor', $wr_id, 116, 120, false, true);
                            $thumb_src = $thumb['src'] ?: '/img/common/noimage.png';
                        } else {
                            $thumb_src = '/img/common/noimage.png';
                        }
                        // (3) 후기 개수
                        $review_cnt = get_counselor_afcnt($row['mb_id']);
                        // 링크
                        $profile_url = "/bbs/board.php?bo_table=counselor&wr_id={$wr_id}";
                        ?>
                        <li><a href="<?= $profile_url ?>">
                                <div class="proflie"><img width="50" height="50" src="<?= $thumb_src ?>" alt="프로필">
                                </div>
                                <div class="counselor_s_info">
                                    <div class="top"><span
                                                class="icon_cate <?= $cate_bg[$ca_name] ?? '' ?>"><?= $ca_name ?></span>
                                        <p><?= $row['mb_nick'] ?></p></div>
                                    <div class="bottom"><p>
                                            <!--                                        <span>-->
                                            <?php //= number_format($row['mb_4']) ?><!--원</span> -->
                                            <?php //= $row['mb_5'] ?><!--초당</p><span-->
                                            <span><?= number_format($row['mb_13']) ?>원</span> <?= $row['mb_12'] ?>초당</p>
                                        <span
                                                class="g-line"></span>
                                        <div class="flex align-items-center gap_02"><img
                                                    src="../../../img/main/ic_review.svg">
                                            <p><?= number_format($review_cnt) ?></p></div>
                                    </div>
                                </div>
                            </a></li>
                        <?php
                    }
                    ?>
                </ul>
            </div>
        <?php } ?>
        <?php if ($member['mb_level'] != 5) { ?>

            <div class="modal-footer">
                <button onclick="location.href='../my/chat_record.php' ">종료</button>
                <button class="color-btn"
                        onclick="location.href='../bbs/write.php?bo_table=review&csr_id=<?= $csr_row["mb_id"] ?>&cno=<?= $csr_row["no"] ?>' ">
                    후기작성
                </button>
            </div>
        <?php } else { ?>
            <div class="modal-footer">
                <button onclick="location.href='../my/chat_record.php' ">종료</button>
                <button class="color-btn" onclick="location.href='../my/chat_record.php?'">상담메모작성</button>
            </div>
        <?php } ?>
    </div>
</div>


<!-- 20250730 eun 상담사 2명 추천 추가 및 분기 작업 마감-->
<script>
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    var token = getQueryParam('token');

    // var token = "mn8iUD2"; // api호출하여 수신한 json변수의 token값임: memb_token과 csr_token구분
    // cid:connection id(ws서버입장), Tid:TransactionID(서버입장),MembId(웹관리자),CsrId(웹관리자),IdTp(memb or csr),RoomId(token 맨뒤1 byte제거)
    var cid;
    var tid;
    var membid;
    var csrid;
    var idtp;
    var roomid;
    let firstJoin = true;

    $(document).ready(function () {
        console.log('️ startInterval()', 'firstJoin=', firstJoin, 'is_csr=', $('#is_csr').val());
        startInterval();
    });

    let intervalId = null; // 인터벌 ID 저장 변수

    function startInterval() {
        if (intervalId === null) {
            intervalId = setInterval(() => {
                if (!firstJoin && $('#is_csr').val() == 'N') {
                    $.ajax({
                        url: './ajax.counsel_chat.php',
                        method: 'POST',
                        data: {token: token, act: 'updateTime'},
                        success: function (res) {
                            console.log('use_time +10 업데이트 완료');
                        }
                    });
                }
            }, 10000); // 10초마다 실행
        }
    }

    function stopInterval() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
            console.log('️ 인터벌 중지');
        }
    }


    document.getElementById('uploadTrigger').addEventListener('click', function () {
        if (!statusCheck()) return;
        document.getElementById('imageInput').click();
    });
</script>

<link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.css"
        type="text/css"
        rel="stylesheet"
/>

<!-- <script src="http://netdna.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js"></script> -->
<script>
    const possibleEmojis = [
        ""
    ];
    const emoji_idx = Math.floor(Math.random() * possibleEmojis.length);
    const other_emoji_idx = Math.floor(Math.random() * possibleEmojis.length);

    var conn;
    let rejoinMarked = false;
    window.__joinAnnouncedOnce = false;  // ← 유저 화면 중복 방지


    // 이전 상태 스냅샷 저장 (이탈/재입장 행위자 판별용)
    window.__roomFlagsPrev = null; // { m_try_out:'Y|N', c_try_out:'Y|N' }


    //20250909 eun  추가 시작
    let statusPollTimer = null; // (아래에서 사용)

    function endSessionUI(opts = {}) {
        const { closeSocket = true, showModal = true, reason = 'DISCONNECT', from = '' } = opts;

        // 1) 상태 고정
        $('#status').val('DISCONNECT');

        // 2) 타이머/인터벌/폴링 중단
        try { stopCountdown?.(); } catch(e) {}
        try { stopInterval?.(); } catch(e) {}
        if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }

        // 3) 입력/업로드 완전 비활성
        $('#textinput').prop('disabled', true);
        $('.send-btn').prop('disabled', true);
        $('#uploadTrigger').prop('disabled', true).attr('disabled', 'disabled');

        // 4) 모달
        if (showModal) {
            const endModal = document.getElementById('timer-end');
            if (endModal && !endModal.classList.contains('show')) endModal.classList.add('show');
        }

        // 5) 재연결 타이머 정리
        if (typeof _wsReconnectTimer !== 'undefined' && _wsReconnectTimer) {
            clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null;
        }
        if (typeof stopHeartbeat === 'function') stopHeartbeat();

        // 6) 소켓 닫기 (가능하면)
        if (closeSocket) {
            try { conn?.close?.(); } catch(e) {}
        }

        console.log('[endSessionUI] applied', { reason, from });
    }
    //20250909 eun  추가 마감

    function insertMessageToDOM(options, isFromMe, htmlFlag, sendTime) {
        if (isFromMe) {
            insertMessageToDOM_OUT(options, isFromMe, htmlFlag, sendTime);
        } else {
            insertMessageToDOM_IN(options, isFromMe, htmlFlag, sendTime);
        }
    }

    function insertMessageToDOM_IN(options, isFromMe, htmlFlag, sendTime) {
        const template = document.querySelector(
            'template[data-template="in_msg_temp"]'
        );
        const nameEl = template.content.querySelector(".incoming_msg_img");
        if (options.emoji || options.name) {
            nameEl.innerText = options.emoji + " " + options.name;
        }
        template.content.querySelector(".time_date").innerText = sendTime;
        if (htmlFlag == true) {
            template.content.querySelector(".msg").innerHTML = options.content;
        } else {
            template.content.querySelector(".msg").innerText = options.content;
        }

        const clone = document.importNode(template.content, true);
        const messageEl = clone.querySelector(".in_msg_temp");

        const messagesEl = document.querySelector(".msg_history");
        messagesEl.appendChild(clone);
        messagesEl.scrollTop =
            messagesEl.scrollHeight - messagesEl.clientHeight;
    }

    function insertMessageToDOM_OUT(options, isFromMe, htmlFlag, sendTime) {
        const template = document.querySelector(
            'template[data-template="out_msg_temp"]'
        );
        const nameEl = template.content.querySelector(".outgoing_msg_img");
        if (options.emoji || options.name) {
            //nameEl.innerText = options.emoji + ' ' + options.name;
        }
        template.content.querySelector(".time_date").innerText = sendTime;
        if (htmlFlag == true) {
            template.content.querySelector(".msg").innerHTML = options.content;
        } else {
            template.content.querySelector(".msg").innerText = options.content;
        }

        const clone = document.importNode(template.content, true);
        const messageEl = clone.querySelector(".out_msg_temp");

        const messagesEl = document.querySelector(".msg_history");
        messagesEl.appendChild(clone);
        messagesEl.scrollTop =
            messagesEl.scrollHeight - messagesEl.clientHeight;
    }

    function msgOut(js, MyFlag, sendTime) {
        var idx;
        if (js.FromCid < 0) {
            js.FromName = $('#csrname').val() || "관리자";
        }
        if (MyFlag == true) {
            idx = emoji_idx;
        } else {
            idx = other_emoji_idx;
        }
        const dataTmp = {
            name: js.FromName,
            content: js.JoMsg.Msg,
            emoji: possibleEmojis[idx],
        };

        if (js.JoMsg?.Msg !== undefined) {
            insertMessageToDOM(dataTmp, MyFlag, false, sendTime);
        }

    }

    function msgOutHtml(js, MyFlag, sendTime) {
        var idx;
        if (MyFlag == true) {
            idx = emoji_idx;
        } else {
            idx = other_emoji_idx;
        }
        if (js.FromCid < 0) {
            js.FromName = $('#csrname').val() || "관리자";
        }
        const dataTmp = {
            name: js.FromName,
            content: js.JoMsg.Msg,
            emoji: possibleEmojis[idx],
        };
        insertMessageToDOM(dataTmp, MyFlag, true, sendTime);
    }

    function sendRoomOut2Srv(cidprm, tidprm) {
        const svrData = {
            CmdTp: "room_out_req",
            Cid: Number(cidprm),
            Tid: tidprm, // 명령내린Tid
        };
        const jsStr = JSON.stringify(svrData);
        try { conn.send(jsStr); } catch(e) { console.error('[WS] sendRoomOut2Srv failed:', e); }
    }

    // ── WebSocket 자동 재연결 설정 ──
    let wsReconnectAttempts = 0;
    const WS_MAX_RECONNECT = 5;
    const WS_RECONNECT_BASE_DELAY = 2000; // 2초, 매 시도마다 2배 증가
    let wsHeartbeatTimer = null;
    let _wsReconnectTimer = null;

    // 닉네임 안전 이스케이프 (전역)
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function startHeartbeat() {
        stopHeartbeat();
        wsHeartbeatTimer = setInterval(function() {
            if (conn && conn.readyState === WebSocket.OPEN) {
                try { conn.send(JSON.stringify({CmdTp: "ping"})); } catch(e) {}
            }
        }, 30000); // 30초마다 ping
    }

    function stopHeartbeat() {
        if (wsHeartbeatTimer) { clearInterval(wsHeartbeatTimer); wsHeartbeatTimer = null; }
    }

    function attemptReconnect() {
        if ($('#status').val() === 'DISCONNECT') return;
        if (wsReconnectAttempts >= WS_MAX_RECONNECT) {
            // 재연결 한도 초과 → 영구 종료
            const value = "죄송합니다. 네트워크 오류로 연결이 끊겼습니다. 상담 종료 후 다시 이용부탁드립니다.";
            insertMessageToDOM({ name: "시스템", content: value }, false, false, '');
            if ($('#is_csr').val() === 'N') {
                $.post('./ajax.counsel_chat.php', {
                    act: 'storeChat', mbid: 'SYSTEM',
                    token: '<?=$room_token?>',
                    msg: value, msg_type: 3
                });
            }
            endSessionUI({ closeSocket: false, showModal: true, reason: 'reconnect-failed', from: 'reconnect' });
            return;
        }
        wsReconnectAttempts++;
        var delay = Math.min(WS_RECONNECT_BASE_DELAY * Math.pow(2, wsReconnectAttempts - 1), 30000);
        console.log('[WS] reconnect attempt ' + wsReconnectAttempts + '/' + WS_MAX_RECONNECT + ' in ' + delay + 'ms');
        insertMessageToDOM({ name: "시스템", content: "연결이 끊어졌습니다. 재연결 시도 중... (" + wsReconnectAttempts + "/" + WS_MAX_RECONNECT + ")" }, false, false, '');
        _wsReconnectTimer = setTimeout(function() {
            if ($('#status').val() === 'DISCONNECT') return;
            initWebSocket();
        }, delay);
    }

    function initWebSocket() {
        try {
            conn = new WebSocket("wss://passcall.co.kr:28729/wscp/" + token);
        } catch(e) {
            console.error('[WS] new WebSocket failed:', e);
            attemptReconnect();
            return;
        }

        conn.onerror = function(evt) {
            console.error('[WS] error event', evt);
        };

        conn.onclose = function (evt) {
            stopHeartbeat();
            if ($('#status').val() === 'DISCONNECT') {
                // 정상 종료(이미 DISCONNECT) - 재연결 불필요
                return;
            }
            // 비정상 종료 - 자동 재연결 시도
            console.log('[WS] connection closed unexpectedly, code:', evt.code, 'reason:', evt.reason);
            attemptReconnect();
        };

        conn.onmessage = function (evt) {


            console.log(
                "->message receive data[" + evt.data + "] cid[" + cid + "]"
            );
            const js = JSON.parse(evt.data);
            var opt1;

            // send time 공통
            var sendTime = js.SendTime;

            switch (js.CmdTp) {
                /*case "room_in_noti": // 방입장 통지
                    // js.JoMsg.RoomId, MembId,CsrId,IdTp 공통: 아래 메시지들 동일(미연결시에는 공백)
                    csrid = js.JoMsg.CsrId;
                    membid = js.JoMsg.MembId;
                    let rejoinMarked = false;

                    /!*if (csrid == $('#csrid').val() && $('#is_csr').val() == 'N') {
                       // updateCountdown();
                        startCountdown();
                        firstJoin = false;
                        $('#is_op_join').val('Y');
                        updateReadStatus();
                    } else if (csrid == '' && $('#is_csr').val() == 'Y') {
                        startCountdown();
                        firstJoin = false;
                        $('#is_op_join').val('Y');
                        updateReadStatus();
                    }*!/


                    startInterval();

                    // 상대 이름 결정
                    const name = ($('#is_csr').val() == 'N') ? $('#csrname').val() : $('#mbnick').val();
                    const safeName = escapeHtml(name);


                    if (/\[.*?\]님이/.test(js.JoMsg.Msg) && $('#is_csr').val() == 'N' && membid == '') {
                        js.JoMsg.Msg = js.JoMsg.Msg.replace(/\[.*?\]님이/, '[' + $('#csrname').val() + ']님이');
                    } else if (/\[.*?\]님이/.test(js.JoMsg.Msg) && $('#is_csr').val() == 'N' && membid != '') {
                        /!*js.JoMsg.Msg = js.JoMsg.Msg.replace(
                            /\[.*?\]님이.*!/,
                            '[' + $('#mbnick').val() + ']님, 상담사가 입장하면 포인트 차감이 시작됩니다. ' < br > ' 조금만 기다려주세요.'
                        );*!/
                        // room_in_noti 분기 중, 회원 화면 && 상담사 입장 안내문 치환하는 그 자리
                        const safeNick = escapeHtml($('#mbnick').val());
                        js.JoMsg.Msg = js.JoMsg.Msg.replace(
                            /\[.*?\]님이.*!/,
                            `[${safeNick}]님, 상담사가 입장하면 포인트 차감이 시작됩니다.<br>조금만 기다려주세요.`
                    //    js.JoMsg.Msg = `[${safeNick}]님, <strong>상담사가 입장하면</strong> 포인트 차감이 시작됩니다.<br><small class="text-muted">조금만 기다려주세요.</small>`;

                    );
                        js.JoMsg.HtmlFlag = true;
                        //멤버 번호가 있고, 사용자임
                    } else if (/\[.*?\]님이/.test(js.JoMsg.Msg) && $('#is_csr').val() == 'Y' && csrid == '') {
                        js.JoMsg.Msg = js.JoMsg.Msg.replace(/\[.*?\]님이/, '[' + $('#mbnick').val() + ']님이');
                    } else if (/\[.*?\]님이/.test(js.JoMsg.Msg) && $('#is_csr').val() == 'Y' && csrid != '') {
                        js.JoMsg.Msg = js.JoMsg.Msg.replace(/\[.*?\]님이.*!/, '[' + $('#mbnick').val() + ']님과의 상담이 시작되었습니다.');
                    }


                    getRoomFlags(function(res){
                        if (res && res.success && (res.rejoin === 'Y' || res.try_out === 'Y')) {
                            js.JoMsg.Msg = `[${safeName}]님이 재입장했습니다.`;
                        } else {
                            js.JoMsg.Msg = `[${safeName}]님이 입장했습니다.`;
                        }
                        js.JoMsg.HtmlFlag = false;  // 안전하게 텍스트로
                        msgOut(js, false, sendTime);
                    });
                    break;


                    // msgOut(js, false, sendTime);
                    msgOutHtml(js, false, sendTime);
                    break;*/
                case "room_in_noti": {
                    csrid  = js.JoMsg.CsrId;
                    membid = js.JoMsg.MembId;

                    if ($('#is_csr').val() == 'N' && isCounselorJoinEvent(js)) {
                        startCountdown(); firstJoin = false; $('#is_op_join').val('Y'); updateReadStatus();
                    } else if (csrid == '' && $('#is_csr').val() == 'Y') {
                        startCountdown(); firstJoin = false; $('#is_op_join').val('Y'); updateReadStatus();
                    }
                    startInterval();

                    getRoomFlags(function(flags){
                        const cur  = flags && flags.success ? { m_try_out: flags.m_try_out, c_try_out: flags.c_try_out } : null;
                        const prev = window.__roomFlagsPrev;
                        const fb   = resolveActorFromEvt(js);
                        const act  = resolveActorFromFlags(prev, cur, fb);
                        window.__roomFlagsPrev = cur;

                        const membName = escapeHtml($('#mbnick').val()  || '');
                        const csrName  = escapeHtml($('#csrname').val() || '');
                        const usedSec  = Number((flags && flags.use_time) || 0);

                        let sysMsg, isHtml = false;

                        if (usedSec === 0) {
                            if (act.role === 'csr') {
                                // ★ 상담사 실제 입장: 사용자 화면에만 1회 표시, DB 저장/재브로드캐스트 없음
                                if ($('#is_csr').val() === 'N' && !window.__joinAnnouncedOnce) {
                                    sysMsg = `[${csrName}]님이 입장했습니다. 상담을 시작합니다.`;
                                    outputSysMsg(js, sysMsg, false, false, sendTime);
                                    window.__joinAnnouncedOnce = true;
                                }
                                return; // ★ 여기서 끝내 저장/중복 출력 방지
                            } else {
                                // ★ 상담사 미입장: 안내문은 사용자 화면에만 표시, 저장 X
                                if ($('#is_csr').val() === 'N') {
                                    sysMsg = `[${membName}]님, 상담사가 입장하면 포인트 차감이 시작됩니다.<br>조금만 기다려주세요.`;
                                    outputSysMsg(js, sysMsg, true, false, sendTime);
                                }
                                return; // ★ 저장/중복 방지
                            }
                        }

                        // usedSec > 0 : 재입장/입장 안내 (이건 저장해도 OK)
                        const actorName = (act.role === 'csr') ? csrName : membName;
                        const rejoin    = (act.reason === 'rejoin');
                        sysMsg = `[${actorName}]님이 ${rejoin ? '재입장' : '입장'}했습니다.`;

                        // 출력 + DB 저장 (회원 쪽에서만 저장하여 중복 방지)
                        outputSysMsg(js, sysMsg, isHtml, false, sendTime);
                        if ($('#is_csr').val() === 'N') {
                            $.post('./ajax.counsel_chat.php', {
                                act: 'storeChat', mbid: 'SYSTEM', token: '<?=$room_token?>', msg: sysMsg, msg_type: 3
                            });
                        }
                    });
                    break;
                }


                case "room_out_noti": { // 방퇴장 통지
                    csrid = js.JoMsg.CsrId;

                    if (csrid == $('#csrid').val() && $('#is_csr').val() == 'N') {
                        stopInterval(); $('#is_op_join').val('N');
                    } else if (csrid == '' && $('#is_csr').val() == 'Y') {
                        $('#is_op_join').val('N');
                    }

                    getRoomFlags(function(flags){
                        const cur  = flags && flags.success ? { m_try_out: flags.m_try_out, c_try_out: flags.c_try_out } : null;
                        const prev = window.__roomFlagsPrev;
                        const fb   = resolveActorFromEvt(js);
                        const act  = resolveActorFromFlags(prev, cur, fb);
                        window.__roomFlagsPrev = cur;

                        //20250909 추가
                        // 서버 상태가 DISCONNECT면 즉시 하드 스톱
                        if (flags && flags.success && flags.status === 'DISCONNECT') {
                            endSessionUI({ closeSocket: true, showModal: true, reason: 'room_out_noti', from: 'ws' });
                            return;
                        }
                        //20250909 추가

                        const membName = escapeHtml($('#mbnick').val()  || '');
                        const csrName  = escapeHtml($('#csrname').val() || '');
                        const actorName = (act.role === 'csr') ? csrName : (act.role === 'memb' ? membName : (fb.role==='csr'?csrName:membName));

                        let tail = '퇴장했습니다.';
                        if (flags && flags.success) {
                            if (flags.status === 'DISCONNECT') {
                                tail = '상담을 종료했습니다.';
                            } else {
                                const actorTried =
                                    (act.role === 'memb' && flags.m_try_out === 'Y') ||
                                    (act.role === 'csr'  && flags.c_try_out === 'Y') ||
                                    window.__leftByBeacon__;
                                if (actorTried) tail = '잠시 이탈했습니다.';
                            }
                        }

                        const sysMsg = `[${actorName}]님이 ${tail}`;
                        console.log('[OUT]', {prev, cur, fb, act, tail, sysMsg});
                        outputSysMsg(js, sysMsg, false, false, sendTime);

                        // 회원 쪽에서만 저장하여 중복 방지
                        if ($('#is_csr').val() === 'N') {
                            $.post('./ajax.counsel_chat.php', {
                                act: 'storeChat', mbid: 'SYSTEM', token: '<?=$room_token?>', msg: sysMsg, msg_type: 3
                            });
                        }
                    });
                    break;
                }
                //20250909 eun 추가
                case "room_closed": {
                    // 서버가 명시적으로 방 종료를 푸시하는 경우
                    endSessionUI({ closeSocket: true, showModal: true, reason: 'room_closed', from: 'ws' });
                    break;
                }

                //20250909 eun 마감

                case "system_notify": {
                    const sysMsg = js.JoMsg.Msg || '시스템 알림';

                    js.JoMsg.HtmlFlag = false;
                    msgOut(js, false, sendTime);

                    // 회원 쪽에서만 저장하여 중복 방지
                    if ($('#is_csr').val() === 'N') {
                        $.post('./ajax.counsel_chat.php', {
                            act: 'storeChat',
                            mbid: 'SYSTEM',
                            token: '<?=$room_token?>',
                            msg: sysMsg,
                            msg_type: 3
                        });
                    }
                    break;
                }

                case "cli_connect_ok":
                    tid = js.JoMsg.Tid;
                    membid = js.JoMsg.MembId;
                    csrid = js.JoMsg.CsrId;
                    idtp = js.JoMsg.IdTp;
                    roomid = js.JoMsg.RoomId;
                    cid = js.JoMsg.Cid;
                    console.log("연결성공[", js, "]");
                    break;
                case "cli_disconnect": // 끊어진 사실 통지
                    console.log('js :');
                    console.log(js);
                    msgOut(js, false, sendTime);
                    break;
                case "conv_msg": // 대화내용 수신
                    var myDispFlag = false;
                    if (cid == js.FromCid) {
                        myDispFlag = true;
                    }
                    // [img]로 시작하는 메시지 처리
                    if (typeof js.JoMsg.Msg === 'string' && js.JoMsg.Msg.startsWith('[img]')) {
                        // [img] 이후 부분만 추출 (예: [img]경로)
                        var imgPath = js.JoMsg.Msg.substring(5).trim();

                        // 이미지 태그로 변환
                        js.JoMsg.Msg = '<div class="img-box"><img src="' + '<?=G5_DATA_URL?>/chat/' + imgPath + '" alt="이미지" style="max-width:100%;"></div>';
                        js.JoMsg.HtmlFlag = true; // HTML 태그 포함으로 표시
                    }
                    if (typeof js.JoMsg.Msg === 'string' && js.JoMsg.Msg.startsWith('[typing]') && !myDispFlag) {
                        js.JoMsg.Msg = '<img class="chatting" src="/img/common/typing_animation.gif" alt="" >';
                        js.JoMsg.HtmlFlag = true; // HTML 태그 포함으로 표시
                    } else {
                        $('.chatting').closest('.chat_temp').remove();
                    }
                    // 공지
                    if (js.FromCid < 0) {
                        myDispFlag = false;
                    } else if (js.FromCid != js.ToCid && $('#is_csr').val() == 'N') {
                        js.FromName = $('#csrname').val();
                    } else if (js.FromCid != js.ToCid && $('#is_csr').val() == 'Y') {
                        js.FromName = $('#mbnick').val();
                    }

                    if (js.JoMsg.Msg != '[typing]') {
                        if (js.JoMsg.HtmlFlag == true) {
                            msgOutHtml(js, myDispFlag, sendTime);
                        } else {
                            msgOut(js, myDispFlag, sendTime);
                        }
                        $(window).scrollTop($(window).scrollTop() + 300);
                    }
                    if (js.FromCid >= 0 && js.FromCid != js.ToCid) {
                        // updateCountdown();
                        startCountdown();
                        firstJoin = false;
                        $('#is_op_join').val('Y');
                        updateReadStatus();
                    }
                    startInterval();
                    break;
                default: // 공지등 일반내용은 여기로 들어감
                    msgOut(js, false, sendTime);
                    break;
            }
        };
        conn.onopen = function (evt) {
            // 재연결 성공 시 안내
            if (wsReconnectAttempts > 0) {
                console.log('[WS] reconnected after ' + wsReconnectAttempts + ' attempts');
                insertMessageToDOM({ name: "시스템", content: "연결이 복구되었습니다." }, false, false, '');
            }
            wsReconnectAttempts = 0;
            if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
            startHeartbeat();

            const regist = {CmdTp: "regist", Token: token};
            conn.send(JSON.stringify(regist));

            if (!rejoinMarked) {
                $.post('./ajax.counsel_chat.php', {act: 'rejoin', token: token}, function () {
                    rejoinMarked = true;
                });
            }
        };
    } // end initWebSocket

    if (window["WebSocket"]) {
        initWebSocket();
    } else {
        var item = document.createElement("div");
        item.innerHTML = "Your browser does not support WebSockets.";
        document.querySelector('.msg_history')?.appendChild(item);
    }

    function statusCheck() {
        if ($('#status').val() == 'DISCONNECT') {
            //  document.getElementById('timer-end')?.classList.add('show');
            endSessionUI({ closeSocket: false, showModal: true, reason: 'statusCheck', from: 'statusCheck' }); //202250909 eun 위에서 아래처럼 수정

            return false;
        } else {
            return true;
        }
    }

    //상담사는 들어오자마자 카운트다운 시작되게 변경
    function isCounselorJoinEvent(js) {
        const eventCsrId = (js?.JoMsg?.CsrId ?? '').toString().trim();
        const roomCsrId = ($('#csrid').val() ?? '').toString().trim();
        const msg = js?.JoMsg?.Msg ?? '';

        // 1) 서버가 상담사 ID를 내려주면 (room의 csr와 일치하거나 room 값이 비어도) 입장으로 간주
        if (eventCsrId) {
            if (!roomCsrId || eventCsrId === roomCsrId) return true;
        }
        // 2) 백업: 시스템 알림 문구로 판단(서버 문구와 대략 매치)
        if (/\[.*?\]님이 입장했습니다.|상담이 시작되었습니다|상담이 시작/.test(msg)) return true;

        return false;
    }
    function resolveActorFromFlags(prev, cur, fallbackByEvt) {
        // prev→cur 변화로 행위자 판별
        if (prev && cur) {
            // 재입장(N으로 바뀜)
            if (prev.m_try_out === 'Y' && cur.m_try_out === 'N') return { role: 'memb', reason: 'rejoin' };
            if (prev.c_try_out === 'Y' && cur.c_try_out === 'N') return { role: 'csr',  reason: 'rejoin' };
            // 이탈(Y로 바뀜)
            if (prev.m_try_out === 'N' && cur.m_try_out === 'Y') return { role: 'memb', reason: 'leave'  };
            if (prev.c_try_out === 'N' && cur.c_try_out === 'Y') return { role: 'csr',  reason: 'leave'  };
        }
        // 폴백: 이벤트 payload 추정값 사용
        return fallbackByEvt || { role: 'unknown', reason: 'fallback' };
    }

    function resolveActorFromEvt(js) {
        const j = js?.JoMsg || {};
        const hasCsr  = !!(j.CsrId && String(j.CsrId).trim() !== '');
        const hasMemb = !!(j.MembId && String(j.MembId).trim() !== '');
        const idtp    = (j.IdTp || '').toString().toLowerCase(); // 있으면 최우선

        if (idtp === 'csr')  return { role: 'csr',  reason: 'evt-idtp' };
        if (idtp === 'memb' || idtp === 'user') return { role: 'memb', reason: 'evt-idtp' };

        if (hasCsr && !hasMemb)  return { role: 'csr',  reason: 'evt-ids' };
        if (!hasCsr && hasMemb)  return { role: 'memb', reason: 'evt-ids' };

        // 둘 다 있거나 둘 다 없으면 휴리스틱
        if (isCounselorJoinEvent(js)) return { role: 'csr', reason: 'heuristic' };
        return { role: 'memb', reason: 'heuristic' };
    }

    function outputSysMsg(js, sysMsg, isHtml, myFlag, sendTime) {
        js.JoMsg = js.JoMsg || {};
        js.JoMsg.Msg = sysMsg;
        js.JoMsg.HtmlFlag = !!isHtml;
        if (isHtml) msgOutHtml(js, myFlag, sendTime);
        else        msgOut(js,  myFlag, sendTime);
    }

    let _sending = false; // 중복 전송 방지 잠금
    async function SendMsg2ServerSubmit() {
        if (_sending) return; // 이미 전송 중이면 무시
        if (!statusCheck()) return;

        const input = $('#textinput');
        const tpMsg = input.val();
        if (tpMsg == '') return;

        _sending = true;  // 잠금 설정
        input.val('');    // 입력값 즉시 비움 (await 중 재클릭 방지)

        try {
            // 전송 직전 서버 상태 즉시 확인(폴링 사이 레이스 방지)
            try {
                const res = await $.ajax({
                    url: './ajax.counsel_chat.php',
                    method: 'POST',
                    dataType: 'json',
                    data: { act: 'getStatus', token: token }
                });
                if (!res || !res.success || res.status === 'DISCONNECT') {
                    endSessionUI({ closeSocket: true, showModal: true, reason: 'preflight', from: 'send' });
                    return;
                }
            } catch (e) {
                // 네트워크 일시 오류 - 입력값 복원 후 재시도 유도 (세션 종료하지 않음)
                console.warn('[SEND] preflight network error, restoring input:', e);
                input.val(tpMsg);
                return;
            }

            // 실제 전송
            const svrData = { CmdTp: "conv_msg", Msg: tpMsg, HtmlFlag: false };
            try {
                conn.send(JSON.stringify(svrData));
            } catch (e) {
                endSessionUI({ closeSocket: true, showModal: true, reason: 'send-failed', from: 'send' });
                return;
            }
            isTyping = false;

            if (tpMsg != '[typing]') {
                $.ajax({
                    url: './ajax.counsel_chat.php',
                    method: 'POST',
                    data: { msg: tpMsg, act: 'storeChat', mbid: $('#mbid').val(), token: '<?=$room_token?>' }
                });
                setTimeout(setReadno, 50);
            }
        } finally {
            _sending = false; // 잠금 해제
        }
    }


</script>

<script>
    document.addEventListener('DOMContentLoaded', function () {
        // 모든 모달의 취소 버튼에 이벤트 바인딩
        document.querySelectorAll('.modal.chat .cancle-btn').forEach(function(btn) {
            btn.addEventListener('click', function () {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        if (!modal.classList.contains('show')) {
                            modal.style.display = 'none';
                        }
                    }, 300);
                }
            });
        });

        const raw = $('#deadline').val();
        secondsLater = Number(raw); // ex: 30

        // 화면에만 30초 표시
        showStaticTime();
    });

    let deadline = null;
    let secondsLater = 0; // 입력값 저장
    let timer = null;
    let modalShown = false;
    let endModalPending = false;
    let isTyping = false;
    let isOpTyping = false;

    // 시간 포맷 함수
    function formatTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);

        return {
            colon: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            text: `남은 시간: ${h}시간 ${m}분 ${s}초`
        };
    }

    // 1시작 전 → 화면에 값만 표시
    function showStaticTime() {
        const {colon, text} = formatTime(secondsLater);
        document.getElementById('countdown').textContent = colon;
    }

    // 2 실제 카운트다운 로직
    function updateCountdown() {
        if (!deadline) return;

        const now = new Date();
        const remaining = Math.floor((deadline - now) / 1000);

        if (remaining <= 0) {
            document.getElementById('countdown').textContent = '00:00:00';
            clearInterval(timer);
            timer = null; // 초기화하여 startCountdown() 재호출 가능하게

            const plusTimeModal = document.getElementById('plus-time');
            const isPlusTimeOpen = plusTimeModal?.classList.contains('show');

            if (isPlusTimeOpen) {
                endModalPending = true;
            } else {
                document.getElementById('timer-end')?.classList.add('show');
                $('#status').val('DISCONNECT');
            }
            return;
        }

        const {colon, text} = formatTime(remaining);
        document.getElementById('countdown').textContent = colon;
        if (remaining <= 60 && !modalShown && $('#is_csr').val() == 'N') { //상담 시간 10초에서 1분으로 변경
            document.getElementById('plus-time')?.classList.add('show');
            modalShown = true;
        }
    }

    let paused = false;

    function startCountdown() {
        console.log(timer);
        if (!timer) {
            if (!deadline) {
                // 처음 시작할 때만 deadline 세팅
                deadline = new Date(Date.now() + secondsLater * 1000);
            } else if (paused) {
                // 일시정지 후 재개 시 deadline을 현재 시간 + 남은 시간으로 재설정
                const now = new Date();
                // 남은 초 계산
                const remainingSeconds = Math.floor((deadline - pauseTime) / 1000);
                deadline = new Date(now.getTime() + remainingSeconds * 1000);
                paused = false;
            }

            timer = setInterval(updateCountdown, 1000);
        }
    }

    let pauseTime = null;

    function stopCountdown() {
        if (timer) {
            clearInterval(timer);
            timer = null;
            paused = true;
            pauseTime = new Date(); // 일시정지 시점 저장
        }
    }

    // plus-time 모달 취소 버튼
    document.addEventListener('DOMContentLoaded', function () {
        const plusTimeCancelBtn = document.querySelector('#plus-time .cancle-btn');
        plusTimeCancelBtn.addEventListener('click', function () {
            const plusModal = document.getElementById('plus-time');
            plusModal.classList.remove('show');
            setTimeout(() => {
                plusModal.style.display = 'none';
                // 만약 종료 모달 대기 중이었다면 지금 띄움
                if (endModalPending) {
                    document.getElementById('timer-end').classList.add('show');
                    endModalPending = false;
                }
            }, 300);
        });

        // timer-end 모달 취소 버튼 (선택 사항)
        const timerEndCancelBtn = document.querySelector('#timer-end .cancle-btn');
        timerEndCancelBtn.addEventListener('click', function () {
            document.getElementById('timer-end').classList.remove('show');
        });
    });

    // 파일 선택 후 Ajax 업로드
    $('#imageInput').on('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!statusCheck()) return;

        const formData = new FormData();
        formData.append('upload_file', file);
        formData.append('act', 'uploadChatImg');

        $.ajax({
            url: './ajax.counsel_chat.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json',  // JSON 응답 받는다고 명시
            success: function (res) {
                if (!statusCheck()) return;  //20250909 추가
                if (res.status === 'ok' && res.filename) {
                    $('#textinput').val('[img]' + res.filename);
                    SendMsg2ServerSubmit();
                } else {
                    console.error('업로드 실패 또는 잘못된 응답:', res);
                }
            },
            error: function (xhr, status, error) {
                console.error('Ajax 오류:', error);
            }
        });
    });

    // 시작 20250730 eun 상담사도 카운트다운 뜨게 수정
    // updateCountdown();
    // timer = setInterval(updateCountdown, 1000);

    function typing_chat() {
        if (!statusCheck()) return;
        if (!isTyping) {
            const svrData = {
                CmdTp: "conv_msg",
                Msg: '[typing]',
                HtmlFlag: false,
            };
            const jsStr = JSON.stringify(svrData);
            try { conn.send(jsStr); } catch(e) { console.error('[WS] typing send failed:', e); return; }
            isTyping = true;
        }
    }

    function exit_chat() {
        // chat-exit 모달 닫기
        stopCountdown();
        dismiss_chat_exit_modal();

        $.ajax({
            url: './ajax.counsel_chat.php',
            type: 'POST',
            data: {token: token, act: 'closeRoom'},
            dataType: 'json',  // JSON 응답 받는다고 명시
            success: function (res) {
                window.__chatClosed__ = true; // 20250811 eun 이후 beforeunload 쪽에서 중복 호출 방지
                if (firstJoin) {
                    location.href = '/my/chat_record.php';
                } else {
                    sendRoomOut2Srv(-1, tid); //웹소켓에 퇴장 알림
                    document.getElementById('timer-end')?.classList.add('show');
                }

            },
            error: function (xhr, status, error) {
                console.error('Ajax 오류:', error);
            }
        });

    }

    function dismiss_chat_exit_modal() {
        const modal = document.getElementById('chat-exit');
        modal.classList.remove('show');
        modal.style.display = 'none';
    }

    function setReadno() {
        const is_op_join = document.getElementById('is_op_join').value;

        if (is_op_join === 'N') {
            // 가장 마지막 .chat-time.read → read-no 로 교체 + "1" 텍스트
            const readList = document.querySelectorAll('.chat-time.read');
            if (readList.length > 0) {
                const last = readList[readList.length - 1];
                last.classList.remove('read');
                last.classList.add('read-no');
                last.textContent = '1';
            }
        }
    }

    function updateReadStatus() {
        const is_op_join = document.getElementById('is_op_join').value;
        if (is_op_join === 'Y') {
            // 모든 .chat-time.read-no → read로 바꾸고 텍스트 비움
            document.querySelectorAll('.chat-time.read-no').forEach(el => {
                el.classList.remove('read-no');
                el.classList.add('read');
                el.textContent = '';
            });
        }
    }

    //20250811 eun 페이지 이탈 시 try_out='Y' 표시 시작
    // 페이지 이탈 시 try_out='Y' 표시
    /* window.addEventListener('beforeunload', function (e) {
         // 이미 DISCONNECT면 스킵(선택)
         if (document.getElementById('status')?.value === 'DISCONNECT') return;

         const data = new FormData();
         data.append('act', 'closeRoom');
         data.append('token', token); // 서버에서 1/2 제거 처리함

         // 페이지 닫힘에도 전송 안정적인 방식
         if (navigator.sendBeacon) {
             navigator.sendBeacon('./ajax.counsel_chat.php', data);
         } else {
             // 구형 브라우저 대비
             fetch('./ajax.counsel_chat.php', {method: 'POST', body: data, keepalive: true});
         }
     });*/
    // 페이지 이탈 시: try_out='Y'만 찍고 status는 변경하지 않음
    // '종료하기' 버튼(exit_chat)은 기존대로 closeRoom 호출(= status DISCONNECT)
    window.__chatClosed__ = window.__chatClosed__ || false;
    window.__leftByBeacon__ = false;

    function leaveRoomSilent() {
        try {
            // sendBeacon은 FormData를 바로 못 보내는 브라우저가 많아
            // x-www-form-urlencoded로 전송합니다.
            window.__leftByBeacon__ = true;   // ← 내가 나간 이벤트 힌트
            const body = new URLSearchParams();
            body.append('act', 'leaveRoom');  // ← closeRoom 아님
            body.append('token', token);

            if (navigator.sendBeacon) {
                const blob = new Blob([body.toString()], {type: 'application/x-www-form-urlencoded'});
                navigator.sendBeacon('./ajax.counsel_chat.php', blob);
            } else {
                fetch('./ajax.counsel_chat.php', {method: 'POST', body, keepalive: true});
            }
        } catch (e) {
            // 실패해도 unload를 막지 않음
        }
    }

    window.addEventListener('beforeunload', function () {
        // 이미 '종료하기' 로직으로 closeRoom을 호출한 뒤라면 중복 방지
        if (window.__chatClosed__) return;
        // 서버 status는 바꾸지 않고 try_out만 Y로 남김
        leaveRoomSilent();
    });
    //20250819 eun 페이지 이탈 시 try_out='Y' 표시 마감

    //  let statusPollTimer = null;

    function startStatusPolling() {
        if (statusPollTimer) return; // 중복 방지
        statusPollTimer = setInterval(() => {
            $.ajax({
                url: './ajax.counsel_chat.php',
                method: 'POST',
                dataType: 'json',
                data: {act: 'getStatus', token: token},
                success: function (res) {
                    console.log('[POLL] getStatus response:', res);

                    if (!res || !res.success) {
                        console.warn('[POLL] success=false or empty response');
                        return;
                    }

                    const serverStatus = res.status; // ← 반드시 정의 (기존엔 주석이라 에러)
                    const serverRemain = Number(res.remain || 0);

                    // 1) 아직 카운트다운 시작 전(상대가 안 들어온 상태)에도 화면 숫자는 늘어나야 함
                    if (!timer && !deadline && firstJoin) {
                        secondsLater = serverRemain;
                        showStaticTime();
                        console.log('[POLL] static time updated before start:', serverRemain);
                    }

                    // 2) 카운트다운이 돌고 있다면 서버 값이 더 크면 deadline을 밀어줌(충전 반영)
                    let clientRemain = 0;
                    if (deadline) clientRemain = Math.max(0, Math.floor((deadline - new Date()) / 1000));
                    const diff = serverRemain - clientRemain;
                    console.log('[POLL] clientRemain:', clientRemain, 'serverRemain:', serverRemain, 'diff:', diff);

                    if (deadline && diff > 1) {
                        deadline = new Date(deadline.getTime() + diff * 1000);
                        console.log('[POLL] deadline extended by', diff, 'seconds. new deadline:', deadline);
                    } else if (!deadline && !firstJoin) {
                        // 한번이라도 시작한 적 있는데 deadline이 없다면 복구
                        deadline = new Date(Date.now() + serverRemain * 1000);
                        console.log('[POLL] deadline created from serverRemain:', serverRemain);
                    }

                    // 3) 상태값 동기화
                    const current = $('#status').val();
                    if (current !== serverStatus) {
                        $('#status').val(serverStatus);
                        console.log('[POLL] status changed:', current, '→', serverStatus);
                    }

                    // 4) 서버가 종료 상태면 즉시 종료 UI
                    /*if (serverStatus === 'DISCONNECT') {
                        stopCountdown?.();
                        stopInterval?.();
                        if (!document.getElementById('timer-end')?.classList.contains('show')) {
                            document.getElementById('timer-end')?.classList.add('show');
                        }
                        clearInterval(statusPollTimer);
                        statusPollTimer = null;
                        console.log('[POLL] room disconnected. polling stopped.');
                    }*/
                    //20250909 위에서 아래로 교체
                    if (serverStatus === 'DISCONNECT') {
                        endSessionUI({ closeSocket: true, showModal: true, reason: 'poll', from: 'polling' });
                        return; // 중복 처리 방지
                    }

                    window.__roomFlagsPrev = { m_try_out: res.m_try_out, c_try_out: res.c_try_out };

                },
                error: function (xhr, status, error) {
                    console.error('[POLL] getStatus error:', status, error);
                }

            });
        }, 5000); // 5초 간격(원하면 3~10초로 조절)
    }

    // 페이지 로드 후 시작
    document.addEventListener('DOMContentLoaded', function () {
        startStatusPolling();
    });

    function getRoomFlags(cb) {
        $.ajax({
            url: './ajax.counsel_chat.php',
            method: 'POST',
            dataType: 'json',
            data: {act: 'getStatus', token: token},
            success: function (res) {
                cb(res || null);
            },
            error: function () {
                cb(null);
            }
        });
    }

</script>

<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH . '/tail.sub.php');
?>
