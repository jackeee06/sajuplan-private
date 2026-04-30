<?php
if (!defined("_GNUBOARD_")) exit;  // 개별 페이지 접근 불가

// add_stylesheet('css 구문', 출력순서);  숫자가 작을 수록 먼저 출력됨
add_stylesheet('<link rel="stylesheet" href="'.G5_SHOP_SKIN_URL.'/style.css">', 0); 
//---------------------------
//idx 를 정의
//echo $skin; 
$ex_idx=explode(".",$skin); 
$idx=$ex_idx[1]; 
//---------------------------
?>

<?php
$max_width = $max_height = 0; 
$bn_first_class = ' class="sbn_first'.$idx.'"'; 

for ($i=0;  $row=sql_fetch_array($result);  $i++)
{
    //if ($i==0) echo '<section id="sbn_idx'.$idx.'" class="sbn">'.PHP_EOL.'<h2>쇼핑몰 배너</h2>'.PHP_EOL.'<ul>'.PHP_EOL; 
	if ($i==0) echo '<section id="sbn_idx'.$idx.'" class="sbn">'.PHP_EOL.'<ul>'.PHP_EOL; 
	
	echo '<div class="sbn_idx'.$idx.'_dot">'.PHP_EOL; 
	echo '<span class="sbn_idx'.$idx.'_dot_item"></span>'.PHP_EOL; 
	echo '<span class="sbn_idx'.$idx.'_dot_item"></span>'.PHP_EOL; 
	echo '<span class="sbn_idx'.$idx.'_dot_item"></span>'.PHP_EOL; 
	echo '<span class="sbn_idx'.$idx.'_dot_item"></span>'.PHP_EOL; 
	echo '<span class="sbn_idx'.$idx.'_dot_item"></span>'.PHP_EOL; 
	echo '</div>'.PHP_EOL; 
	
    //print_r2($row); 
    // 테두리 있는지
    $bn_border  = ($row['bn_border']) ? ' class="sbn_border"' : ''; ; 
    // 새창 띄우기인지
    $bn_new_win = ($row['bn_new_win']) ? ' target="_blank"' : ''; 

    $bimg = G5_DATA_PATH.'/banner/'.$row['bn_id']; 
    if (file_exists($bimg))
    {
        $banner = ''; 
        $size = getimagesize($bimg); 

        if($size[2] < 1 || $size[2] > 16)
            continue; 

        if($max_width < $size[0])
            $max_width = $size[0]; 

        if($max_height < $size[1])
            $max_height = $size[1]; 

        echo '<li'.$bn_first_class.'>'.PHP_EOL; 
        if ($row['bn_url'][0] == '#')
            $banner .= '<a href="'.$row['bn_url'].'">'; 
        else if ($row['bn_url'] && $row['bn_url'] != 'http://') {
            $banner .= '<a href="'.G5_SHOP_URL.'/bannerhit.php?bn_id='.$row['bn_id'].'"'.$bn_new_win.'>'; 
        }
        echo $banner.'<img src="'.G5_DATA_URL.'/banner/'.$row['bn_id'].'" width="'.$size[0].'" alt="'.$row['bn_alt'].'"'.$bn_border.'>'; 
        if($banner)
            echo '</a>'.PHP_EOL; 
        echo '</li>'.PHP_EOL; 

        $bn_first_class = ''; 
    }
}
if ($i>0) echo '</ul>'.PHP_EOL.'</section>'.PHP_EOL; 
?>

<script>
(function($) {
    var intervals = {}; 

    var methods = {
        init: function(option)
        {
            if(this.length < 1)
                return false; 

            var $bnnr = this.find("li:has(img)"); 
            var count = $bnnr.size(); 
            var $bnnr_a = $bnnr.find("a"); 
            var width = <?php echo $max_width;  ?>; 
            var height = <?php echo $max_height;  ?>; 
            var wrap_width = this.parent().width(); 
            var c_idx = o_idx = 0; 
            var el_id = this[0].id; 
            var $this = this; 

            if(width > wrap_width) {
                height = parseInt(height * (wrap_width / width)); 
            }
            width = wrap_width; 

            this.width(wrap_width).height(height)
                .find("ul").width(width).height(height)
                .find("li").width(width).height(height); 

            $bnnr.not(".sbn_first<?php echo $idx; ?>").css("left", width+"px"); 

            $bnnr.each(function() {
                var $img = $(this).find("img"); 
                var img_width = parseInt($img.attr("width")); 
                if(img_width > width)
                    img_width = width; 

                $img.removeAttr("width"); 
                $img.width(img_width); 
            }); 

            // 기본 설정값 1000=1초
            var settings = $.extend({
                interval: 4000, //멈춰져있는 시간
                duration: 500 // 이미지 움직이는 시간
            }, option); 

            if(count > 1) {
				// 좌우 슬라이드 화살표 // 없을 경우 슬라이드 안됨
                var slide_button = "<div id=\"sbn_btn_p<?php echo $idx; ?>\" class=\"sbn_btn\"><button type=\"button\" id=\"sbn_btn_prev<?php echo $idx; ?>\" class=\"sbn_btn_slide<?php echo $idx; ?>\"><span></span><!--이전--></button></div>\n"; 
				
                    slide_button += "<div id=\"sbn_btn_n<?php echo $idx; ?>\" class=\"sbn_btn\"><button type=\"button\" id=\"sbn_btn_next<?php echo $idx; ?>\" class=\"sbn_btn_slide<?php echo $idx; ?>\"><span></span><!--다음--></button></div>"; 

                this.find("ul").before(slide_button); 

                var $bnnr_btn = this.find(".sbn_btn_slide<?php echo $idx; ?>"); 

                $bnnr_btn.on("focusin", function() {
					clear_interval(); 
                }); 

                $bnnr_btn.on("focusout", function() {
                    set_interval(); 
                }); 
            }

            set_interval(); 

            $(".sbn_btn_slide<?php echo $idx; ?>").on("click", function() {
                if($this.find(":animated").size() > 0)
                    return false; 

                clear_interval(); 

                var id = $(this).attr("id"); 
                if(id.search("prev") > -1) {
                    right_rolling(); 
                } else {
                    left_rolling(); 
                }
            }); 

            $bnnr.hover(
                function() {
                    clear_interval(); 
                },
                function() {
                    set_interval(); 
                }
            ); 

            $bnnr_a.on("focusin", function() {
                clear_interval(); 
            }); 

            $bnnr_a.on("focusout", function() {
                set_interval(); 
            }); 

            function left_rolling() {
                $bnnr.each(function(index) {
                    if($(this).is(":visible")) {
                        o_idx = index; 
                        return false; 
                    }
                }); 

                $bnnr.not(":visible").css({
                    display: "none",
                    left: "+"+width+"px"
                }); 

                $bnnr.eq(o_idx).animate(
                    { left: "-="+width+"px" }, settings.duration,
                    function() {
                        $(this).css("display", "none").css("left", width+"px"); 
                    }
                ); 

                c_idx = (o_idx + 1) % count; 

                $bnnr.eq(c_idx).css("display", "block").animate(
                    { left: "-="+width+"px" }, settings.duration,
                    function() {
                        o_idx = c_idx; 
                    }
                ); 
            }

            function right_rolling() {
                $bnnr.each(function(index) {
                    if($(this).is(":visible")) {
                        o_idx = index; 
                        return false; 
                    }
                }); 

                $bnnr.not(":visible").css({
                    display: "none",
                    left: "-"+width+"px"
                }); 

                $bnnr.eq(o_idx).animate(
                    { left: "+="+width+"px" }, settings.duration,
                    function() {
                        $(this).css("display", "none").css("left", "-"+width+"px"); 
                    }
                ); 

                c_idx = (o_idx + 1) % count; 

                $bnnr.eq(c_idx).css("display", "block").animate(
                    { left: "+="+width+"px" }, settings.duration,
                    function() {
                        o_idx = c_idx; 
                    }
                ); 
            }

            function set_interval() {
                if(count > 1) {
                    clear_interval(); 

                    intervals[el_id] = setInterval(left_rolling, settings.interval); 
                }
            }

            function clear_interval() {
                if(intervals[el_id]) {
                    clearInterval(intervals[el_id]); 
                }
            }
        },
        stop: function()
        {
            var el_id = this[0].id; 
            if(intervals[el_id])
                clearInterval(intervals[el_id]); 
        }
    }; 

    $.fn.bannerRolling<?php echo $idx; ?> = function(option) {
        if (methods[option])
            return methods[option].apply(this, Array.prototype.slice.call(arguments, 1)); 
        else
            return methods.init.apply(this, arguments); 
    }
}(jQuery)); 

$(function() {
    $("#sbn_idx<?php echo $idx; ?>").bannerRolling<?php echo $idx; ?>(); 
    // 기본 설정값을 변경하려면 아래처럼 사용
    //$("#sbn_idx").leftRolling({ interval: 6000, duration: 2000 }); 
}); 
</script>

<style>
#sbn_idx<?php echo $idx; ?> {position:relative; margin:0 0 0px; width:100% !important;}

.sbn_idx<?php echo $idx; ?>_dot { position:absolute; bottom:10px; left:50%; transform:translateX(-50%);}
.sbn_idx<?php echo $idx; ?>_dot_item { display:inline-block; width:12px; height:12px; border-radius:50%; background-color:rgba(255,255,255,.0); border:1px solid rgba(255,255,255,.1); margin:0 4px;}
.sbn_idx<?php echo $idx; ?>_dot_item:nth-child(1) { background-color:rgba(255,255,255,.1);}

#sbn_idx<?php echo $idx; ?> .sbn_btn {    z-index: 9; 
    position: absolute; 
    opacity:1; 
    width: 10%; 
    height: 100%;
	min-width:50px; } /* 슬라이드 좌우 버튼 => 투명, 좌우 40% 선택 시 넘어가도록 커스텀 */
#sbn_idx<?php echo $idx; ?> .sbn_btn button {position:relative; top:0; margin:0; padding:0; width:100%; height:100%; border:0; background:transparent; overflow:hidden;}
#sbn_idx<?php echo $idx; ?> .sbn_btn span {display:block; width: 50px; height: 50px; background-color:red; background:url('<?php echo G5_SHOP_SKIN_URL; ?>/img/sbn_btn.png'); background-repeat:no-repeat; background-size:100px; position: absolute; top: 50%; transform: translateY(-50%); ;}
#sbn_idx<?php echo $idx; ?> #sbn_btn_p<?php echo $idx; ?> {left:0px}
#sbn_idx<?php echo $idx; ?> .sbn_btn #sbn_btn_prev<?php echo $idx; ?> span {background-position:0 0; left:00px;}
#sbn_idx<?php echo $idx; ?> #sbn_btn_n<?php echo $idx; ?> {right:0px}
#sbn_idx<?php echo $idx; ?> .sbn_btn #sbn_btn_next<?php echo $idx; ?> span {background-position:-50px 0; right:00px;}
#sbn_idx<?php echo $idx; ?> ul {position:relative; overflow:hidden}
#sbn_idx<?php echo $idx; ?> ul li {position:absolute; display:none; top:0; left:0}
#sbn_idx<?php echo $idx; ?> ul li.sbn_first<?php echo $idx; ?>{display:block}
</style>