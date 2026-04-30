<?php
$menu['menu300'] = array (
    array('300000', '회원관리', G5_ADMIN_URL.'/member_list.php', 'member'),
    array('300100', '회원관리', G5_ADMIN_URL.'/member_list.php', 'mb_list'),
	//array('300110', '고객리스트', G5_ADMIN_URL.'/member_list_customer.php?sst=&sod=desc&sfl=mb_level&stx=2', 'customer'),
	//array('300120', '상담사 리스트 ', G5_ADMIN_URL.'/counselor_list.php', 'counselor_list', 1),
    array('300200', '회원메일발송', G5_ADMIN_URL.'/mail_list.php', 'mb_mail'),
	array('300810', '접속자검색', G5_ADMIN_URL.'/visit_search.php', 'mb_search', 1),
    array('300820', '접속자로그삭제', G5_ADMIN_URL.'/visit_delete.php', 'mb_delete', 1),
    //array('300830', '포인트관리', G5_ADMIN_URL.'/point_list.php', 'mb_point'),
    array('300900', '투표관리', G5_ADMIN_URL.'/poll_list.php', 'mb_poll')
);