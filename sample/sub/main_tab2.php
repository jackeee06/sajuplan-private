<?php
include_once('../common.php');
include_once($_SERVER["DOCUMENT_ROOT"].'/lib/latest.lib.php');

$sca = $_POST['sca'] ?? 'all';
$itab = "rising";


echo latest('theme/counselor_latest', 'counselor', 13, 23);


?>
