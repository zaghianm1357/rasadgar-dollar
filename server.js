/**
 * نقطهٔ شروع برای هاست‌های cPanel (Setup Node.js App)
 * Startup file در cPanel باید روی همین فایل باشد: server.js
 *
 * مسیر کامل انتشار در «راهنمای انتشار» آمده است:
 *   npm install
 *   npx prisma generate
 *   npm run build
 *   سپس Restart از پنل cPanel
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

try {
  require('./.next/standalone/server.js');
} catch (err) {
  console.error('[server.js] build output not found — first run: npm install && npm run build');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
