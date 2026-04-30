<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 2017.04.02 추가 from lux
// 유지보수 신청하기
// Ver. 0.0.1

class MyClass {
    private $g5;
    private $userid;

    // 생성자
    function __construct($mb_id='')
    {
        $this->userid = $mb_id;
    }

    function privacy($str, $len=1)
    {
        $charset = mb_detect_encoding($str); // charset 검사
        $str = trim(strip_tags($str)); // 태그 및 공백 제거
        $str = mb_substr($str, 0, $len, $charset); // $len 만큼만 가져오기
        $str = $str . "**";

        return $str;
    }
}

class Board {

    private $g5;
    private $skin_url;

    // 생성자
    function __construct($url='')
    {
        global $g5;

        $this->g5 = $g5;
        $this->skin_url = $url;
    }
}

class Request extends Board {

    protected $g5;
    protected $skin_url;

    // 생성자
    function __construct($url='')
    {
        $this->skin_url = $url;
        echo $this->g5;
    }

    function setStat($stat=0)
    {

    }

    function getStatVal($stat=0)
    {
        switch($stat) {
            case 0:
                $css = 'state_rec';
                $val = "신청";
                break;
            case 1:
                $css = 'state_ing';
                $val = "이용";
                break;
            case 2:
                $css = 'state_end';
                $val = "종료";
                break;
			case 3:
                $css = 'state_cancel';
                $val = "취소";
                break;
            //case 4:
                //$css = 'state_stop';
                //$val = "보류";
                //break;
            default:
                $css = 'state_rec';
                $val = "대기";
        }

        $val = "<span class='" . $css . "'>" . $val . "</span>";

        return $val;
    }
	
	/**
    function getLevelVal($stat=0)
    {
        switch($stat) {
            case 0:
                $img = "user_1.png";
                $val = "일반회원";
                break;
            case 1:
                $img = "user_2.png";
                $val = "계약회원";
                break;
            default:
                $img = "user_1.png";
                $val = "일반회원";
        }

        $img = "<img src='" . $this->skin_url . "/img/" . $img . "' alt='" . $val . "' />";
        $val = $img . $val;

        return $val;
    }
	**/
}
?>