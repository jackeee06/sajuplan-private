// 전역 변수
var errmsg = "";
var errfld = null;

// 필드 검사
function check_field(fld, msg) {
    if ((fld.value = trim(fld.value)) == "")
        error_field(fld, msg);
    else
        clear_field(fld);
    return;
}

// 필드 오류 표시
function error_field(fld, msg) {
    if (msg != "")
        errmsg += msg + "\n";
    if (!errfld) errfld = fld;
    fld.style.background = "#BDDEF7";
}

// 필드를 깨끗하게
function clear_field(fld) {
    fld.style.background = "#FFFFFF";
}

function trim(s) {
    var t = "";
    var from_pos = to_pos = 0;

    for (i = 0; i < s.length; i++) {
        if (s.charAt(i) == ' ')
            continue;
        else {
            from_pos = i;
            break;
        }
    }

    for (i = s.length; i >= 0; i--) {
        if (s.charAt(i - 1) == ' ')
            continue;
        else {
            to_pos = i;
            break;
        }
    }

    t = s.substring(from_pos, to_pos);
    //				alert(from_pos + ',' + to_pos + ',' + t+'.');
    return t;
}

// 자바스크립트로 PHP의 number_format 흉내를 냄
// 숫자에 , 를 출력
function number_format(data) {

    var tmp = '';
    var number = '';
    var cutlen = 3;
    var comma = ',';
    var i;

    data = data + '';

    var sign = data.match(/^[\+\-]/);
    if (sign) {
        data = data.replace(/^[\+\-]/, "");
    }

    len = data.length;
    mod = (len % cutlen);
    k = cutlen - mod;
    for (i = 0; i < data.length; i++) {
        number = number + data.charAt(i);

        if (i < data.length - 1) {
            k++;
            if ((k % cutlen) == 0) {
                number = number + comma;
                k = 0;
            }
        }
    }

    if (sign != null)
        number = sign + number;

    return number;
}

// 새 창
function popup_window(url, winname, opt) {
    window.open(url, winname, opt);
}


// 폼메일 창
function popup_formmail(url) {
    opt = 'scrollbars=yes,width=417,height=385,top=10,left=20';
    popup_window(url, "wformmail", opt);
}

// , 를 없앤다.
function no_comma(data) {
    var tmp = '';
    var comma = ',';
    var i;

    for (i = 0; i < data.length; i++) {
        if (data.charAt(i) != comma)
            tmp += data.charAt(i);
    }
    return tmp;
}

// 삭제 검사 확인
function del(href) {
    if (confirm("삭제 시복구할 방법이 없습니다.\n\n정말 삭제하시겠습니까?")) {
        var iev = -1;
        if (navigator.appName == 'Microsoft Internet Explorer') {
            var ua = navigator.userAgent;
            var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
            if (re.exec(ua) != null)
                iev = parseFloat(RegExp.$1);
        }

        // IE6 이하에서 한글깨짐 방지
        if (iev != -1 && iev < 7) {
            document.location.href = encodeURI(href);
        } else {
            document.location.href = href;
        }
    }
}

// 쿠키 입력
function set_cookie(name, value, expirehours, domain) {
    var today = new Date();
    today.setTime(today.getTime() + (60 * 60 * 1000 * expirehours));
    document.cookie = name + "=" + escape(value) + "; path=/; expires=" + today.toGMTString() + ";";
    if (domain) {
        document.cookie += "domain=" + domain + ";";
    }
}

// 쿠키 얻음
function get_cookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return unescape(match[2]);
    return "";
}

// 쿠키 지움
function delete_cookie(name) {
    var today = new Date();

    today.setTime(today.getTime() - 1);
    var value = get_cookie(name);
    if (value != "")
        document.cookie = name + "=" + value + "; path=/; expires=" + today.toGMTString();
}

var last_id = null;

function menu(id) {
    if (id != last_id) {
        if (last_id != null)
            document.getElementById(last_id).style.display = "none";
        document.getElementById(id).style.display = "block";
        last_id = id;
    } else {
        document.getElementById(id).style.display = "none";
        last_id = null;
    }
}

function textarea_decrease(id, row) {
    if (document.getElementById(id).rows - row > 0)
        document.getElementById(id).rows -= row;
}

function textarea_original(id, row) {
    document.getElementById(id).rows = row;
}

function textarea_increase(id, row) {
    document.getElementById(id).rows += row;
}

// 글숫자 검사
function check_byte(content, target) {
    var i = 0;
    var cnt = 0;
    var ch = '';
    var cont = document.getElementById(content).value;

    for (i = 0; i < cont.length; i++) {
        ch = cont.charAt(i);
        if (escape(ch).length > 4) {
            cnt += 2;
        } else {
            cnt += 1;
        }
    }
    // 숫자를 출력
    document.getElementById(target).innerHTML = cnt;

    return cnt;
}

// 브라우저에서 오브젝트의 왼쪽 좌표
function get_left_pos(obj) {
    var parentObj = null;
    var clientObj = obj;
    //var left = obj.offsetLeft + document.body.clientLeft;
    var left = obj.offsetLeft;

    while ((parentObj = clientObj.offsetParent) != null) {
        left = left + parentObj.offsetLeft;
        clientObj = parentObj;
    }

    return left;
}

// 브라우저에서 오브젝트의 상단 좌표
function get_top_pos(obj) {
    var parentObj = null;
    var clientObj = obj;
    //var top = obj.offsetTop + document.body.clientTop;
    var top = obj.offsetTop;

    while ((parentObj = clientObj.offsetParent) != null) {
        top = top + parentObj.offsetTop;
        clientObj = parentObj;
    }

    return top;
}

function flash_movie(src, ids, width, height, wmode) {
    var wh = "";
    if (parseInt(width) && parseInt(height))
        wh = " width='" + width + "' height='" + height + "' ";
    return "<object classid='clsid:d27cdb6e-ae6d-11cf-96b8-444553540000' codebase='http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=6,0,0,0' " + wh + " id=" + ids + "><param name=wmode value=" + wmode + "><param name=movie value=" + src + "><param name=quality value=high><embed src=" + src + " quality=high wmode=" + wmode + " type='application/x-shockwave-flash' pluginspage='http://www.macromedia.com/shockwave/download/index.cgi?p1_prod_version=shockwaveflash' " + wh + "></embed></object>";
}

function obj_movie(src, ids, width, height, autostart) {
    var wh = "";
    if (parseInt(width) && parseInt(height))
        wh = " width='" + width + "' height='" + height + "' ";
    if (!autostart) autostart = false;
    return "<embed src='" + src + "' " + wh + " autostart='" + autostart + "'></embed>";
}

function doc_write(cont) {
    document.write(cont);
}

var win_password_lost = function (href) {
    window.open(href, "win_password_lost", "left=50, top=50, width=617, height=330, scrollbars=1");
}

$(document).ready(function () {
    $("#login_password_lost, #ol_password_lost").click(function () {
        win_password_lost(this.href);
        return false;
    });
});

/**
 * 포인트 창
 **/
var win_point = function (href) {
    var new_win = window.open(href, 'win_point', 'left=100,top=100,width=600, height=600, scrollbars=1');
    new_win.focus();
}

/**
 * 쪽지 창
 **/
var win_memo = function (href) {
    var new_win = window.open(href, 'win_memo', 'left=100,top=100,width=620,height=500,scrollbars=1');
    new_win.focus();
}

/**
 * 쪽지 창
 **/
var check_goto_new = function (href, event) {
    if (!(typeof g5_is_mobile != "undefined" && g5_is_mobile)) {
        if (window.opener && window.opener.document && window.opener.document.getElementById) {
            event.preventDefault ? event.preventDefault() : (event.returnValue = false);
            window.open(href);
            //window.opener.document.location.href = href;
        }
    }
}

/**
 * 메일 창
 **/
var win_email = function (href) {
    var new_win = window.open(href, 'win_email', 'left=100,top=100,width=600,height=580,scrollbars=1');
    new_win.focus();
}

/**
 * 자기소개 창
 **/
var win_profile = function (href) {
    var new_win = window.open(href, 'win_profile', 'left=100,top=100,width=620,height=510,scrollbars=1');
    new_win.focus();
}

/**
 * 스크랩 창
 **/
var win_scrap = function (href) {
    var new_win = window.open(href, 'win_scrap', 'left=100,top=100,width=600,height=600,scrollbars=1');
    new_win.focus();
}

/**
 * 홈페이지 창
 **/
var win_homepage = function (href) {
    var new_win = window.open(href, 'win_homepage', '');
    new_win.focus();
}

/**
 * 우편번호 창
 **/
var win_zip = function (frm_name, frm_zip, frm_addr1, frm_addr2, frm_addr3, frm_jibeon) {
    if (typeof daum === 'undefined') {
        alert("다음 우편번호 postcode.v2.js 파일이 로드되지 않았습니다.");
        return false;
    }

    var zip_case = 1;   //0이면 레이어, 1이면 페이지에 끼워 넣기, 2이면 새창

    var complete_fn = function (data) {
        // 팝업에서 검색결과 항목을 클릭했을때 실행할 코드를 작성하는 부분.

        // 각 주소의 노출 규칙에 따라 주소를 조합한다.
        // 내려오는 변수가 값이 없는 경우엔 공백('')값을 가지므로, 이를 참고하여 분기 한다.
        var fullAddr = ''; // 최종 주소 변수
        var extraAddr = ''; // 조합형 주소 변수

        // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
        if (data.userSelectedType === 'R') { // 사용자가 도로명 주소를 선택했을 경우
            fullAddr = data.roadAddress;

        } else { // 사용자가 지번 주소를 선택했을 경우(J)
            fullAddr = data.jibunAddress;
        }

        // 사용자가 선택한 주소가 도로명 타입일때 조합한다.
        if (data.userSelectedType === 'R') {
            //법정동명이 있을 경우 추가한다.
            if (data.bname !== '') {
                extraAddr += data.bname;
            }
            // 건물명이 있을 경우 추가한다.
            if (data.buildingName !== '') {
                extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName);
            }
            // 조합형주소의 유무에 따라 양쪽에 괄호를 추가하여 최종 주소를 만든다.
            extraAddr = (extraAddr !== '' ? ' (' + extraAddr + ')' : '');
        }

        // 우편번호와 주소 정보를 해당 필드에 넣고, 커서를 상세주소 필드로 이동한다.
        var of = document[frm_name];

        of[frm_zip].value = data.zonecode;

        of[frm_addr1].value = fullAddr;
        of[frm_addr3].value = extraAddr;

        if (of[frm_jibeon] !== undefined) {
            of[frm_jibeon].value = data.userSelectedType;
        }

        setTimeout(function () {
            of[frm_addr2].focus();
        }, 100);
    };

    switch (zip_case) {
        case 1 :    //iframe을 이용하여 페이지에 끼워 넣기
            var daum_pape_id = 'daum_juso_page' + frm_zip,
                element_wrap = document.getElementById(daum_pape_id),
                currentScroll = Math.max(document.body.scrollTop, document.documentElement.scrollTop);
            if (element_wrap == null) {
                element_wrap = document.createElement("div");
                element_wrap.setAttribute("id", daum_pape_id);
                element_wrap.style.cssText = 'display:none;border:1px solid;left:0;width:100%;height:300px;margin:5px 0;position:relative;-webkit-overflow-scrolling:touch;';
                element_wrap.innerHTML = '<img src="//i1.daumcdn.net/localimg/localimages/07/postcode/320/close.png" id="btnFoldWrap" style="cursor:pointer;position:absolute;right:0px;top:-21px;z-index:1" class="close_daum_juso" alt="접기 버튼">';
                jQuery('form[name="' + frm_name + '"]').find('input[name="' + frm_addr1 + '"]').before(element_wrap);
                jQuery("#" + daum_pape_id).off("click", ".close_daum_juso").on("click", ".close_daum_juso", function (e) {
                    e.preventDefault();
                    jQuery(this).parent().hide();
                });
            }

            new daum.Postcode({
                oncomplete: function (data) {
                    complete_fn(data);
                    // iframe을 넣은 element를 안보이게 한다.
                    element_wrap.style.display = 'none';
                    // 우편번호 찾기 화면이 보이기 이전으로 scroll 위치를 되돌린다.
                    document.body.scrollTop = currentScroll;
                },
                // 우편번호 찾기 화면 크기가 조정되었을때 실행할 코드를 작성하는 부분.
                // iframe을 넣은 element의 높이값을 조정한다.
                onresize: function (size) {
                    element_wrap.style.height = size.height + "px";
                },
                maxSuggestItems: g5_is_mobile ? 6 : 10,
                width: '100%',
                height: '100%'
            }).embed(element_wrap);

            // iframe을 넣은 element를 보이게 한다.
            element_wrap.style.display = 'block';
            break;
        case 2 :    //새창으로 띄우기
            new daum.Postcode({
                oncomplete: function (data) {
                    complete_fn(data);
                }
            }).open();
            break;
        default :   //iframe을 이용하여 레이어 띄우기
            var rayer_id = 'daum_juso_rayer' + frm_zip,
                element_layer = document.getElementById(rayer_id);
            if (element_layer == null) {
                element_layer = document.createElement("div");
                element_layer.setAttribute("id", rayer_id);
                element_layer.style.cssText = 'display:none;border:5px solid;position:fixed;width:300px;height:460px;left:50%;margin-left:-155px;top:50%;margin-top:-235px;overflow:hidden;-webkit-overflow-scrolling:touch;z-index:10000';
                element_layer.innerHTML = '<img src="//i1.daumcdn.net/localimg/localimages/07/postcode/320/close.png" id="btnCloseLayer" style="cursor:pointer;position:absolute;right:-3px;top:-3px;z-index:1" class="close_daum_juso" alt="닫기 버튼">';
                document.body.appendChild(element_layer);
                jQuery("#" + rayer_id).off("click", ".close_daum_juso").on("click", ".close_daum_juso", function (e) {
                    e.preventDefault();
                    jQuery(this).parent().hide();
                });
            }

            new daum.Postcode({
                oncomplete: function (data) {
                    complete_fn(data);
                    // iframe을 넣은 element를 안보이게 한다.
                    element_layer.style.display = 'none';
                },
                maxSuggestItems: g5_is_mobile ? 6 : 10,
                width: '100%',
                height: '100%'
            }).embed(element_layer);

            // iframe을 넣은 element를 보이게 한다.
            element_layer.style.display = 'block';
    }
}

/**
 * 새로운 비밀번호 분실 창 : 101123
 **/
win_password_lost = function (href) {
    var new_win = window.open(href, 'win_password_lost', 'width=617, height=330, scrollbars=1');
    new_win.focus();
}

/**
 * 설문조사 결과
 **/
var win_poll = function (href) {
    var new_win = window.open(href, 'win_poll', 'width=616, height=500, scrollbars=1');
    new_win.focus();
}

/**
 * 쿠폰
 **/
var win_coupon = function (href) {
    var new_win = window.open(href, "win_coupon", "left=100,top=100,width=700, height=600, scrollbars=1");
    new_win.focus();
}


/**
 * 스크린리더 미사용자를 위한 스크립트 - 지운아빠 2013-04-22
 * alt 값만 갖는 그래픽 링크에 마우스오버 시 title 값 부여, 마우스아웃 시 title 값 제거
 **/
$(function () {
    $('a img').mouseover(function () {
        $a_img_title = $(this).attr('alt');
        $(this).attr('title', $a_img_title);
    }).mouseout(function () {
        $(this).attr('title', '');
    });
});

/**
 * 텍스트 리사이즈
 **/
function font_resize(id, rmv_class, add_class, othis) {
    var $el = $("#" + id);

    if ((typeof rmv_class !== "undefined" && rmv_class) || (typeof add_class !== "undefined" && add_class)) {
        $el.removeClass(rmv_class).addClass(add_class);

        set_cookie("ck_font_resize_rmv_class", rmv_class, 1, g5_cookie_domain);
        set_cookie("ck_font_resize_add_class", add_class, 1, g5_cookie_domain);
    }

    if (typeof othis !== "undefined") {
        $(othis).addClass('select').siblings().removeClass('select');
    }
}

/**
 * 댓글 수정 토큰
 **/
function set_comment_token(f) {
    if (typeof f.token === "undefined")
        $(f).prepend('<input type="hidden" name="token" value="">');

    $.ajax({
        url: g5_bbs_url + "/ajax.comment_token.php",
        type: "GET",
        dataType: "json",
        async: false,
        cache: false,
        success: function (data, textStatus) {
            f.token.value = data.token;
        }
    });
}

$(function () {
    $(".win_point").click(function () {
        win_point(this.href);
        return false;
    });

    $(".win_memo").click(function () {
        win_memo(this.href);
        return false;
    });

    $(".win_email").click(function () {
        win_email(this.href);
        return false;
    });

    $(".win_scrap").click(function () {
        win_scrap(this.href);
        return false;
    });

    $(".win_profile").click(function () {
        win_profile(this.href);
        return false;
    });

    $(".win_homepage").click(function () {
        win_homepage(this.href);
        return false;
    });

    $(".win_password_lost").click(function () {
        win_password_lost(this.href);
        return false;
    });

    /*
    $(".win_poll").click(function() {
        win_poll(this.href);
        return false;
    });
    */

    $(".win_coupon").click(function () {
        win_coupon(this.href);
        return false;
    });

    // 사이드뷰
    var sv_hide = false;
    $(".sv_member, .sv_guest").click(function () {
        $(".sv").removeClass("sv_on");
        $(this).closest(".sv_wrap").find(".sv").addClass("sv_on");
    });

    $(".sv, .sv_wrap").hover(
        function () {
            sv_hide = false;
        },
        function () {
            sv_hide = true;
        }
    );

    $(".sv_member, .sv_guest").focusin(function () {
        sv_hide = false;
        $(".sv").removeClass("sv_on");
        $(this).closest(".sv_wrap").find(".sv").addClass("sv_on");
    });

    $(".sv a").focusin(function () {
        sv_hide = false;
    });

    $(".sv a").focusout(function () {
        sv_hide = true;
    });

    // 셀렉트 ul
    var sel_hide = false;
    $('.sel_btn').click(function () {
        $('.sel_ul').removeClass('sel_on');
        $(this).siblings('.sel_ul').addClass('sel_on');
    });

    $(".sel_wrap").hover(
        function () {
            sel_hide = false;
        },
        function () {
            sel_hide = true;
        }
    );

    $('.sel_a').focusin(function () {
        sel_hide = false;
    });

    $('.sel_a').focusout(function () {
        sel_hide = true;
    });

    $(document).click(function () {
        if (sv_hide) { // 사이드뷰 해제
            $(".sv").removeClass("sv_on");
        }
        if (sel_hide) { // 셀렉트 ul 해제
            $('.sel_ul').removeClass('sel_on');
        }
    });

    $(document).focusin(function () {
        if (sv_hide) { // 사이드뷰 해제
            $(".sv").removeClass("sv_on");
        }
        if (sel_hide) { // 셀렉트 ul 해제
            $('.sel_ul').removeClass('sel_on');
        }
    });

    $(document).on("keyup change", "textarea#wr_content[maxlength]", function () {
        var str = $(this).val();
        var mx = parseInt($(this).attr("maxlength"));
        if (str.length > mx) {
            $(this).val(str.substr(0, mx));
            return false;
        }
    });
});

function get_write_token(bo_table) {
    var token = "";

    $.ajax({
        type: "POST",
        url: g5_bbs_url + "/write_token.php",
        data: {bo_table: bo_table},
        cache: false,
        async: false,
        dataType: "json",
        success: function (data) {
            if (data.error) {
                alert(data.error);
                if (data.url)
                    document.location.href = data.url;

                return false;
            }

            token = data.token;
        }
    });

    return token;
}

$(function () {
    $(document).on("click", "form[name=fwrite] input:submit, form[name=fwrite] button:submit, form[name=fwrite] input:image", function () {
        var f = this.form;

        if (typeof (f.bo_table) == "undefined") {
            return;
        }

        var bo_table = f.bo_table.value;
        var token = get_write_token(bo_table);

        if (!token) {
            alert("토큰 정보가 올바르지 않습니다.");
            return false;
        }

        var $f = $(f);

        if (typeof f.token === "undefined")
            $f.prepend('<input type="hidden" name="token" value="">');

        $f.find("input[name=token]").val(token);

        return true;
    });
});


function rv_ajax_rtn(str) {
    var str = str;
    // 줄바꿈 제거
    str = str.replace(/\n/g, "");
    // 엔터 제거
    str = str.replace(/\r/g, "");
    // 공백 제거
    return str;
}


function board_singo(bo_table, wr_id, tmb_id, mode) {

    if (!bo_table) return;
    if (!wr_id) return;
    if (!mode) return;

    var msg = "";

    if (mode == "1") {
        msg = "게시물을 신고하시겠습니까?";
    } else if (mode == "2") {
        msg = "게시물을 차단하시겠습니까?";
    } else if (mode == "3") {
        msg = "글쓴이를 신고 하시겠습니까?";
    } else if (mode == "4") {
        msg = "글쓴이를 차단하시겠습니까?";
    }
    var flag = confirm(msg);
    if (flag == true) {
        $.ajax({
            url: "/bbs/ajax.singo.php",
            type: "POST",
            data: {
                "bo_table": bo_table,
                "wr_id": wr_id,
                "tmb_id": tmb_id,
                "mode": mode,
            },
            dataType: "html",
            success: function (data) {
                alert(data);
                location.reload();
            }
        });
    }
}

function send_state_kakatalk(mb_id, smb_id) {
    var flag = confirm('접속알림을 보내시겠습니까? 상담이 끝나면 알림톡을 보내드립니다.');
    if (flag == true) {
        $.ajax({
            url: "/bbs/ajax.state_kakatalk.php",
            type: "POST",
            data: {
                "mb_id": mb_id,
                "smb_id": smb_id,
            },
            dataType: "html",
            success: function (data) {

                var msg = rv_ajax_rtn(data);
                alert(msg);

                //location.reload();
            }
        });
    }
}


// [START log_event]
function logEvent(name, params) {
    if (!name) {
        return;
    }

    if (window.AnalyticsWebInterface) {
        // Call Android interface
        window.AnalyticsWebInterface.logEvent(name, JSON.stringify(params));
    } else if (window.webkit
        && window.webkit.messageHandlers
        && window.webkit.messageHandlers.firebase) {
        // Call iOS interface
        var message = {
            command: 'logEvent',
            name: name,
            parameters: params

        };
        window.webkit.messageHandlers.firebase.postMessage(message);
    } else { /// 웹일경우


        // No Android or iOS interface found
        console.log("No native APIs found.");
    }
}

// [END log_event]

// [START set_user_property]
function setUserProperty(name, value) {
    if (!name || !value) {
        return;
    }

    if (window.AnalyticsWebInterface) {
        // Call Android interface
        window.AnalyticsWebInterface.setUserProperty(name, value);
    } else if (window.webkit
        && window.webkit.messageHandlers
        && window.webkit.messageHandlers.firebase) {
        // Call iOS interface
        var message = {
            command: 'setUserProperty',
            name: name,
            value: value
        };
        window.webkit.messageHandlers.firebase.postMessage(message);
    } else {
        // No Android or iOS interface found
        console.log("No native APIs found.");
    }
}

// [END set_user_property]

// [START log_event_example]
function logEventExample() {
    // Log an event named "purchase" with parameters
    logEvent("purchase", {
        content_type: "product",
        value: 123,
        currency: "KWR",
        quantity: 2,
        items: [{
            item_id: "sample-item-id",
            item_variant: "232323"
        }],
        transaction_id: "1234567"
    });
}

// [END log_event_example]

// [START log_user_property_example]
function logUserPropertyExample() {
    // Set a user property named 'favorite_genre'
    setUserProperty("favorite_genre", "comedy")
}

// [END log_user_property_example]

let appflag = false;
if (window.AnalyticsWebInterface) {
    appflag = true;
} else if (window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers.firebase) {
    appflag = true;
}


// GTM 및 dataLayer 초기화
window.dataLayer = window.dataLayer || [];

///////////////////// 상품보기 g4호출 ////////////////////////

function g4_view_item(price, item_id, item_name) {
    if (appflag == true) {///////////////////// 앱에서 실행할 경우
        logEvent("view_item", {
            value: price,
            currency: "KWR",
            items: [{
                item_id: item_id,
                item_name: item_name
            }]
        });
    } else {//////////////////////// 웹에서 실행할 경우
        dataLayer.push({ecommerce: null});  // Clear the previous ecommerce object.
        dataLayer.push({
            event: "view_item",
            ecommerce: {
                currency: "KWR",
                value: price,
                items: [
                    {
                        item_id: item_id,
                        item_name: item_name
                    }
                ]
            }
        });
    }
}

function g4_view_item_new(price, item_id, item_name) {
    var param = {
        value: price,
        currency: "KWR",
        items: [{
            item_id: item_id,
            item_name: item_name
        }]
    };
    let obj = {
        'method': "log_event",
        'param1': "view_item",
        'param2': JSON.stringify(param)
    }
    window.thesaju_app.postMessage(JSON.stringify(obj));
}

//////////////////// 상품 보기 g4호출 끝 ///////////////////////


///////////////////// 상담하기 버튼 누를때 g4호출 ////////////////////////
function g4_add_to_cart(price, item_id, item_name) {
    logEvent("add_to_cart", {
        value: price,
        currency: "KWR",
        items: [{
            item_id: item_id,
            item_name: item_name
        }]
    });
}

function g4_add_to_cart_new(price, item_id, item_name) {
    var param = {
        value: price,
        currency: "KWR",
        items: [{
            item_id: item_id,
            item_name: item_name
        }]
    };
    let obj = {
        "method": "log_event",
        "param1": "add_to_cart",
        "param2": JSON.stringify(param)
    }
    window.thesaju_app.postMessage(JSON.stringify(obj));
}

//////////////////// 상담하기 버튼 누를때 g4호출 끝 ///////////////////////

///////////////////// 주문하기 g4호출 ////////////////////////
function g4_begin_checkout(price, item_id, item_name) {
    if (appflag == true) {///////////////////// 앱에서 실행할 경우
        logEvent("begin_checkout", {
            value: price,
            currency: "KWR",
            items: [{
                item_id: item_id,
                item_name: item_name
            }]
        });

    } else {//////////////////////// 웹에서 실행할 경우

        dataLayer.push({ecommerce: null});  // Clear the previous ecommerce object.
        dataLayer.push({
            event: "begin_checkout",
            ecommerce: {
                currency: "KWR",
                value: price,
                items: [
                    {
                        item_id: item_id,
                        item_name: item_name
                    }
                ]
            }
        });
    }
}

function g4_begin_checkout_new(price, item_id, item_name) {
    var param = {
        value: price,
        currency: "KWR",
        items: [{
            item_id: item_id,
            item_name: item_name
        }]
    };
    let obj = {
        "method": "log_event",
        "param1": "begin_checkout",
        "param2": JSON.stringify(param)
    }
    window.thesaju_app.postMessage(JSON.stringify(obj));
}

//////////////////// 주문하기 g4호출 끝 ///////////////////////


///////////////////// 주문완료 g4호출 ////////////////////////
function g4_purchase(order_id, price, item_id, item_name) {
    if (appflag == true) {///////////////////// 앱에서 실행할 경우
        logEvent("purchase", {
            value: price,
            currency: "KWR",
            items: [{
                item_id: item_id,
                item_name: item_name
            }],
            transaction_id: order_id
        });

    } else {//////////////////////// 웹에서 실행할 경우

        dataLayer.push({ecommerce: null});  // Clear the previous ecommerce object.
        dataLayer.push({
            event: "purchase",
            ecommerce: {
                transaction_id: order_id,
                value: price,
                currency: "KWR",
                items: [
                    {
                        item_id: item_id,
                        item_name: item_name

                    }]
            }
        });

        console.log(dataLayer);
    }
}

function g4_purchase_new(order_id, price, item_id, item_name) {
    var param = {
        value: price,
        currency: "KWR",
        items: [{
            item_id: item_id,
            item_name: item_name
        }],
        transaction_id: order_id
    };
    let obj = {
        "method": "log_event",
        "param1": "purchase",
        "param2": JSON.stringify(param)
    }
    window.thesaju_app.postMessage(JSON.stringify(obj));
}
//////////////////// 주문완료 g4호출 끝 ///////////////////////


//document.getElementById("event1").addEventListener("click", function() {
//    console.log("event1");
//    logEvent("event1", { foo: "bar", baz: 123 });
//});


function detectDevice() {
    const ua = navigator.userAgent;

    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isMobile = isAndroid || isIOS;

    return {
        isAndroid,
        isIOS,
        isMobile
    };
}

function webAlertAction(msg, action){
  return new Promise(function(resolve){
    $("body").append(`
      <div id="webAlert"
        style="position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,.6);z-index:999999;
        display:flex;align-items:center;justify-content:center;">
        <div style="background:#fff;padding:20px;border-radius:10px;width:80%;max-width:320px;">
          <div style="margin-bottom:15px;">${msg.replace(/\n/g,"<br>")}</div>
          <div style="text-align:right;">
            <button id="wa_ok" style="border:none;background:#000;color:#fff;padding:8px 14px;border-radius:6px;">확인</button>
          </div>
        </div>
      </div>
    `);
    $("#wa_ok").click(function(){
      $("#webAlert").remove();
      resolve(true);
      if(action === 'reload') {
        location.reload();
      } else if(action) {
        location.href = action;
      }
    });
  });
}




function webConfirm(msg){
  return new Promise(function(resolve){

    $("body").append(`
      <div id="webConfirm"
        style="position:fixed;
        top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,.6);
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:center;">
        
        <div style="background:#fff;padding:20px;border-radius:10px;width:80%;max-width:320px;">
          <div style="margin-bottom:15px;">
            ${msg.replace(/\\n/g,"<br>")}
          </div>

          <div style="text-align:right;">
            <button id="wc_cancel"
              style="
                border:none;
                background:#f2f2f2;
                padding:8px 14px;
                border-radius:6px;
                margin-right:8px;
              ">
              취소
            </button>

            <button id="wc_ok"
              style="
                border:none;
                background:#000;
                color:#fff;
                padding:8px 14px;
                border-radius:6px;
              ">
              확인
            </button>
          </div>
        </div>
      </div>
    `);

    $("#wc_ok").click(function(){
        $("#webConfirm").remove();
        resolve(true);
    });

    $("#wc_cancel").click(function(){
        $("#webConfirm").remove();
        resolve(false);
    });
  });
}


function webAlert(msg){
  return new Promise(function(resolve){

    $("body").append(`
      <div id="webAlert"
        style="position:fixed;
        top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,.6);
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:center;">
        
        <div style="background:#fff;padding:20px;border-radius:10px;width:80%;max-width:320px;">
          <div style="margin-bottom:15px;">
            ${msg.replace(/\\n/g,"<br>")}
          </div>

          <div style="text-align:right;">
            <button id="wa_ok"
              style="
                border:none;
                background:#000;
                color:#fff;
                padding:8px 14px;
                border-radius:6px;
              ">
              확인
            </button>
          </div>
        </div>
      </div>
    `);

    $("#wa_ok").click(function(){
        $("#webAlert").remove();
        resolve(true);
    });
  });
}


// 사용 예시
//const device = detectDevice();
//
//if (device.isIOS) {
//  console.log("iOS 기기입니다.");
//} else if (device.isAndroid) {
//  console.log("Android 기기입니다.");
//} else if (device.isMobile) {
//  console.log("모바일 기기입니다.");
//} else {
//  console.log("데스크탑 또는 알 수 없는 기기입니다.");
//}