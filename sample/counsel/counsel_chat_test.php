<?php
include_once("./_common.php"); // 메뉴별 공통파일

include_once(G5_THEME_MOBILE_PATH.'/head_chat.php'); //헤드 채팅용

if($_SESSION['ss_mb_id'] == "" ){ 
  alert("로그인이 필요합니다.", '/bbs/login.php?url=/counsel/counsel_chat_test.php?token='.$_GET['token']);
  exit;
}

if(!$room_row) { 
  alert('채팅방 생성에 실패했습니다.','/index.php');
  // var_dump($room_row);
  exit;
}

if($room_row['csr_id'] == "") {
  alert("잘못된 접근입니다", '/index.php');
  exit;
}

// mb_row , csr_row head_chat에 있음

$dt = new DateTime($room_row['room_wdate']); // 예: "2024-12-10 13:00:00"

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
<div class="counsel_chat scroll_bar_none msg_history">
	<div class="day_section">
		<div class="mb_20">
			<p class="day"><?echo $formatted;?></p>
		</div>
    <template data-template="in_msg_temp">
      <div class="mb_20 chat_temp">
        <div class="flex align-items-start bubble_left gap_10">
          <div class="flex align-items-center gap_10 ">
            <?if($is_csr == 'N') { ?>
            <a href="./membership_profile.php">
              <div class="feed-profile">
                <!-- <img src="https://thesaju.dmonster.kr/data/file/counselor/thumb-3556447429_x2jVhMYW_2ce8793da60e1718b45532f05bfa679f86a6d7a8_210x150.png" alt=""> -->
                 <?if ($op_id) { 
                  $img_src = get_con_img($op_id, '70', '70');
                  ?>
                  <img src="<?=$img_src?>">
                 <? ?>
                 <? } ?>
              </div>
            </a>
            <?}?>
          </div>
          <!-- 말풍선 오른쪽 / 왼쪽 클래스명 확인해주세요
          .speech_bubble.speech_bubble_left : 말풍선 왼쪽일 때
          .speech_bubble.speech_bubble_right : 말풍선 오른쪽일 때
            -->
          <div class="chat-speech">
            <div class="chat-name incoming_msg_img">
            </div>
            <div class="mb_10">
              <div class="speech_bubble speech_bubble_left msg"></div>
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
						<div class="speech_bubble speech_bubble_right msg" data-toggle="modal" data-target="#request_flor_btn"></div>
					</div>
					<div class="flex align-items-center bottom_time gap_05">
						<span class="chat-time read"></span> <!-- 상대방이 읽었을 때 -->
						<!-- <span class="chat-time read-no">1</span> -->
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
				<input oninput="typing_chat()" type="text" id="textinput" class="form-control flex-fill border-0" placeholder="입력하세요" data-has-listeners="true">
				<button class="btn send-btn mt-0" type="button" onclick="SendMsg2ServerSubmit()">전송</button>
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

<!-- 상담시간이 종료되었을때 나오는 모달 -->
<div class="modal chat" id="timer-end">
	<div class="modal-box">
		<div class="modal-head">
			<p>상담이 종료되었습니다.</p>
		</div>
		<div class="modal-body">
			<p>상담은 어떠셨나요?<br>솔직한 후기를 남겨주세요.</p>
		</div>
		<div class="modal-footer">
			<button class="cancle-btn">취소</button>
			<button class="color-btn" onclick="location.href='../bbs/write.php?bo_table=review&csr_id=<?=$csr_row["mb_id"]?>' ">후기쓰기</button>
		</div>
	</div>
</div>



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
    $(".btn.btn-light.btn-sm").click(function () {
      var files = document.getElementById("file-select");
      files.click();
    });

    $(".btn.btn-link.btn-sm").click(function () {
      sendRoomOut2Srv(-1, tid);
    });
    $(".write_msg").on("keydown", function (e) {
      if (e.which == 13) {
        if ($(this).val() == "") {
          return false;
        }
        if (e.shiftKey == true || e.altKey) {
          inp = $(this).val();
          $(this).val(inp + "\n");
        } else {
          $("#btn-submit").click();
        }
        return false;
      }
    });

    setInterval(() => {
      if (!firstJoin) {
        $.ajax({
          url: './ajax.counsel_chat.php',
          method: 'POST',
          data: { token: token, act: 'updateTime' },
          success: function(res) {
            console.log('use_time +10 업데이트 완료');
          }
        });
      }
    }, 10000); // 10초마다 실행

  });

  document.getElementById('uploadTrigger').addEventListener('click', function () {
    if(!statusCheck()) return;
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
        js.FromName = "관리자";
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
        js.FromName = "관리자";
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
      conn.send(jsStr);
    }

    if (window["WebSocket"]) {
      // conn = new WebSocket("ws://passcall.co.kr:20101/wscp/" + token);
      conn = new WebSocket("wss://passcall.co.kr:28729/wscp/" + token);
      conn.onclose = function (evt) {
        const value = "Connection closed.(refresh필요)";
        const data1 = {
          name: "admin",
          content: value,
        };
        // 맨뒤 true이면 자신 false이면 서버의 메시지를 의미
        insertMessageToDOM(data1, false);
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
          case "room_in_noti": // 방입장 통지
            // js.JoMsg.RoomId, MembId,CsrId,IdTp 공통: 아래 메시지들 동일(미연결시에는 공백)
            csrid = js.JoMsg.CsrId;
            if(csrid == $('#csrid').val() && $('#is_csr').val() == 'N' && firstJoin) {
              // updateCountdown();
              startCountdown();
              firstJoin = false;
            }
            if (js.JoMsg.Msg.includes('[]님이') && csrid == $('#csrid').val()) {
                js.JoMsg.Msg = js.JoMsg.Msg.replace('[]님이', '[' +$('#csrname').val()+']님이');
            }
            msgOut(js, false, sendTime);
            break;
          case "room_out_noti": // 방퇴장 통지
            csrid = js.JoMsg.CsrId;
            if (js.JoMsg.Msg.includes('[]님이') && csrid == $('#csrid').val()) {
                js.JoMsg.Msg = js.JoMsg.Msg.replace('[]님이', '[' +$('#csrname').val()+']님이');
            }
            msgOut(js, false, sendTime);
            break;
          case "system_notify":
            console.log( "ClosedRoomId[", js.JoMsg.RoomId , "] reason[", js.JoMsg.Reason , "] msg[", js.JoMsg.Msg, "]");
            msgOut(js, false, sendTime);
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
              js.JoMsg.Msg = '<div class="img-box"><img src="'+'<?=G5_DATA_URL?>/chat/' + imgPath + '" alt="이미지" style="max-width:100%;"></div>';
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
            } else if (js.FromName == "" && js.FromCid != js.ToCid) {
              js.FromName = $('#csrname').val();
            }

            if(js.JoMsg.Msg != '[typing]') {
              if (js.JoMsg.HtmlFlag == true) {
                msgOutHtml(js, myDispFlag, sendTime);
              } else {
                msgOut(js, myDispFlag, sendTime);
              }
              $(window).scrollTop($(window).scrollTop() + 100);
            }
            if(js.FromCid >= 0 && js.FromCid != js.ToCid && $('#is_csr').val() == 'N' && firstJoin) {
              // updateCountdown();
              startCountdown();
              firstJoin = false;
            }
            
            break;
          default: // 공지등 일반내용은 여기로 들어감
            msgOut(js, false, sendTime);
            break;
        }
      };
      conn.onopen = function (evt) {
        const regist = {
          CmdTp: "regist",
          Token: token,
        };
        const regist_str = JSON.stringify(regist);
        conn.send(regist_str);
        console.log("<-onopen msg[", regist_str, "]");
      };
    } else {
      var item = document.createElement("div");
      item.innerHTML = "Your browser does not support WebSockets.";
      appendLog(item);
    }

    function statusCheck() {
      if ($('#status').val() == 'DISCONNECT') {
        document.getElementById('timer-end')?.classList.add('show');
        return false;
      } else {
        return true;
      }
    }

    // send message to server
    function SendMsg2ServerSubmit() {
      if(!statusCheck()) return;
      const input = $('#textinput');
      const tpMsg = input.val();


      // console.log(isTyping);
      // console.log(tpMsg);
      const svrData = {
        CmdTp: "conv_msg",
        Msg: tpMsg,
        HtmlFlag: false,
      };
      const jsStr = JSON.stringify(svrData);
      conn.send(jsStr);
      isTyping = false;

      input.val('');
      
      if(tpMsg != '[typing]') {
        $.ajax({
          url: './ajax.counsel_chat.php',
          method: 'POST',
          data: { msg: tpMsg, act: 'storeChat',mbid:$('#mbid').val(),token:'<?=$room_token?>'},
          success: function(res) {
          }
        });
      }
    }
    $("#write_msg_text").on("focus", function (e) {
      $(".msg_history").css("height", "200px");
    });
    $("#write_msg_text").on("focusout", function (e) {
      $(".msg_history").css("height", "512px");
    });
  </script>

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
    const s = totalSeconds % 60;

    return {
      colon: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      text: `남은 시간: ${h}시간 ${m}분 ${s}초`
    };
  }

  // 1️⃣ 시작 전 → 화면에 값만 표시
  function showStaticTime() {
    const { colon, text } = formatTime(secondsLater);
    document.getElementById('countdown').textContent = colon;
  }

  // 2️⃣ 실제 카운트다운 로직
  function updateCountdown() {
    if (!deadline) return;

    const now = new Date();
    const remaining = Math.floor((deadline - now) / 1000);

    if (remaining <= 0) {
      document.getElementById('countdown').textContent = '00:00:00';
      clearInterval(timer);

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

    const { colon, text } = formatTime(remaining);
    document.getElementById('countdown').textContent = colon;

    if (remaining <= 10 && !modalShown) {
      document.getElementById('plus-time')?.classList.add('show');
      modalShown = true;
    }
  }

  // 3️⃣ 타이머 시작
  function startCountdown() {
    deadline = new Date(Date.now() + secondsLater * 1000);
    updateCountdown(); // 즉시 1회 실행
    timer = setInterval(updateCountdown, 1000);
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
      if(!statusCheck()) return;

      const formData = new FormData();
      formData.append('upload_file', file);
      formData.append('act', 'uploadChatImg');

      $.ajax({
        url: './ajax.counsel_chat.php',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        dataType: 'json',  // JSON 응답 받는다고 명시!
        success: function(res) {
          if (res.status === 'ok' && res.filename) {
            $('#textinput').val('[img]'+res.filename);
            SendMsg2ServerSubmit();
          } else {
            console.error('업로드 실패 또는 잘못된 응답:', res);
          }
        },
        error: function(xhr, status, error) {
          console.error('Ajax 오류:', error);
        }
      });
    });

	// 시작
  if($('#is_csr').val() == 'N') { 
	updateCountdown();
	// const timer = setInterval(updateCountdown, 1000);
  } else {
    $('#countdown').css('display','none');
  }

  function typing_chat() { 
    if(!statusCheck()) return;
      if (!isTyping) {
          const svrData = {
            CmdTp: "conv_msg",
            Msg: '[typing]',
            HtmlFlag: false,
          };
          const jsStr = JSON.stringify(svrData);
          conn.send(jsStr);
          isTyping = true;
      }
  }
</script>

<?php
//include_once(G5_THEME_MOBILE_PATH.'/tail.php');
include_once(G5_THEME_MOBILE_PATH.'/tail.sub.php');
?>
