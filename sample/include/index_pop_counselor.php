<style>
    /* 하단 모달 오버레이 */
    .modal01 {
        display: none;
        position: fixed;
        z-index: 99999;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.5);
        font-size: 14px;
    }

    /* 모달 박스 */
    .modal-content {
        background-color: #fff;
        position: absolute;
        width: 100%; max-width: 650px;
        border-radius: 20px 20px 0 0;
        top: auto; bottom: 0;
        left: 50%; transform: translateX(-50%);
        padding: 0 0 24px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }

    /* 상단 핸들 바 */
    .modal-content::before {
        content: '';
        display: block;
        width: 40px; height: 4px;
        background: #ddd;
        border-radius: 2px;
        margin: 12px auto 0;
    }

    /* 닫기 버튼 */
    .modal_close {
        position: absolute;
        top: 12px; right: 16px;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        color: #aaa;
        cursor: pointer;
        z-index: 1;
    }
    .modal_close:hover { color: #333; }

    /* 모달 헤더 (이미지 + 텍스트 가로 배치) */
    .modal-consult .modal-header {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 20px 20px 0;
    }
    .modal-consult .modal-header-img {
        width: 72px; height: 72px;
        flex-shrink: 0;
        object-fit: contain;
    }
    .modal-consult .modal-header-text p {
        font-size: 13px;
        color: #999;
        margin-bottom: 4px;
    }
    .modal-consult .modal-header-text h3 {
        font-size: 17px;
        font-weight: 700;
        color: #222;
        line-height: 1.4;
    }

    /* 안내 박스 */
    .modal-consult .modal-info-box {
        margin: 16px 20px 0;
        background: #f8f6ff;
        border-radius: 10px;
        padding: 14px 16px;
        font-size: 13px;
        color: #555;
        line-height: 1.8;
    }
    .modal-consult .modal-info-box span {
        color: #8259f5;
        font-weight: 600;
    }

    /* 바로가기 버튼 */
    .modal-consult .modal-go-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 16px 20px 0;
        background: #8259f5;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        padding: 16px 0;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        width: calc(100% - 40px);
        box-sizing: border-box;
    }
    .modal-consult .modal-go-btn:hover {
        background: #6e42e0;
    }
</style>




<!-- 모달 버튼//닫기 버튼와 연동// 삭제금지! -->
<div class="modal_btn"></div>

<!-- Modal -->
<div class="modal01">
    <div class="modal-content modal-consult">

        <span class="modal_close"><i class="xi-close-thin"></i></span>

        <!-- 헤더: 이미지 + 타이틀 가로 배치 -->
        <div class="modal-header">
            <!-- <img src="<?php echo G5_URL; ?>/img/ic_piz_memo.png" alt="상담메모" class="modal-header-img"> -->
            <div class="modal-header-text">
                <p>잠깐만요, 상담사님.</p>
                <h3>아직 상담메모를 작성하지<br>않은 상담이 있어요!</h3>
            </div>
        </div>

        <!-- 안내 박스 -->
        <div class="modal-info-box">
            <span>· 상담분류, 상담주제</span> : 고객에게 노출되는 정보<br>
            <span>· 상담메모</span> : 상담사 본인만 확인 가능<br>
            <span style="color:#555; font-weight:400;">상담내역을 활용하시면 보다 효과적인 고객 관리가 가능합니다.</span>
        </div>

        <!-- 바로가기 버튼 -->
        <a href="<?php echo G5_URL; ?>/my/counselor_history.php">
            <button type="button" class="modal-go-btn">상담내역 바로가기</button>
        </a>

    </div>
</div>






<?php

$cnt = get_donot_my_c_history_cnt();

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

            // btns[num].onclick =  function() {

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

    window.onclick = function(event) {
//20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 시작
        if (event.target.className == "modal01") {
//20250723 eun 모달 닫기 버튼 안 눌러지는 거 수정 마감

            event.target.style.display = "none";

        }

    };



</script>