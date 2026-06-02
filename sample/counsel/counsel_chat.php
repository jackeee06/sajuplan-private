<?php
include_once("./_common.php"); // 메뉴별 공통파일
@include_once(G5_LIB_PATH . '/thumbnail.lib.php');
include_once(G5_THEME_MOBILE_PATH.'/head_chat.php'); //헤드 채팅용
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
        width: 13px; height: 13px;
        margin-right: 1.5px;
    }

    .modal.chat .modal-box {
        top: auto;
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
        box-shadow: 0 8px 32px 0 rgba(60,70,110,0.18), 0 1.5px 6px 0 rgba(20,25,40,0.07);
    }
</style>
<!--20250730 eun 상담 종료 후 상담사 추천 및 후기 작성 마감-->
<div class="counsel_chat scroll_bar_none">
    <div class="day_section">
        <div class="mb_20">
            <p class="day">2024년 12월 10일 수요일</p>
        </div>
        <div class="mb_20">
            <div class="flex align-items-start bubble_left gap_10">
                <div class="flex align-items-center gap_10">
                    <a href="./membership_profile.php">
                        <div class="feed-profile">
                            <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt="">
                        </div>
                    </a>
                </div>
                <!-- 말풍선 오른쪽 / 왼쪽 클래스명 확인해주세요
                .speech_bubble.speech_bubble_left : 말풍선 왼쪽일 때
                .speech_bubble.speech_bubble_right : 말풍선 오른쪽일 때
                    -->
                <div class="chat-speech">
                    <div class="chat-name">
                        <p>신비님</p>
                    </div>
                    <div class="mb_10">
                        <div class="speech_bubble speech_bubble_left">안녕하세요~</div>
                    </div>
                    <div class="mb_10">
                        <div class="speech_bubble speech_bubble_left">어떤 고민이 있을꼬?</div>
                    </div>
                    <div class="flex align-items-center bottom_time">
                        <span class="chat-time">오후 02:00</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="mb_20">
            <div class="flex align-items-start bubble_right gap_10">
                <div class="chat-speech">
                    <div class="mb_10">
                        <div class="speech_bubble speech_bubble_right" data-toggle="modal" data-target="#request_flor_btn">안녕하세요! 제가 요즘 썸타는 사람이 있는데</div>
                    </div>
                    <div class="mb_10">
                        <div class="speech_bubble speech_bubble_right" data-toggle="modal" data-target="#request_flor_btn">이사람과의 궁합이 어떤지 궁금해요</div>
                    </div>
                    <div class="flex align-items-center bottom_time gap_05">
                        <!-- <span class="chat-time read">읽음</span> --> <!-- 상대방이 읽었을 때 -->
                        <span class="chat-time read-no">1</span>
                        <span class="g-ling"></span>
                        <span class="chat-time">오후 02:00</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="flex align-items-start bubble_left gap_10">
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
        </div>
    </div>
    <div class="flex align-items-start bubble_left gap_10">
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
                <div class="speech_bubble entering speech_bubble_left"><!-- 입력중일때 나오는 gif -->
                    <img src="../../../img/common/typing_animation.gif" alt="" >
                </div>
            </div>
        </div>
    </div>
</div>
</div>
</div>
<div class="bottom_btn">
    <div class="flex align-items-center gap_10">
        <div class="upload-btn">
            <button type="button">
                <img src="../../../img/common/more.svg" alt="사진 업로드">
            </button>
        </div>
        <div class="chat-box">
            <form class="flex align-items-center gap_10">
                <input type="text" class="form-control flex-fill border-0" placeholder="입력하세요" data-has-listeners="true">
                <button class="btn send-btn mt-0">전송</button>
            </form>
        </div>
    </div>
</div>


<!-- 상담시간이 10초 남았을 때 나오는 모달 -->
<div class="modal chat"  id="plus-time"><!-- 나타날때 - show 클래스 추가 -->
    <div class="modal-box">
        <div class="modal-head">
            <p>상담시간이 10초 남았습니다!</p>
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
<div class="modal chat"  id="chat-exit"><!-- 나타날때 - show 클래스 추가 -->
    <div class="modal-box">
        <div class="modal-head">
            <p>상담 종료</p>
        </div>
        <div class="modal-body">
            <p>채팅 상담을 종료하시겠습니까?</p>
        </div>
        <div class="modal-footer">
            <button class="cancle-btn">취소</button>
            <!--			<button class="color-btn" onclick="location.href='../my/chat_record.php' ">종료하기</button>-->
            <button class="color-btn" onclick="exit_chat()">종료하기</button>

        </div>
    </div>
</div>
<!--20250730 eun 상당 종료 여부 확인 모달 작업 마감-->

<!--20250730 eun 상담사 2명 추천 추가 및 분기 작업 시작-->
<!-- 상담시간이 종료되었을때 나오는 모달 -->
<div class="modal chat" id="timer-end">
    <div class="modal-box">
        <div class="modal-head">
            <p>상담이 종료되었습니다.</p>
        </div>
        <?php if ($member['mb_level'] != 5 && $row['usetm'] > 0){ ?>
            <div class="modal-body" style="margin-bottom: 0px; !important;">
                <p>상담은 어떠셨나요?<br>솔직한 후기를 남겨주세요.</p>
                <p><?php echo $row['usetm'] ?></p>
            </div>
        <?php }else{ ?>
            <div class="modal-body" style="margin-bottom: 0px; !important;">
                <p>상담은 어떠셨나요?<br>상담 메모를 작성해주세요.</p>
            </div>
        <?php } ?>

        <div class="recommend-slide">
            <p style="margin-bottom: 2.5px; text-align: center"><strong >다음번엔 사주플랜 추천 상담사와 상담 어떠신가요?</strong></p>
            <ul>
                <?php
                // 상담한 상담사 ID 목록을 반환하는 함수
                function get_consulted_counselors($user_mb_id) {
                    if (!$user_mb_id) {
                        return []; // 로그인 정보 없으면 빈 배열 리턴
                    }
                    // SQL 인젝션 방지
                    $user_mb_id = sql_real_escape_string($user_mb_id);
                    // 중복 제거를 위해 DISTINCT 사용
                    $sql = "SELECT DISTINCT csrid FROM platform_consulting
                        WHERE membid = '{$user_mb_id}'
                           AND reason = 'DISCONNECT'
                        ";                $result = sql_query($sql);
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
                // ────────────────────────────────────────────────────────────
                // 3. 추천 상담사 쿼리
                //    • mb_sort 1~20위      (사주플랜 추천 순위)
                //    • state = 'IDLE'      (상담 가능)
                //    • 상담한 사람 제외
                //    • 랜덤 2명 추출
                // mb_4 -> mb_13 , mb_5 -> mb_12
                // ────────────────────────────────────────────────────────────
                // $sql = "SELECT mb_id, mb_nick, mb_13, mb_12, mb_sort, state
                $sql = "SELECT mb_id, mb_nick, mb_4, mb_5, mb_sort, state
                        FROM {$g5['member_table']}
                         WHERE mb_sort BETWEEN 1 AND 20
                             AND (state = 'IDLE' or state ='RDVC')
                                 " . (
                    !empty($consulted_mb_ids)
                        ? "AND mb_id NOT IN ('" . implode("','", $consulted_mb_ids) . "')"
                        : ""
                    ) . "
                     ORDER BY RAND()
                     LIMIT 2
                    ";
                $result = sql_query($sql);
                // ────────────────────────────────────────────────────────────
                // 4. 화면에 출력
                // ────────────────────────────────────────────────────────────
                while ($row = sql_fetch_array($result)) {
                    // (1) 상담사 대표글 정보
                    $wr  = sql_fetch("
                                        SELECT wr_id, ca_name
                                          FROM g5_write_counselor
                                         WHERE mb_id = '{$row['mb_id']}'
                                         ORDER BY wr_num ASC
                                         LIMIT 1
                                        ");
                    $wr_id   = $wr['wr_id'];
                    $ca_name = $wr['ca_name'];
                    $cate_bg = ['타로'=>'tarot','신점'=>'sinjeom','사주'=>'saju','심리'=>'simli'];
                    // (2) 썸네일
                    if ($wr_id) {
                        $thumb     = get_list_thumbnail('counselor', $wr_id, 116,120, false, true);
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
                            <div class="proflie"><img width="50" height="50" src="<?= $thumb_src ?>" alt="프로필"></div>
                            <div class="counselor_s_info">
                                <div class="top"><span
                                            class="icon_cate <?= $cate_bg[$ca_name] ?? '' ?>"><?= $ca_name ?></span>
                                    <p><?= $row['mb_nick'] ?></p></div>
                                <div class="bottom"><p>
                                        <span><?= number_format($row['mb_4']) ?>원</span> <?= $row['mb_5'] ?>초당</p><span
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
        <?php if ($member['mb_level'] != 5){ ?>

            <div class="modal-footer">
                <button class="cancle-btn"  onclick="location.href='../my/chat_record.php' ">취소</button>
                <button class="color-btn" onclick="location.href='../bbs/write.php?bo_table=review&csr_id=<?=$view["mb_id"]?>' ">후기작성</button>
            </div>
        <?php }else { ?>
            <div class="modal-footer">
                <button class="cancle-btn"  onclick="location.href='../my/chat_record.php' ">취소</button>
                <button class="color-btn" onclick="location.href='../my/counselor_history.php?>'">상담메모작성</button>
            </div>
        <?php } ?>
    </div>
</div>
<!-- 20250730 eun 상담사 2명 추천 추가 및 분기 작업 마감-->
<script>
    document.addEventListener('DOMContentLoaded', function () {
        // 취소 버튼 클릭 시 모달 닫기
        const cancelBtn = document.querySelector('.cancle-btn');
        const modal = document.querySelector('.modal');

        cancelBtn.addEventListener('click', function () {
            modal.classList.remove('show');

            // 부드럽게 닫히고 나서 display:none 처리 (선택)
            setTimeout(() => {
                if (!modal.classList.contains('show')) {
                    modal.style.display = 'none';
                }
            }, 300); // CSS transition 시간과 맞춰줌
        });
    });

    //타이머 관련
    const deadline = new Date(Date.now() + 30 * 1000);
    let modalShown = false; // plus-time 모달이 이미 떴는지
    let endModalPending = false; // 종료모달을 나중에 띄워야 하는지

    function updateCountdown() {
        const now = new Date();
        const diff = deadline - now;

        if (diff <= 0) {
            document.getElementById('countdown').textContent = '00:00:00';
            clearInterval(timer);

            const plusTimeModal = document.getElementById('plus-time');
            const isPlusTimeOpen = plusTimeModal.classList.contains('show');

            if (isPlusTimeOpen) {
                // 지금은 plus-time이 열려 있으므로 end 모달은 나중에 띄우도록 표시만
                endModalPending = true;
            } else {
                // 바로 종료 모달 띄움
                document.getElementById('timer-end').classList.add('show');
            }
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const mStr = String(minutes).padStart(2, '0');
        const sStr = String(seconds).padStart(2, '0');
        document.getElementById('countdown').textContent = `00:${mStr}:${sStr}`;

        if (totalSeconds <= 10 && !modalShown) {
            document.getElementById('plus-time').classList.add('show');
            modalShown = true;
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

    // 시작
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
</script>

<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
