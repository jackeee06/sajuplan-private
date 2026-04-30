<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head_chat.php'); //헤드 채팅용


if($_SESSION['ss_mb_id'] == "" ){ 
  alert("로그인이 필요합니다.", '/bbs/login.php?url=/counsel/chat_history.php?token='.$_GET['token']);
  exit;
}

if(!$room_row) { 
  alert('채팅 내역 불러오기에 실패했습니다.','/index.php');
  // var_dump($room_row);
  exit;
}

if($room_row['csr_id'] == "") {
  alert("잘못된 접근입니다", '/index.php');
  exit;
}

if($mb_row['mb_level'] != 10 && ($mb_row['mb_1'] != $room_row['mb_id'] && $mb_row['mb_1'] != $room_row['csr_id']) ) {
  alert("자신의 채팅 내역만 확인 가능합니다.", '/index.php');
  exit;
}

$chat_sql = "SELECT ct.* FROM chat_t ct LEFT JOIN chat_room crt ON ct.token = crt.room_token WHERE token = '{$room_token}' AND crt.status = 'DISCONNECT' ORDER BY wdate ASC";

// echo $chat_sql;
$chat_list = sql_query($chat_sql);

if(!$chat_list) {
  alert("채팅 내역이 없습니다.", '/index.php');
  exit;
}

// mb_row , csr_row head_chat에 있음

$dt = new DateTime($room_row['chat_wdate']); // 예: "2024-12-10 13:00:00"


// 요일 배열
$weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 날짜 + 요일 조합
$formatted = $dt->format('Y년 n월 j일') . ' ' . $weekdays[(int)$dt->format('w')];
?>
<input type="hidden" value="<?=$sec?>" id="deadline">
<input type="hidden" value="<?=$is_csr?>" id="is_csr">
<input type="hidden" value="<?=$mb_row['mb_id']?>" id="mbid">
<input type="hidden" value="<?=$room_row['csr_id']?>" id="csrid">
<input type="hidden" value="<?=$csr_row['mb_name']?>" id="csrname">
<input type="hidden" value="<?=$room_row['status']?>" id="status">

<style>
@import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&display=swap');

/* ===================================
   채팅 히스토리 – 전체 리디자인
=================================== */
.counsel_chat.msg_history {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif !important;
    background: #f5f3fa !important;
    padding: 70px 0 30px !important;
    min-height: 100vh !important;
}

/* ── 날짜 구분선 ── */
.day_section {
    padding: 0 16px !important;
}
.day_section > .mb_20:first-child {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px 0 12px !important;
    margin: 0 !important;
}
.day_section .day {
    display: inline-block !important;
    background: rgba(130, 89, 245, 0.08) !important;
    color: #8259f5 !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    padding: 6px 16px !important;
    border-radius: 20px !important;
    letter-spacing: -0.2px !important;
}

/* ── 메시지 행 공통 ── */
.chat_temp {
    margin-bottom: 4px !important;
    padding: 0 !important;
}
.chat_temp .flex {
    display: flex !important;
}
.chat_temp .align-items-start {
    align-items: flex-end !important;
}
.chat_temp .gap_10 {
    gap: 8px !important;
}

/* ── 프로필 이미지 ── */
.feed-profile {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    border-radius: 50% !important;
    overflow: hidden !important;
    background: #e8e2f6 !important;
    flex-shrink: 0 !important;
    margin-bottom: 18px !important;
}
.feed-profile img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: 50% !important;
}

/* ── 이름 표시 ── */
.chat-name {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #555 !important;
    margin-bottom: 4px !important;
    padding: 0 4px !important;
}
.chat-name p {
    font-size: 12px !important;
    font-weight: 600 !important;
}

/* ── chat-speech 영역 ── */
.chat-speech {
    max-width: 78% !important;
    width: auto !important;
}

/* ── 말풍선 공통 ── */
.speech_bubble {
    padding: 10px 14px !important;
    font-size: 14px !important;
    line-height: 1.55 !important;
    word-break: break-word !important;
    max-width: 100% !important;
    display: inline-block !important;
    letter-spacing: -0.2px !important;
}

/* ── 왼쪽 말풍선 (상대방) ── */
.bubble_left {
    justify-content: flex-start !important;
}
.speech_bubble.speech_bubble_left {
    background: #ffffff !important;
    color: #1a1a1a !important;
    border-radius: 4px 18px 18px 18px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05) !important;
    border: none !important;
}

/* ── 오른쪽 말풍선 (나) ── */
.bubble_right {
    justify-content: flex-end !important;
}
.bubble_right .chat-speech,
.chat-speech.outgoing_msg_img {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
}
.speech_bubble.speech_bubble_right {
    background: #8259f5 !important;
    color: #fff !important;
    border-radius: 18px 4px 18px 18px !important;
    box-shadow: 0 2px 8px rgba(130, 89, 245, 0.25) !important;
    border: none !important;
    text-align: start !important;
}

/* ── 시간 표시 ── */
.bottom_time {
    margin-top: 3px !important;
    padding: 0 4px !important;
}
.chat-time.time_date {
    font-size: 11px !important;
    color: #aaa !important;
    font-weight: 400 !important;
    letter-spacing: -0.3px !important;
}
.bubble_right .bottom_time {
    justify-content: flex-end !important;
}
.chat-time.read {
    display: none !important;
}
.chat-time.read-no {
    font-size: 11px !important;
    color: #8259f5 !important;
    font-weight: 700 !important;
}

/* ── 채팅 이미지 ── */
.chat-speech .img-box {
    border-radius: 14px !important;
    overflow: hidden !important;
}
.chat-speech .img-box img {
    max-width: 220px !important;
    border-radius: 14px !important;
    display: block !important;
}
.speech_bubble .img-box {
    padding: 0 !important;
    margin: -6px -8px !important;
}
.speech_bubble .img-box img {
    border-radius: 14px !important;
    max-width: 220px !important;
}

/* ── mb_10 / mb_20 마진 리셋 ── */
.chat_temp .mb_10 {
    margin-bottom: 0 !important;
}
.chat_temp.mb_20 {
    margin-bottom: 4px !important;
}

/* ── 스크롤바 숨김 유지 ── */
.scroll_bar_none::-webkit-scrollbar {
    display: none !important;
}

/* ── 같은 발신자 연속 메시지일 때 간격 최소화 ── */
.chat_temp + .chat_temp {
    margin-top: 0 !important;
}

/* ── g-ling 구분선 ── */
.g-ling {
    display: none !important;
}


.navbar {
 padding : 0px !important;
}


/* ── 반응형 ── */
@media screen and (max-width: 360px) {
    .counsel_chat.msg_history {
        padding: 60px 0 24px !important;
    }
    .day_section {
        padding: 0 12px !important;
    }
    .speech_bubble {
        font-size: 13px !important;
        padding: 9px 12px !important;
    }
    .feed-profile {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
    }
    .chat-speech {
        max-width: 82% !important;
    }
}
</style>

<div class="counsel_chat scroll_bar_none msg_history">
	<div class="day_section">
		<div class="mb_20">
			<p class="day"><?echo $formatted;?></p>
		</div>
    <?
    
    ?>
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
      
      if($chat_mb_id == $room_row['csr_id']) { 
      ?>
      <div class="mb_20 chat_temp">
        <div class="flex align-items-start bubble_left gap_10">
          <div class="flex align-items-center gap_10 ">
            <?if($is_csr == 'N') { ?>
<!--            <a href="./membership_profile.php">-->
              <div class="feed-profile">
                <!-- <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt=""> -->
                 <?if ($op_id) { 
                  $img_src = get_con_img($op_id, '70', '70');
                  ?>
                  <img src="<?=$img_src?>">
                 <? } ?>
              </div>
<!--            </a>-->
            <?}?>
          </div>
          <!-- 말풍선 오른쪽 / 왼쪽 클래스명 확인해주세요
          .speech_bubble.speech_bubble_left : 말풍선 왼쪽일 때
          .speech_bubble.speech_bubble_right : 말풍선 오른쪽일 때
            -->
          <div class="chat-speech">
            <div class="chat-name incoming_msg_img"><?=$id_row['mb_nick']?></div>
            <div class="mb_10">
                  <div class="speech_bubble speech_bubble_left msg" style="word-break: break-all !important;"><?php
    if ($is_html) {
        echo $msg; // 이미지 HTML 그대로 출력
    } else {
        echo nl2br($msg); // 일반 텍스트 출력 (줄바꿈 포함)
    }
    ?></div>
            </div>
            <div class="flex align-items-center bottom_time">
              <span class="chat-time time_date"><?echo $row['wdate']?></span>
            </div>
          </div>
        </div>
      </div>
    <? } else { ?>
		<div class="mb_20 chat_temp">
			<div class="flex align-items-start bubble_right gap_10">
				<div class="chat-speech outgoing_msg_img">
          <div class="chat-name incoming_msg_img"><?=$id_row['mb_nick']?></div>
					<div class="mb_10">
						<div class="speech_bubble speech_bubble_right msg"   style="word-break: break-all !important;  text-align: start;"
                             data-toggle="modal" data-target="#request_flor_btn">    <?php
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
						<span class="chat-time time_date"><?echo $row['wdate']?></span>
					</div>
				</div>
			</div>
		</div>

    <? } ?>
  <? } ?>
  </div>
		</div>
	</div>
</div>
<?   if($_SERVER['REMOTE_ADDR'] == "115.93.39.5"){//echo $chat_sql;
    } ?>
<script>

$('#countdown').css('display','none');

</script>

<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
