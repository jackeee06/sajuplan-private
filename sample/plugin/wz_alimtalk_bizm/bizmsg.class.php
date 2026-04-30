<?php
class bizmsg {
    
    private $userId         = WZ_ALIMT_USERID;
    private $profile        = WZ_ALIMT_PROFILE_KEY;
	public  $msg            = ''; // [필수] 사용자에게 전달될 메시지 (공백포함 1,000자)

    public $at_type         = ''; // 발송구분
    public $message_type    = 'at'; // [필수] 메시지 타입 (at:알림톡, ft:친구톡)
    public $phn             = ''; // [필수] 수신자 전화번호 (국가코드(대한민국:82)를 포함한 전화번호)
    
    public $tmplId          = ''; // [선택] 메시지 유형을 확인할 템플릿 코드 (사전에 승인된 템플릿의 코드)
    public $smsKind         = 'L'; // [선택] 카카오 비즈메시지 발송이 실패했을 때 SMS 전환발송을 사용하는 경우 SMS/LMS 구분 (SMS: S, LMS: L)
    public $msgSms          = ''; // [선택] SMS 전환발송을 위한 메시지 
    public $smsSender       = ''; // [선택] SMS 전환발송 시 발신번호 
    public $smsLmsTit       = ''; // [선택] LMS 발송을 위한 제목 
    public $btn_name        = ''; // [선택] 메시지에 첨부할 버튼 이름 (템플릿 등록시 정의된 버튼 이름) 
    public $btn_url         = ''; // [선택] 메시지에 첨부할 버튼의 URL(템플릿 등록시 정의된 버튼 URL) 

    public $usr_name          = '';// 이름
	public $usr_name1         = '';// 발신자
	public $rcv_name1         = '';// 수신자
	public $usr_nick          = '';// 닉네임
	public $usr_id          = '';// 아이디

	public $reserv_reg_date          = '';// 신청일
	public $reserv_date         = '';// 예약일
    public $reserv_date_end         = '';// 최종예약일
	public $reserv_content          = '';// 예약내용

	public $edu_name          = '';// 교육명
    public $usr_shipping_corp = '';
    public $usr_shipping_num  = '';
    public $usr_bank_price    = '';   /// 입금액
    public $usr_bank_num      = '';  // 입금계좌
    public $usr_od_id         = '';


	public $usr_order_date   = ''; // 전송일
	public $usr_order_number   = ''; // 주문번호
	public $usr_order_name   = ''; // 주문자 이름
	public $usr_order_price   = ''; // 주문금액
	public $usr_order_method   = ''; // 주문방법

	public $usr_order_item   = ''; // 보증물품
	
	public $send_name   = '';	/// 발송지 이름
	public $end_name   = '';	/// 도착지 이름
	public $start_addr   = ''; // 발송 주소지
	public $end_addr   = '';	// 도착 주소지
	public $addr   = '';	// 주소

	public $d_manager_name   = '';	// 기사이름
	public $d_manager_hp   = '';	// 기사 전화번호
	public $store_name   = '';		// 상점이름


	public $im_password   = '';		// 임시비밀번호
	public $allow_num   = '';		// 인증번호
	public $join_point   = '';		// 회원가입포인트
	public $end_date   = '';		// 만료날짜
	public $goods_name   = '';		// 상품명
	public $con_name = '';  /// 상담사별명
  public $csr_name = ''; // 상담사명
  public $url = ''; // url




    public $button1           = array();
    public $button2           = array();
    public $button3           = array();
    public $button4           = array();
    public $button5           = array();

    public function __construct() {
        
    }

    function send() { 
        
        $set_msg        = $this->set_msg();
        $this->msg      = $set_msg ? $set_msg : $this->msg;
        $this->phn      = preg_replace("/[^0-9]*/s", "", $this->phn);

        $data = array();
        $data['message_type']   = $this->message_type;
        $data['phn']            = substr($this->phn, 0, 2) != '82' ? '82'. substr($this->phn, 1) : $this->phn; // 국가코드붙여서 처리.
        $data['profile']        = $this->profile;
        $data['tmplId']         = $this->tmplId;
        $data['msg']            = $this->msg;
        $data['smsKind']        = $this->smsKind;
        $data['msgSms']         = $this->msgSms ? $this->msgSms : $this->msg;
        $data['smsSender']      = $this->smsSender ? $this->smsSender : $this->phn;
        $data['smsLmsTit']      = $this->smsLmsTit ? $this->smsLmsTit : $config['cf_title'];

        if ($this->button1) {
            $data['button1'] = $this->button1;
        }
        if ($this->button2) {
            $data['button2'] = $this->button2;
        }
        if ($this->button3) {
            $data['button3'] = $this->button3;
        }
        if ($this->button4) {
            $data['button4'] = $this->button4;
        }
        if ($this->button5) {
            $data['button5'] = $this->button5;
        }


        $data = '['.json_encode($data).']';

        $headers = array('Content-type: Application/json', 'userId: '. $this->userId);

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, 'https://alimtalk-api.bizmsg.kr/v2/sender/send');
        curl_setopt($curl, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
        curl_setopt($curl, CURLOPT_VERBOSE, true);
        curl_setopt($curl, CURLOPT_HEADER, false);
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_SSLVERSION, true); // SSL 버젼 (https 접속시에 필요)

		
        $result = curl_exec($curl);
       
		

		curl_close($curl);

        return $result;
    } 

    function set_msg() { 
        
        global $g5;

        $sql = "select B.* from g5_alimtalk_tplsel as A inner join g5_alimtalk_tplmsg as B on A.at_id = B.at_id where A.at_type = '".trim($this->at_type)."' ";


		
			
		$at = sql_fetch($sql, true);

        if($this->at_type == '채팅 상담방 개설')  {
          $at['at_button1_url_1'] = str_replace('#{url}', $this->url, $at['at_button1_url_1']);
        }

        if (!$at['at_tplcode']) { 
            return false;
        } 


		$this->tmplId   = $at['at_tplcode'];

        if ($at['at_button1_name']) { 
            $this->button1['name']       = $at['at_button1_name'];
            $this->button1['type']       = $at['at_button1_type'];
            switch ($at['at_button1_type']) {
                case 'WL':
                    $this->button1['url_mobile'] = $at['at_button1_url_1'];
                    if ($at['at_button1_url_2']) { 
                        $this->button1['url_pc'] = $at['at_button1_url_2'];    
                    }                    
                    break;
                case 'AL':
                    $this->button1['scheme_android'] = $at['at_button1_url_1'];
                    $this->button1['scheme_ios'] = $at['at_button1_url_2'];
                    break;
            }
        }
        if ($at['at_button2_name']) { 
            $this->button2['name']       = $at['at_button2_name'];
            $this->button2['type']       = $at['at_button2_type'];
            switch ($at['at_button2_type']) {
                case 'WL':
                    $this->button2['url_mobile'] = $at['at_button2_url_1'];
                    if ($at['at_button2_url_2']) { 
                        $this->button2['url_pc'] = $at['at_button2_url_2'];    
                    }                    
                    break;
                case 'AL':
                    $this->button2['scheme_android'] = $at['at_button2_url_1'];
                    $this->button2['scheme_ios'] = $at['at_button2_url_2'];
                    break;
            }
        }
        if ($at['at_button3_name']) { 
            $this->button3['name']       = $at['at_button3_name'];
            $this->button3['type']       = $at['at_button3_type'];
            switch ($at['at_button3_type']) {
                case 'WL':
                    $this->button3['url_mobile'] = $at['at_button3_url_1'];
                    if ($at['at_button3_url_2']) { 
                        $this->button3['url_pc'] = $at['at_button3_url_2'];    
                    }                    
                    break;
                case 'AL':
                    $this->button3['scheme_android'] = $at['at_button3_url_1'];
                    $this->button3['scheme_ios'] = $at['at_button3_url_2'];
                    break;
            }
        }
        if ($at['at_button4_name']) { 
            $this->button4['name']       = $at['at_button4_name'];
            $this->button4['type']       = $at['at_button4_type'];
            switch ($at['at_button4_type']) {
                case 'WL':
                    $this->button4['url_mobile'] = $at['at_button4_url_1'];
                    if ($at['at_button4_url_2']) { 
                        $this->button4['url_pc'] = $at['at_button4_url_2'];    
                    }                    
                    break;
                case 'AL':
                    $this->button4['scheme_android'] = $at['at_button4_url_1'];
                    $this->button4['scheme_ios'] = $at['at_button4_url_2'];
                    break;
            }
        }
        if ($at['at_button5_name']) { 
            $this->button5['name']       = $at['at_button5_name'];
            $this->button5['type']       = $at['at_button5_type'];
            switch ($at['at_button5_type']) {
                case 'WL':
                    $this->button5['url_mobile'] = $at['at_button5_url_1'];
                    if ($at['at_button5_url_2']) { 
                        $this->button5['url_pc'] = $at['at_button5_url_2'];    
                    }                    
                    break;
                case 'AL':
                    $this->button5['scheme_android'] = $at['at_button5_url_1'];
                    $this->button5['scheme_ios'] = $at['at_button5_url_2'];
                    break;
            }
        }
        
        #{이름}, #{택배회사}, #{운송장번호}, #{입금액}, #{주문번호}, #{주문금액}
        $at_msg = $at['at_msg'];
        $at_msg = str_replace('#{이름}', $this->usr_name, $at_msg);
		$at_msg = str_replace('#{작성자}', $this->usr_name, $at_msg);
		$at_msg = str_replace('#{발신자}', $this->usr_name1, $at_msg);
		$at_msg = str_replace('#{수신자}', $this->rcv_name1, $at_msg);
        $at_msg = str_replace('#{택배회사}', $this->usr_shipping_corp, $at_msg);
        $at_msg = str_replace('#{운송장번호}', $this->usr_shipping_num, $at_msg);
        $at_msg = str_replace('#{입금액}', $this->usr_bank_price, $at_msg);
        $at_msg = str_replace('#{입금계좌}', $this->usr_bank_num, $at_msg);
        $at_msg = str_replace('#{주문번호}', $this->usr_od_id, $at_msg);
        $at_msg = str_replace('#{금액}', $this->usr_order_price, $at_msg);

		$at_msg = str_replace('#{닉네임}', $this->usr_nick, $at_msg);

		$at_msg = str_replace('#{전송일}', $this->usr_order_date, $at_msg);

		$at_msg = str_replace('#{보증물품}', $this->usr_order_item, $at_msg);
		$at_msg = str_replace('#{결제방법}', $this->usr_order_method, $at_msg);
		$at_msg = str_replace('#{주문번호}', $this->usr_order_number, $at_msg);
		$at_msg = str_replace('#{발송지이름}', $this->send_name, $at_msg);
		$at_msg = str_replace('#{도착지이름}', $this->end_name, $at_msg);
		
		$at_msg = str_replace('#{주소}', $this->addr, $at_msg);
		$at_msg = str_replace('#{도착지주소}', $this->end_addr, $at_msg);
		$at_msg = str_replace('#{발송지주소}', $this->start_addr, $at_msg);
		$at_msg = str_replace('#{기사이름}', $this->d_manager_name, $at_msg);
		$at_msg = str_replace('#{기사전화번호}', $this->d_manager_hp, $at_msg);
		$at_msg = str_replace('#{구매상점}', $this->store_name, $at_msg);


		$at_msg = str_replace('#{아이디}', $this->usr_id, $at_msg);
		$at_msg = str_replace('#{임시비밀번호}', $this->im_password, $at_msg);
		$at_msg = str_replace('#{인증번호}', $this->allow_num, $at_msg);
		$at_msg = str_replace('#{회원가입포인트}', $this->join_point, $at_msg);
		$at_msg = str_replace('#{만료날짜}', $this->end_date, $at_msg);
		$at_msg = str_replace('#{상품명}', $this->goods_name, $at_msg);
		$at_msg = str_replace('#{상담사별명}', $this->con_name, $at_msg);
    $at_msg = str_replace('#{상담사명}', $this->csr_name, $at_msg);
    $at_msg = str_replace('#{url}', $this->url, $at_msg);

		$at_msg = str_replace('#{회원아이디}', $this->usr_id, $at_msg);
		$at_msg = str_replace('#{신청일}', $this->reserv_reg_date, $at_msg);
		$at_msg = str_replace('#{예약일}', $this->reserv_date, $at_msg);
		$at_msg = str_replace('#{최종예약일}', $this->reserv_date_end, $at_msg);
		$at_msg = str_replace('#{예약내용}', $this->reserv_content, $at_msg);



        $at_msg = addslashes($at_msg);

        return $at_msg;
    } 
}