<?php
$menu['menu700'] = array (
	array('700000', '게시판관리', ''.G5_ADMIN_URL.'/board_list.php', 'board'),
    //array('700900', '방문예약 →', ''.G5_BBS_URL.'/board.php?bo_table=store', 'store'),
	//array('700900', '───────────', ''.G5_BBS_URL.'/board.php?bo_table=notice', 'line'),
    array('700100', '게시판관리', ''.G5_ADMIN_URL.'/board_list.php', 'bbs_board'),
    array('700200', '게시판그룹관리', ''.G5_ADMIN_URL.'/boardgroup_list.php', 'bbs_group'),
    array('700300', '인기검색어관리', ''.G5_ADMIN_URL.'/popular_list.php', 'bbs_poplist', 1),
    array('700400', '인기검색어순위', ''.G5_ADMIN_URL.'/popular_rank.php', 'bbs_poprank', 1),
    array('700500', '1:1문의설정', ''.G5_ADMIN_URL.'/qa_config.php', 'qa'),
    //array('700600', '내용관리', G5_ADMIN_URL.'/contentlist.php', 'scf_contents', 1),
    array('700700', 'FAQ관리', G5_ADMIN_URL.'/faqmasterlist.php', 'scf_faq', 1),
    array('700820', '글,댓글 현황', G5_ADMIN_URL.'/write_count.php', 'scf_write_count'),
    array('700900', '게시판신고관리', ''.G5_ADMIN_URL.'/board_singo.php', 'bbs_singo', 1),
);