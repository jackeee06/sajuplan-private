<?php

include_once('./_common.php');

?>

<button id="run-abse-cron" style="padding:10px 18px;">상담사 자동 부재중 전환 실행</button>
<div> 해당 버튼을 누르시면 두 번 이상 고객 전화를 받지 않은 상담사의 상태가 부재중으로 변경됩니다.30분 이내 부재중 2건 이상, 알림톡 발송 예정</div>
<div> 어떤 기간 안에 부재중 2건 이상 발생 시 알림톡을 보내고, 자동 부재중 전환을 할지 변경 가능합니다.</div>
<div id="abse-cron-result"></div>
<script>
    document.getElementById('run-abse-cron').onclick = function () {
        if (!confirm('실행하시겠습니까?')) return;
        // fetch('/cron/counselor_abse_test.php', { method: 'POST' })
        fetch('/cron/counselor_abse.php', {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                // 테이블 헤더
                let html = `
        <div>[완료]전환 상담사 수: ${data.count}</div>
        <table style="margin-top:10px; border-collapse:collapse;">
            <tr>
                <th>상담사ID</th>
                <th>상담사명</th>
                <th>연락처</th>
            </tr>
    `;

                // 데이터 row
                (data.list || []).forEach(row => {
                    html += `<tr>
            <td>${row.mb_id || ''}</td>
            <td>${row.mb_nick || ''}</td>
            <td>${row.mb_hp || ''}</td>
            </tr>`;
                });

                html += '</table>';

                document.getElementById('abse-cron-result').innerHTML = html;
            })

            .catch(e => alert('실행 중 오류: ' + e));
    };
</script>

