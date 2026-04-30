<?php
ob_start();
include_once("_common.php");
include_once('captcha.lib.php');
ob_end_clean();

$captcha = new KCAPTCHA();
$captcha->setKeyString(get_session("ss_captcha_key"));
$captcha->image();