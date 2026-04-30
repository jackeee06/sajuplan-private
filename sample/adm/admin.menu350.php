<?php

$sm = date("Y-m",time())."-01";
$m_endday = date('t', strtotime($sm));

$menu['menu350'] = array (
    array('350000', '사주문 관리', G5_ADMIN_URL.'/counselor_list.php', 'counselor', 1),
    //array('350200', '상담사 신청 관리 <i class="xi-external-link"></i>', ''.G5_BBS_URL.'/board.php?bo_table=apply',   'apply'),
    //array('350300', '상담현황', ''.G5_ADMIN_URL.'/counsel_history.php',   'counsel_history'),
	
	//array('350999', '──────────', '', 'line'),	
	
	array('350100', '<span class="gnb_2da_title gnb_2da_title_01" >회원현황</span>',G5_ADMIN_URL.'/member_list_customer.php?sst=&sod=desc&sfl=mb_level&stx=2', 'customer'),
	array('350110', '<span class="gnb_2da_dot">고객 리스트</span>',G5_ADMIN_URL.'/member_list_customer.php?sst=&sod=desc&sfl=mb_level&stx=2', 'customer'),
	array('350120', '<span class="gnb_2da_dot">상담사 리스트</span>', G5_ADMIN_URL.'/counselor_list.php', 'counselor_list', 1),
    array('350900', '<span class="gnb_2da_dot">접속자집계</span>', G5_ADMIN_URL.'/visit_date.php?token=26a3190ecaa59bdaa3e6daee0e667264&fr_date='.$sm.'&to_date='.date("Y-m",time()).'-'.$m_endday, 'mb_visit', 1),
	
    array('350400', '<span class="gnb_2da_title">매출현황</span>', G5_ADMIN_URL.'/coin_counsel_history.php', 'coin_history', 1),
	array('350410', '<span class="gnb_2da_dot">사용(상담) 내역</span>', G5_ADMIN_URL.'/coin_counsel_history.php', 'coin_counsel_history', 1),
	array('350460', '<span class="gnb_2da_dot">충전금액 설정</span>', G5_ADMIN_URL.'/coin_pay_form.php', 'coin_pay_form', 1),
	array('350420', '<span class="gnb_2da_dot">결제 내역</span>', G5_ADMIN_URL.'/coin_pay_history.php', 'coin_pay_history', 1),
	//array('350440', '<span class="gnb_2da_dot">누적 매출</span>', G5_ADMIN_URL.'/revenue_list_day.php', 'coin_pay_history', 1),
	
	
	array('350430', '<span class="gnb_2da_dot">포인트 관리</span>', G5_ADMIN_URL.'/point_list.php', 'point_list', 1),
	array('350450', '<span class="gnb_2da_dot">정산 이력</span>', G5_ADMIN_URL.'/settlement_list.php', 'settlement_list', 1),
    /*array('350599', '<span class="gnb_2da_title">상담후기</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),
      array('350001', '<span class="gnb_2da_dot">상담후기 관리</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),*/
    array('350599', '<span class="gnb_2da_title">상담관리</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),
    array('350001', '<span class="gnb_2da_dot">상담후기 관리</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),
    array('350002', '<span class="gnb_2da_dot">채팅내역 리스트</span>', G5_URL.'/my/chat_record.php" target="blank"', 'chat', 1),
	array('350599', '<span class="gnb_2da_title">상담후기</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),	
	array('350001', '<span class="gnb_2da_dot">상담후기 관리</span>', G5_URL.'/bbs/board.php?bo_table=review" target="blank"', 'review', 1),	
	
	array('350500', '<span class="gnb_2da_title">쿠폰</span>', G5_ADMIN_URL.'/shop_admin/couponlist.php', 'scf_coupon'),
	array('350510', '<span class="gnb_2da_dot">쿠폰관리</span>', G5_ADMIN_URL.'/shop_admin/couponlist.php', 'scf_coupon'),
	array('350520', '<span class="gnb_2da_dot">쿠폰존관리</span>', G5_ADMIN_URL.'/shop_admin/couponzonelist.php', 'scf_coupon_zone'),
	
    array('350599', '<span class="gnb_2da_title">기타</span>', G5_ADMIN_URL.'/settlement_list.php', 'settlement_list', 1),	
    array('350600', '<span class="gnb_2da_dot">배너관리</span>', G5_ADMIN_URL.'/shop_admin/bannerlist.php', 'scf_banner', 1),
    array('350700', '<span class="gnb_2da_dot">팝업레이어관리</span>', G5_ADMIN_URL.'/newwinlist.php', 'scf_poplayer'),
	array('350800', '<span class="gnb_2da_dot">사주메인관리</span>', G5_ADMIN_URL.'/saju_config.php', 'saju_config'),
	array('350999', '<span class="gnb_2da_dot">소원다락방</span>', G5_ADMIN_URL.'/wish_list.php', 'wish_list'),
	array('350002', '<span class="gnb_2da_dot">소원다락방 EVENT</span>', G5_URL.'/bbs/board.php?bo_table=wish_event" target="_blank"', 'wish_event'),
	array('350001', '<span class="gnb_2da_dot">상담문의</span>', G5_URL.'/bbs/board.php?bo_table=qa" target="blank"', 'qa'),
	array('350001', '<span class="gnb_2da_dot">1:1문의(상담사)</span>', G5_URL.'/bbs/qalist.php" target="blank"', 'qa_c'),
);
