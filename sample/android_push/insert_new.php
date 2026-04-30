<?php
################ 공통 파일 ######################### 받는 거 똑같이 받고,
include_once "../common.php";
#########################################
//한 전화번호당 하나의 FCM 토큰만 유지


//$status = $_REQUEST['status'];
$android_id = $_REQUEST['android_id'];
$mb_id = $_REQUEST['mb_id'];
$stkey = $_REQUEST['stkey'];
$phonenumber = $_REQUEST['phonenumber'];

$gubun = $_REQUEST['gubun'];

if (!$gubun) {
    $gubun = 1;
}


if ($android_id) {
    $android_id = urldecode($android_id);
} else {
    echo "error no android_id";
    exit;
}


insert_phone_id($android_id, $mb_id, $phonenumber, $gubun);


function insert_phone_id($android_id, $mb_id = "", $phonenumber, $gubun)
{


//$seque = "select count(*) as cnt from tbl_android_phone where t_android_id='".$android_id."'";
    $seque = "select count(*) as cnt from tbl_android_phone where t_mb_id='" . $mb_id . "'";
    $result = sql_query($seque);

    if ($result) {
        $res = sql_fetch_array($result);
        $count = $res[cnt];
    }
//기존 row 있는지 검사
    if ($count <= 0) {

        $que = "insert into tbl_android_phone (t_status, t_android_id, t_phone, t_mb_id, gubun,  t_wdate)values('Y','" . $android_id . "', '" . $phonenumber . "', '" . $mb_id . "', '" . $gubun . "', now())";

        $result = sql_query($que);
        if ($result) {
            echo "success insert";
        } else {
            echo " error update error";
        }
    } else {

        //$que= "update tbl_android_phone set  t_android_id='".$android_id."' where t_phone='".$phonenumber."'"; //mb_id로 찾기 (app에서 무조건 mb_id 주는 방식으로 함)
        $que = "update tbl_android_phone set  t_android_id='" . $android_id . "', gubun='" . $gubun . "'  where t_mb_id='" . $mb_id . "'"; //mb_id로 찾기 (app에서 무조건 mb_id 주는 방식으로 함)

        $result = sql_query($que);
        /*if($result){
    //역할 보고 필요한지 판단을 하기
            $dsql = "select * from tbl_android_phone where t_phone='".$phonenumber."' and t_android_id!='".$android_id."'";

            $dresult = sql_query($dsql);
            if($dresult){
                while($dres=sql_fetch_array($dresult)){
                    if($dres["t_no"]){
                        $ddsql = "delete from tbl_android_phone where t_no='".$dres["t_no"]."'";
                        @sql_query($ddsql);
                    }
                }
            }
            echo "success insert";
        }else{
            echo "error update error";
        }*/
        echo "success insert";
    }


}

?>