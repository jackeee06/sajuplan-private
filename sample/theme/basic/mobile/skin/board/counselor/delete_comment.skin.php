<?php
delete_cache_latest($bo_table);
echo G5_HTTP_BBS_URL.'/board.php?bo_table='.$bo_table.'&wr_id='.$write['wr_parent'];
exit;