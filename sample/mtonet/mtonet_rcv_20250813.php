<?php
include_once('../common.php');
################################################

$jsondata = file_get_contents('php://input');

//2024-10-17 mtonet에서 오는 모든 자료 남기기
if($jsondata){
    $isql = "insert into platform_consulting_log(`message`, `wdate`)values('".addslashes($jsondata)."',now())";
    @sql_query($isql);
}
//2024-10-17 mtonet에서 오는 모든 자료 남기기

$arr = json_decode($jsondata,true);
$arrlen = count($arr);

//print_r($arr);

if($arrlen > 0){

    $mtonet_allmsg = addslashes($jsondata);

    if($arr["csrid"]){ /// 해당 정보가 있으면 무조건 테이블로 insert 작업


        /// 앱을 통한건지? 전화를 통한건지 구분한다 /
        $csrid = $arr["csrid"];
        if($csrid){
            $minfo = get_csrid($arr["csrid"]);
        }


        $c_id = "";
        $minfo["mb_id"]?$c_id = $minfo["mb_id"]:"";


        $p_gubun = "N";
        if($arr["amt"] && ($arr["reason"]=="DISCONNECT" || $arr["reason"]=="END_CHAT")){
            $amt = (int)$arr["amt"];
            if($amt >=10000){
                $p_gubun = "Y";
            }else{
                $p_gubun = "N";
            }
        }

        $sql = "insert into platform_consulting(`mb_id`, `cpid`, `csrid`, `dtmfno`, `start`, `end`, `from`, `to`, `reason`, `telno`, `usetm`, `amt`, `preflag`, `eventtm`, `wr_datetime`, `membid`, `p_gubun`, `mrtn`, `roomid`)values('".$c_id."', '".$arr["cp_id"]."', '".$arr["csrid"]."', '".$arr["dtmfno"]."', '".$arr["start"]."', '".$arr["end"]."', '".$arr["from"]."' ,'".$arr["to"]."', '".$arr["reason"]."', '".$arr["telno"]."', '".$arr["usetm"]."' , '".$arr["amt"]."', '".$arr["preflag"]."', '".$arr["eventtm"]."',now(), '".$arr["membid"]."', '".$p_gubun."', '".$mtonet_allmsg."', '".$arr["roomid"]."')";
        //echo $sql;
        $rtn = sql_query($sql);
        $no = sql_insert_id();

//		START_ARS : 회원이 최초 접속하여 ARS 를 듣기 시작하면 발생.(접속이벤트와 동일)
//		 INSUFFICIENT : AG9 에서 회원이 상담사선택 후 연결전 회원잔액이 상담사의 차감단위 금액(예:1200)보다 적은 잔액인 경우 거절하며 발생.
//		 NOT_FOUND_CSRNO : 회원이 선택(DTMF)한 상담사 번호로 검색한 결과 상담사가 없는 경우 발생. 자동선택(9)인 경우 대기중(상담가능) 상담사가 없는 경우.
//		 NOT_IDLE : 회원이 선택(DMTF)한 상담사가 상담중인 경우
//		 ABSE : 회원이 선택한 상담사가 부재중인 경우
//		 TRY_OK : 회원이 선택한 상담사로 전화연결 시작(통신사로 전문발송완료)
//		 DISCONNECT: 회원과 상담사 전화가 끊어진 경우. 상담사와 회원 쪽 CallID 로 2 회 발생할 수있음.(1 회는 필수 이며 2 회는 보장성 없음)
//		 CONNECT_CSR : 상담사와 회원의 전화연결이 완료됨. 차감 시작(보장성 있음)
//		 NO_ANSWER_CSR : TRY_OK 이후 일정시간(30 초)동안 응답이 없는 경우. 받지 않는 경우 또는 받았다가 그냥 끊는 경우에 발생함. 세부 사유는 기간통신사에서 알려주지 않음.(SIP 연동규격)
//		 INSUFFICIENT_CONN : 상담사 연결하여 상담중에 잔액 부족하면 멘트와 함께 해당 Push 메시지


        /// 연결되면 상담중으로 상담사 상태 변경 //
        If($arr["reason"]=="TRY_OK"){
            ////연결이 되면 상담중으로 처리
            $strSQL = "UPDATE g5_member SET state = 'CONN' WHERE mb_1= '".$arr["dtmfno"]."'";
            sql_query($strSQL);
        }elseif($arr["reason"]=="TRYING") {
            $chatSQL = "UPDATE chat_room SET status = 'CNCH' WHERE room_token = '{$arr['roomid']}'";
            sql_query($chatSQL);

        }elseif($arr["reason"]=="DISCONNECT" || $arr["reason"]=="END_CHAT"){
            $strSQL = "UPDATE g5_member SET state = 'IDLE' WHERE mb_1= '".$arr["dtmfno"]."'";
            sql_query($strSQL);

            /// 예약되어있는 알람이 있는지 확인하고 처리
            set_resv_alrm($minfo["mb_id"], "IDLE");
            /// 예약되어있는 알람이 있는지 확인하고 처리끝.

            //채팅시에는 AG9 상태값도 변경 (채팅 시작시에 IDLE이 아닌 RDVC로 변경하였었음)

            if($arr["reason"]=="END_CHAT") {
                set_crs_status_chg($csrid,'IDLE');
                $chatSQL = "UPDATE chat_room SET status = 'DISCONNECT', chat_edate = NOW() WHERE room_token = '{$arr['roomid']}'";
                sql_query($chatSQL);
            }
        }


        ///// 회원 코인 차감/ 상담사 증가
        // if($arr["amt"]){ 20250813
        if ($arr["amt"] && in_array($arr["reason"], ["END_CHAT", "DISCONNECT"])) {

            if($arr["membid"]){
                $amt = (int)$arr["amt"];
                $meminfo = get_mbid($arr["membid"]);
                $m_id = $meminfo["mb_id"];
                insert_point($m_id, (-1)*$amt, '상담코인 차감', '@platform_consulting', $m_id, $no.'@상담코인 차감 :'.date("Y-m-d H:i:s",time())."@".$p_gubun);
            }

            if($arr["csrid"]){
                $amt = (int)$arr["amt"];
                insert_point($minfo["mb_id"], $amt, '상담코인 증가', '@platform_consulting', $m_id, $no.'@상담코인 증가 :'.date("Y-m-d H:i:s",time())."@".$p_gubun);
            }

        }
        ////// 회원 코인 차감 끝 //

    }

}

function set_crs_status_chg($crsid,$chg_status){ //상담사 csrid , 변경 코드상태값

    $url = "http://passcall.co.kr:20102/chat-mgr/".MOTONET_CPID;
    $headers = array(
        'Content-Type: application/json',
        'Authorization: ' . MOTONET_CALL_KEY
    );

    $fields = array(
        'cmd'    => 'csrstat',
        'csrid'  => $crsid, // 고객 ID   test_c
        'state'  => $chg_status  // 상담사 ID
    );

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $response  = curl_exec($ch);
    curl_close($ch);
    $rtn = json_decode($response, true);

    return $rtn;

}

ob_flush();
ob_end_clean();

?>