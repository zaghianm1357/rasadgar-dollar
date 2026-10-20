<?php
/**
 * Plugin Name: رصدگر دلار — BIG TRADER
 * Plugin URI:  https://example.com/rasadgar-dollar
 * Description: ابزار داشبورد فارسی «رصدگر دلار» (اخبار اقتصادی دلار، چارت تریدینگ‌ویو، تحلیل هوشمند، دستیار معامله‌گر، پیشنهاد اسکلپ و سیگنال اونس) به‌صورت شورت‌کد در هر برگه‌ای از وردپرس. کافی است شورت‌کد [rasadgar_dollar] را در یک برگه بگذارید.
 * Version:     1.0.0
 * Author:      BIG TRADER
 * License:     GPL-2.0-or-later
 * Text Domain: rasadgar-dollar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // دسترسی مستقیم ممنوع.
}

define( 'RD_VERSION', '1.0.0' );
define( 'RD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'RD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'RD_ASSET_REL', 'assets/rasadgar-dollar.html' );

/* ---------------------------------------------------------------------------
 * تنظیمات پیش‌فرض
 * ------------------------------------------------------------------------- */
function rd_default_height() {
	return '100vh';
}

function rd_get_height() {
	$h = get_option( 'rd_height', rd_default_height() );
	// فقط عدد + واحدهای مجاز — جلوگیری از تزریق.
	if ( ! preg_match( '/^\d+(\.\d+)?(px|vh|vw|%|rem|em)$/', $h ) ) {
		return rd_default_height();
	}
	return $h;
}

/* ---------------------------------------------------------------------------
 * شورت‌کد: [rasadgar_dollar] یا [rasadgar-dollar height="90vh"]
 * ------------------------------------------------------------------------- */
function rd_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'height' => rd_get_height(),
			'title'  => 'رصدگر دلار — BIG TRADER',
		),
		$atts,
		'rasadgar_dollar'
	);

	$h = preg_match( '/^\d+(\.\d+)?(px|vh|vw|%|rem|em)$/', $atts['height'] ) ? $atts['height'] : rd_get_height();

	$src = rd_asset_url();

	return sprintf(
		'<div class="rd-app-wrap" style="width:100%%;max-width:560px;margin:0 auto;">
			<iframe src="%s" title="%s" loading="lazy"
				style="width:100%%;height:%s;border:0;border-radius:16px;overflow:hidden;background:#0b0f14;display:block;box-shadow:0 10px 40px rgba(0,0,0,.35)"
				allow="clipboard-write; fullscreen"></iframe>
		</div>',
		esc_url( $src ),
		esc_attr( $atts['title'] ),
		esc_attr( $h )
	);
}
add_shortcode( 'rasadgar_dollar', 'rd_shortcode' );
add_shortcode( 'rasadgar-dollar', 'rd_shortcode' );

/* ---------------------------------------------------------------------------
 * نشانی فایل ابزار با نسخهٔ خودکار (کش‌شکنی با filemtime)
 * ------------------------------------------------------------------------- */
function rd_asset_path() {
	return RD_PLUGIN_DIR . RD_ASSET_REL;
}

function rd_asset_url() {
	$v = '1.0.0';
	if ( file_exists( rd_asset_path() ) ) {
		$v = (string) filemtime( rd_asset_path() );
	}
	return RD_PLUGIN_URL . RD_ASSET_REL . '?v=' . rawurlencode( $v );
}

/* ---------------------------------------------------------------------------
 * حالت تمام‌صفحه: افزودن ?rasadgar-full=1 به نشانی هر صفحه‌ای که شورت‌کد دارد
 * صفحه بدون قالب/هدر/فوتر — مناسب موبایل و «نصب روی صفحهٔ اصلی»
 * ------------------------------------------------------------------------- */
function rd_maybe_render_fullpage() {
	if ( empty( $_GET['rasadgar-full'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return;
	}
	if ( ! file_exists( rd_asset_path() ) ) {
		wp_die( 'فایل ابزار یافت نشد — افزونه را دوباره نصب کنید.' );
	}
	header( 'Content-Type: text/html; charset=utf-8' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	readfile( rd_asset_path() ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit;
}
add_action( 'template_redirect', 'rd_maybe_render_fullpage', 1 );

/* ---------------------------------------------------------------------------
 * صفحهٔ تنظیمات: پیشخوان → تنظیمات → رصدگر دلار
 * ------------------------------------------------------------------------- */
function rd_admin_menu() {
	add_options_page(
		'رصدگر دلار',
		'رصدگر دلار',
		'manage_options',
		'rasadgar-dollar',
		'rd_settings_page'
	);
}
add_action( 'admin_menu', 'rd_admin_menu' );

function rd_register_settings() {
	register_setting( 'rd_settings_group', 'rd_height', array(
		'type'              => 'string',
		'sanitize_callback' => function ( $v ) {
			$v = trim( (string) $v );
			return preg_match( '/^\d+(\.\d+)?(px|vh|vw|%|rem|em)$/', $v ) ? $v : rd_default_height();
		},
		'default'           => rd_default_height(),
	) );
}
add_action( 'admin_init', 'rd_register_settings' );

function rd_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$asset_path = rd_asset_path();
	$exists     = file_exists( $asset_path );
	$size_kb    = $exists ? round( filesize( $asset_path ) / 1024 ) : 0;
	$modified   = $exists ? date_i18n( 'Y/m/d — H:i', filemtime( $asset_path ) ) : '—';
	?>
	<div class="wrap" dir="rtl">
		<h1>رصدگر دلار — BIG TRADER</h1>
		<p>نسخهٔ افزونه: <strong><?php echo esc_html( RD_VERSION ); ?></strong></p>

		<?php if ( ! $exists ) : ?>
			<div class="notice notice-error"><p>فایل ابزار در <code>assets/rasadgar-dollar.html</code> پیدا نشد. بستهٔ افزونه را دوباره بارگذاری کنید.</p></div>
		<?php else : ?>
			<div class="notice notice-success"><p>فایل ابزار بارگذاری شده است — حجم: <?php echo esc_html( $size_kb ); ?> کیلوبایت · آخرین به‌روزرسانی فایل: <?php echo esc_html( $modified ); ?></p></div>
		<?php endif; ?>

		<form method="post" action="options.php">
			<?php settings_fields( 'rd_settings_group' ); ?>
			<table class="form-table" dir="rtl">
				<tr>
					<th scope="row"><label for="rd_height">ارتفاع پیش‌فرض نمایش</label></th>
					<td>
						<input name="rd_height" id="rd_height" type="text" value="<?php echo esc_attr( rd_get_height() ); ?>" class="regular-text" dir="ltr" />
						<p class="description">مثل <code>100vh</code> (تمام ارتفاع صفحه)، <code>800px</code> یا <code>90%</code>. می‌توانید در شورت‌کد هم جداگانه بدهید: <code>[rasadgar_dollar height="800px"]</code></p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'ذخیره' ); ?>
		</form>

		<hr />
		<h2>راهنمای سریع</h2>
		<ol dir="rtl">
			<li>برگهٔ جدید بسازید: <strong>برگه‌ها ← افزودن برگه</strong> (مثلاً با عنوان «رصدگر دلار»).</li>
			<li> داخل ویرایشگر یک بلوک «شورت‌کد» بگذارید و بنویسید: <code>[rasadgar_dollar]</code></li>
			<li>برگه را منتشر کنید — تمام!</li>
			<li>حالت تمام‌صفحه (بدون قالب سایت): به نشانی برگه <code>?rasadgar-full=1</code> اضافه کنید.<br />
				مثال: <code><?php echo esc_html( home_url( '/rasadgar/?rasadgar-full=1' ) ); ?></code></li>
		</ol>
		<p dir="rtl"><strong>به‌روزرسانی ابزار:</strong> فایل جدید <code>rasadgar-dollar.html</code> را با FTP/فایل‌منیجر در پوشهٔ
			<code>wp-content/plugins/rasadgar-dollar/assets/</code> جایگزین کنید — نسخهٔ کش به‌صورت خودکار عوض می‌شود.</p>
		<p dir="rtl"><em>سلب مسئولیت: این ابزار صرفاً اطلاع‌رسانی محاسبه‌شده از داده‌های عمومی است و توصیهٔ معاملاتی نیست.</em></p>
	</div>
	<?php
}
