
function phone_auth_close_modal() {
   if (jQuery("#phone_auth_layer").length) {
      jQuery("#phone_auth_layer").remove();
   }
}


function phone_auth_window(url, winname, opt) {
   if ($("#phone_auth_layer").length) $("#phone_auth_layer").remove();

   var layerHtml = `
     <div id="phone_auth_layer" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:999999; display:flex; flex-direction:column;">
       <div style="padding:15px; background:#242d3d; color:#fff; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
         <span style="font-size:16px; font-weight:bold;">휴대폰 인증</span>
         <span onclick="phone_auth_close_modal()" style="cursor:pointer; font-size:28px; line-height:1; padding:0 10px;">&times;</span>
       </div>
       <div style="flex-grow:1; -webkit-overflow-scrolling:touch; overflow-y:auto;">
         <iframe id="auth_frame" name="auth_frame" src="${url}" style="width:100%; height:100%; border:none; display:block;"></iframe>
       </div>
     </div>
   `;

   $("body").append(layerHtml);                        
}

function member_topic_update(res,push_chk='Y'){
    const params = [];

    if (res.mb_level) {
       params.push(`chl_${res.mb_level}`);
    }
        // 전체 회원 채널
    params.push('chl_all');
    try {
            // 생년 채널
        if (res.mb_birth) {
                const d = new Date(res.mb_birth);
                if (!isNaN(d)) {
                    params.push(`chl_birth_${d.getFullYear()}`);
                }
        }
    } catch (error) {
            
    }
    try {

        const payload = {
            method : (push_chk === 'Y') ? 'fcm_sub_topic' : 'fcm_unsub_topic',
            param  : params
        };
        window.sajumoon_app.postMessage(JSON.stringify(payload));

    } catch (e) {
            
    } finally {

    }
    
}


function call_v2(mb_no,tel_){// 전화예약 (회원)
    $.ajax({
      type: "POST",
      url: "/bbs/ajax.call_reserve.php",
      data: { 
        'mb_no' : mb_no,
        'tel_'  : tel_
      },
      dataType: "json",
      success: function(data) {
        console.log(data)
        if (data && data.data) {
          window.location.href = 'tel:' + tel_;
        } else {
          alert('전화 연결에 실패했습니다.');
        }
      }
    })
}

function push_topic_update(fcm_chl,fcm_unchl){
        try {

            
            if(fcm_unchl && fcm_unchl.length){
                try {
                    let payload2 = {
                        method : 'fcm_unsub_topic',
                        param  : fcm_unchl
                    };
                    console.log('OFF',payload2)
                    window.sajumoon_app.postMessage(JSON.stringify(payload2));
                    
                } catch (error) {
                    
                }
                
            }
            // 취소를 하고 하는경우도 있으므로 구독해제 먼저 하고 구독하기.
            // 구독해제 처리 시간을 위해 딜레이 후 구독 실행
            setTimeout(function(){
                
                if(fcm_chl && fcm_chl.length){
                    try {
                        let payload1 = {
                            method : 'fcm_sub_topic',
                            param  : fcm_chl
                        };
                        window.sajumoon_app.postMessage(JSON.stringify(payload1));
                    } catch (error) {
                        
                    }
                }
            }, 500);

        } catch (error) {
            
        }
        
}



function set_member_push_update(){
    $.ajax({
      type: "POST",
      url: "/bbs/ajax.get_push_topic_update.php",
      data: { 'act' : 'get_member_info'},
      dataType: "json",
      success: function(data) {

        const obj       = (typeof data === 'string') ? JSON.parse(data) : data;
        const params    = [];
        const un_params = [];
        const currentYear = new Date().getFullYear();
        // for (let y = currentYear - 100; y <= currentYear + 100; y++) {
        //         un_params.push('chl_birth_' + y);
        // }
        if(obj.login_chk == "Y" && obj.data.push_all == "Y"){ // 로그인 완료 상태
           
           params.push(`chl_${obj.data.mb_level}`);
           params.push(`chl_all`);
           // 생일은
           try {
                
                if (obj.data.mb_birth) {
                        const d = new Date(obj.data.mb_birth);
                        if (!isNaN(d)) {
                            params.push(`chl_birth_${d.getFullYear()}`);
                        }
                        
                }
            } catch (error) {
                    
            }
        }else{ 
           un_params.push(`chl_all`);
           un_params.push(`chl_2`);
           un_params.push(`chl_5`);
        }
        // console.log('params',params)
        // console.log('un_params',un_params)
        push_topic_update(params,un_params);
      }
    });	
}
