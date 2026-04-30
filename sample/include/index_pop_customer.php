<!--20250721 eun 상담사 2명 추천 파일 include 시작-->
<?php
@include_once(G5_LIB_PATH . '/thumbnail.lib.php');
@include_once(G5_LIB_PATH . '/common.lib.php');?>
<!--20250721 eun 상담사 2명 추천 파일 include 마감-->
<style>    /* mystyle.css */ /* The Modal (background) */
    .modal-content h3 p {
        font-size: 16px;
        margin-bottom: 5px;
    }

    .modal-content .modal-con {
        padding-top: 10px;
    }

    .modal01 {
        display: none; /* Hidden by default */
        position: fixed; /* Stay in place */
        z-index: 99999; /* Sit on top */
        left: 0;
        top: 0;
        width: 100%; /* Full width */
        height: 100%; /* Full height */
        overflow: auto; /* Enable scroll if needed */
        background-color: rgb(0, 0, 0); /* Fallback color */
        background-color: rgba(0, 0, 0, 0.4); /* Black w/ opacity */
        font-size: 14px;
    }
    /* Modal Content/Box */
    .modal-content {
        background-color: #fff;
        border: 1px solid #888; /* Could be more or less, depending on screen size */
        position: absolute;
        min-height: 100px;
        width: 100%;
        max-width: 650px;
        border-radius: 10px 10px 0 0;
        top: auto;
        bottom: 0;
        left: 50%;
        transform: translate(-50%, 0);
    }

    /* 휴대폰계산기 모달 스타일 */
    .modal-content.modal-consult {
        text-align: left;
    }

    /* 휴대폰계산기 모달 스타일 */
    .modal-content.modal-consult h3 {
        width: 100%;
        float: left;
        font-size: 20px;
        font-weight: 600;
    }

    .modal-content.modal-consult .modal-con {
        width: 100%;
        float: left;
    }

    /* The Close Button */
    .modal_close {
        color: #000;
        font-size: 24px;
        font-weight: bold;
        position: absolute;
        top: 00px;
        right: 00px;
        width: 44px;
        height: 44px;
        padding: 20px 20px 0px 0; /* 닫기버튼 위치를 top:16 / right:16으로 조정 */
        line-height: 24px;
        text-align: center;
        color: #999;
    }

    .modal_close:hover, .modal_close:focus {
        color: black;
        text-decoration: none;
        cursor: pointer;
    }
    .recommend-slide{
        padding: 0px;
    }
    .recommend-slide ul {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }    </style>    <!-- 모달 버튼//닫기 버튼와 연동// 삭제금지! -->
<div class="modal_btn"></div><!-- Modal -->
<!--20250723 eun 모달창 뜨게 하려고 클래스 바꾸는 작업 시작-->
<div class="modal01">    <!-- Modal의 내용 -->
    <!--20250723 eun 모달창 뜨게 하려고 클래스 바꾸는 작업 마감-->
    <div class="modal-content modal-consult">
        <h3><p>잠시만요, <?php echo $member['mb_id'] ? $member['mb_nick'] : '비회원'; ?>님.</p> 아직 후기를 작성하지 않은 상담이 있어요! <span
                    class="modal_close"><i class="xi-close-thin"></i></span></h3>
        <div class="modal-con"><p class="point" style=" font-size:16px; margin:10px 0 0px; font-weight:600;"> 솔직한 후기는
                양질의 상담에 큰 도움이 됩니다.</p>
            <div style=" font-size:14px; line-height:1.6; margin:10px 0 10px;"> 사주문는 비판적 후기도 절대로 삭제하지 않습니다. <br/> 겸허히
                수용하며, 발전의 계기로 삼습니다.
            </div>
            <!--20250715 eun 타 상담사 2명 추천 작업 시작-->
            <div class="recommend-slide">
                <p style="margin-bottom: 2.5px;"><strong >다음번엔 사주문 추천 상담사와 상담 어떠신가요?</strong></p>
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
                    //    • state = 'IDLE'      (상담 가능)
                    //    • 상담한 사람 제외
                    //    • 랜덤 2명 추출
                    // ────────────────────────────────────────────────────────────
                    $sql = "SELECT mb_id, mb_nick, mb_4, mb_5, mb_sort, state
                        FROM {$g5['member_table']}
                         WHERE mb_sort BETWEEN 1 AND 20
                             AND state = 'IDLE'
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
            <!--20250715 eun 타 상담사 2명 추천 작업 마감-->
            <a href="<?php echo G5_URL; ?>/my/history.php">
                <button type="button" class="white point_bg"
                        style=" position:relative; width:calc(100% - 0px);
                        height:60px; border-radius:4px; text-align:center;
                        margin-right:5px; padding:0; font-size:18px !important;">
                    상담내역 바로가기
                </button>
            </a></div>
    </div>
</div>
<?php $cnt = get_donot_my_review_cnt();
?>


<script>

    var cnt = "<?=$cnt?>";

    // Modal을 가져옵니다.
    //20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 시작
    var modals = document.getElementsByClassName("modal01");
    //20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 마감

    // Modal을 띄우는 클래스 이름을 가져옵니다.

    var btns = document.getElementsByClassName("modal_btn");

    // Modal을 닫는 close 클래스를 가져옵니다.

    var spanes = document.getElementsByClassName("modal_close");

    var funcs = [];



    // Modal을 띄우고 닫는 클릭 이벤트를 정의한 함수

    function Modal(num) {



        return function() {

            // 해당 클래스의 내용을 클릭하면 Modal을 띄웁니다.

            //btns[num].onclick =  function() {

            modals[num].style.display = "block";

            console.log(num);

            //};



            // <span> 태그(X 버튼)를 클릭하면 Modal이 닫습니다.

            spanes[num].onclick = function() {

                modals[num].style.display = "none";

            };

        };

    }



    // 원하는 Modal 수만큼 Modal 함수를 호출해서 funcs 함수에 정의합니다.

    for(var i = 0; i < btns.length; i++) {

        funcs[i] = Modal(i);

    }





    if(cnt > 0){

        // 원하는 Modal 수만큼 funcs 함수를 호출합니다.

        for(var j = 0; j < btns.length; j++) {

            funcs[j]();

        }

    }
    // Modal 영역 밖을 클릭하면 Modal을 닫습니다.
    //20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 시작
    window.onclick = function(event) {

        if (event.target.className == "modal01") {
//20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 마감

            event.target.style.display = "none";
        }
    };
</script>