<?php

if(!defined('_GNUBOARD_')) include_once('../common.php');
require_once ($_SERVER["DOCUMENT_ROOT"].'/vendor/autoload.php');

function sendPushNotification($user_token, $link, $title, $message){

	global $auth_key;
	if(!$user_token)return;
	$url = 'https://fcm.googleapis.com/v1/projects/sajummon-5a4c0/messages:send';
    $ch = curl_init();
    $headers = array
    (
        'Authorization: Bearer ' .$auth_key['access_token'],
        'Content-Type: application/json'
    );

	//print_r($headers);
	//echo "<br><br>";
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0); 

    
	$title = $title;
	$message = $message;
	$number = "0";

	$notification_opt = array (
				'title'         => $title,
				'body'          => $message
	);

	//////////////////////////// android , ios ���й� �й� ////////////////////////////////////////
	$sql = "select t_phone, gubun, t_mb_id from tbl_android_phone where t_android_id='".$user_token."'";
		$rlt = sql_fetch($sql);
		//print_r($rlt["gubun"]);
		//echo "<br><br>";

		if($rlt["gubun"]=="1"){  //// �ȵ���̵� �� ������
			$sql1="select mb_id from g5_member where replace(mb_hp,'-','')='".$rlt["t_phone"]."'";
			$row1=sql_fetch($sql1);
			if($row1["mb_id"]){
				$mb_push_count = "0";
				//$mb_push_count = get_my_push_count($row1["mb_id"]);
				$number = $mb_push_count;
			}else{
				$number = '1';
			}

			$datas = array (
				'msg'     => $message,
				'url'     => $link,
				'number'=>$number,
			);

			$android_opt = array (
				'notification' => array(
					'default_sound'         => true
				),
				'data' => $datas,
			);

			$message = array
			(
				'token' =>$user_token,
				'notification' => $notification_opt,
				'android' => $android_opt,
				'data'=>$datas,
			);




		}else{ ////////////////// ios�� ������

			$sql1="select mb_id from g5_member where replace(mb_id,'-','')='".$rlt["t_mb_id"]."'";
			//echo $sql1;
			//echo "<br>";
			$row1=sql_fetch($sql1);
			if($row1["mb_id"]){
				$mb_push_count = "0";
				//$mb_push_count = get_my_push_count($row1["mb_id"]);
				$number = $mb_push_count;
			}else{
				$number = '1';
			}


			$datas = array (
				'msg'     => $message,
				'url'     => $link,
				'number'=>$number,
			);


			$notification_opt = array (
				'title'         => $title,
				'body'          => $message
			);

			$message = array
			(
				'token' =>$user_token,
				'notification' => $notification_opt,
				'data'=>$datas,
				'apns'=>array("headers"=>array("apns-priority"=>'10'), 'payload'=>array("aps"=>array("sound"=>'default')))
				
			);


		}

    $last_msg = array (
        "message" => $message
    );


    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS,json_encode($last_msg)); 
    $result = curl_exec($ch);



    if($result === FALSE){
      // die('FCM Send Error: ' . curl_error($ch));
        printf("cUrl error (#%d): %s<br>\n",
        curl_errno($ch),
        htmlspecialchars(curl_error($ch)));
    }

   // echo $result;
	//echo "<br><br><br>";
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



/////////////////////////////////////////////V2 신규 푸시 업데이트 처리 ///////////////////////////////////////////////////////////


function send_noti_token($token,$title,$msg,$push_type="",$ref_idx1="",$ref_idx2="",$event_url,$push_image=""){
    global $DB;
    
    $url = 'https://fcm.googleapis.com/v1/projects/sajummon-5a4c0/messages:send';
    putenv('GOOGLE_APPLICATION_CREDENTIALS='.$_SERVER['DOCUMENT_ROOT'].'/lib/sajummon_push_key.json');
    $event_url = preg_replace('/\s+/', '', $event_url);
    $scope = 'https://www.googleapis.com/auth/firebase.messaging';
    $client = new Google_Client();
    $client->useApplicationDefaultCredentials();
    $client->setScopes($scope);
    $auth_key = $client->fetchAccessTokenWithAssertion();
    $ch = curl_init();
    $notification_opt = array (
       'title'     => $title,
       'body'      => $msg,
    );
    if($push_image != ""){
      $notification_opt['image'] = $push_image;
    }

    $datas = array (
      'title'     => $title,
      'body'      => $msg,
      'ref_idx1'  => $ref_idx1,
      'ref_idx2'  => $ref_idx2,
      'push_type' => $push_type
    );
    $datas['event_url'] = $event_url;
    if($push_image != ""){
      $datas['image'] = $push_image;
    }
    $android_opt = array (
      'notification' => array(
          'default_sound' => true,
          "channel_id"    =>  'default',
      ),
      'priority' => 'high',
      'data' => $datas
    );
    $message = array
    (   'token'        => $token,
        'notification' => $notification_opt,
        'data'         => $datas,
        'android'      => $android_opt
    );
    $last_msg = array (
        "message" => $message
    );

    
    $headers = array
    (
        'Authorization: Bearer ' . $auth_key['access_token'],
        'Content-Type: application/json'
    );
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS,json_encode($last_msg));
    $result = curl_exec($ch);
    if($result === FALSE){

    }
}

function send_noti_topic($topic,$title,$msg,$push_type="",$ref_idx1="",$ref_idx2="",$event_url,$push_image=""){
    global $DB;
    
    $url = 'https://fcm.googleapis.com/v1/projects/sajummon-5a4c0/messages:send';
    putenv('GOOGLE_APPLICATION_CREDENTIALS='.$_SERVER['DOCUMENT_ROOT'].'/lib/sajummon_push_key.json');
    $event_url = preg_replace('/\s+/', '', $event_url);
    $scope = 'https://www.googleapis.com/auth/firebase.messaging';
    $client = new Google_Client();
    $client->useApplicationDefaultCredentials();
    $client->setScopes($scope);
    $auth_key = $client->fetchAccessTokenWithAssertion();
    $ch = curl_init();
    $notification_opt = array (
       'title'     => $title,
       'body'      => $msg,
    );
    if($push_image != ""){
      $notification_opt['image'] = $push_image;
    }

    $datas = array (
      'title'     => $title,
      'body'      => $msg,
      'ref_idx1'  => $ref_idx1,
      'ref_idx2'  => $ref_idx2,
      'push_type' => $push_type
    );
    $datas['event_url'] = $event_url;
    if($push_image != ""){
      $datas['image'] = $push_image;
    }
    $android_opt = array (
      'notification' => array(
          'default_sound' => true,
          "channel_id"    =>  'default',
      ),
      'priority' => 'high',
      'data' => $datas
    );
    $message = array
    (
        'topic'        => $topic,
        'notification' => $notification_opt,
        'data'         => $datas,
        'android'      => $android_opt,
        'apns'         => array(
            'headers' => array('apns-priority' => '10'),
            'payload' => array('aps' => array('sound' => 'default', 'content-available' => 1))
        )
    );
    $last_msg = array (
        "message" => $message
    );

    $headers = array
    (
        'Authorization: Bearer ' . $auth_key['access_token'],
        'Content-Type: application/json'
    );
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS,json_encode($last_msg));
    $result = curl_exec($ch);
	var_dump($result);
    if($result === FALSE){

    }
}

?>
