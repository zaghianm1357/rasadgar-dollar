#!/usr/bin/env node
/**
 * سامانه انتشار نسخه — رصدگر دلار (BIG TRADER)
 * هر نسخه جدید: بروزرسانی نسخه → ساخت فایل مستقل → آینه وردپرس → کامیت → تگ → push → GitHub Release با دارایی‌ها
 *
 * Usage:
 *   node scripts/release.mjs --type patch|minor|major     # نسخه بعدی خودکار
 *   node scripts/release.mjs --version 1.2.0              # شماره صریح
 *   node scripts/release.mjs --push-only                  # فقط push + ساخت Release برای تگ‌های بدون انتشار
 *   node scripts/release.mjs --type minor --dry-run       # نمایش برنامه بدون اجرا
 *   node scripts/release.mjs --type minor --skip-build    # بدون ساخت مجدد فایل مستقل
 *
 * احراز هویت (یکی از موارد):
 *   --token <PAT>  یا متغیر محیطی GITHUB_TOKEN / GH_TOKEN  → push و Release از طریق HTTPS
 *   فایل .git-keys/deploy_key (Deploy Key با دسترسی نوشتن) → push از طریق SSH
 *   هیچ‌کدام → فقط کامیت و تگ محلی (push بعداً با --push-only)
 *
 * توکن هرگز روی دیسک نوشته نمی‌شود.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, basename } from 'node:path';

const ROOT = '/home/z/my-project';
const VERSION_FILE = resolve(ROOT, 'version.json');
const PKG_FILE = resolve(ROOT, 'package.json');
const CHANGELOG = resolve(ROOT, 'CHANGELOG.md');
const STANDALONE_OUT = resolve(ROOT, 'download/rasadgar-dollar.html');
const WP_DIR = resolve(ROOT, 'scripts/wp-plugin/rasadgar-dollar');
const WP_ASSET = resolve(WP_DIR, 'assets/rasadgar-dollar.html');
const WP_ZIP = resolve(ROOT, 'download/rasadgar-dollar-wp.zip');
const DEPLOY_KEY = resolve(ROOT, '.git-keys/deploy_key');

/* ---------- args ---------- */
const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
}
const has = (n) => args.includes(n);
const OPT = {
  type: argOf('--type'),
  version: argOf('--version'),
  token: argOf('--token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null,
  pushOnly: has('--push-only'),
  dryRun: has('--dry-run'),
  skipBuild: has('--skip-build'),
};

const fa = (s) => '  ' + s;
function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function info(msg) { console.log(fa(msg)); }

function sh(cmd, cargs, opts = {}) {
  const r = spawnSync(cmd, cargs, { cwd: ROOT, encoding: 'utf8', ...opts });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/* ---------- helpers ---------- */
function parseRemote() {
  const r = sh('git', ['remote', 'get-url', 'origin']);
  if (r.code !== 0) die('remote origin پیدا نشد');
  const url = r.out;
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?\/?$/i);
  if (!m) die('remote گیت‌هاب شناسایی نشد: ' + url);
  return { owner: m[1].split('/')[0], repo: m[1].split('/')[1], url };
}

function requireCleanTree() {
  const r = sh('git', ['status', '--porcelain']);
  if (r.out) {
    die('درخت کاری تمیز نیست — ابتدا تغییرها را کامیت کنید:\n' + r.out.split('\n').slice(0, 12).map((l) => '    ' + l).join('\n'));
  }
}

function bumpSemver(v, type) {
  const [x, y, z] = v.split('.').map((n) => parseInt(n, 10));
  if ([x, y, z].some((n) => Number.isNaN(n))) die('شماره نسخه نامعتبر: ' + v);
  if (type === 'major') return `${x + 1}.0.0`;
  if (type === 'minor') return `${x}.${y + 1}.0`;
  if (type === 'patch') return `${x}.${y}.${z + 1}`;
  die('--type باید patch، minor یا major باشد');
}

function extractNotes(tag) {
  if (!existsSync(CHANGELOG)) return null;
  const lines = readFileSync(CHANGELOG, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ' + tag + ' ') || l.trim() === '## ' + tag);
  if (start < 0) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('## ') || l.trim() === '---') break;
    body.push(l);
  }
  const notes = body.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return notes || null;
}

function notesTitle(notes, tag) {
  // عنوان از سطر heading خود نسخه در CHANGELOG: «## v1.1.0 — تاریخ — عنوان»
  if (existsSync(CHANGELOG)) {
    const line = readFileSync(CHANGELOG, 'utf8').split('\n').find((l) => l.startsWith('## ' + tag));
    if (line) {
      let rest = line.replace(/^#+\s*/, '').replace(new RegExp('^' + tag + '\\b\\s*'), '').trim();
      const parts = rest.split('—').map((s) => s.trim()).filter(Boolean);
      // اگر بخش اول شبیه تاریخ بود، حذفش کن
      if (parts.length && /[\d۰-۹]/.test(parts[0]) && parts[0].length <= 20 && !/^[a-zA-Z\u0600-\u06FF]{4,}/.test(parts[0])) parts.shift();
      if (parts.length) return parts.join(' — ');
    }
  }
  return 'نسخه ' + tag;
}

/* ---------- github api ---------- */
async function gh(method, path, token, body, isUpload) {
  const base = isUpload ? 'https://uploads.github.com' : 'https://api.github.com';
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body && !isUpload ? { 'Content-Type': 'application/json' } : {}),
      ...(body && isUpload ? body.headers : {}),
    },
    body: body && isUpload ? body.body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json, text };
}

async function getReleaseByTag(tag, token, remote) {
  const r = await gh('GET', `/repos/${remote.owner}/${remote.repo}/releases/tags/${tag}`, token);
  return r.ok ? r.json : null;
}

async function createRelease(tag, title, notes, token, remote) {
  const r = await gh('POST', `/repos/${remote.owner}/${remote.repo}/releases`, token, {
    tag_name: tag,
    name: `${tag} — ${title}`,
    body: notes || title,
    draft: false,
    prerelease: false,
  });
  return r;
}

async function uploadAsset(uploadUrl, token, filePath, name, contentType) {
  const url = uploadUrl.replace(/\{\?name,label\}/, '') + '?name=' + encodeURIComponent(name);
  const data = readFileSync(filePath);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': contentType,
      'Content-Length': String(data.length),
    },
    body: new Uint8Array(data),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
}

/* ---------- push ---------- */
function doPush(remote) {
  const pushArgs = ['push', 'origin', 'main', '--follow-tags'];
  // ۱) توکن (فقط در حافظهٔ همان دستور — در config نوشته نمی‌شود)
  if (OPT.token) {
    const tokenUrl = remote.url.replace(/^https?:\/\//, 'https://x-access-token:' + OPT.token + '@');
    const r = sh('git', ['push', tokenUrl, 'main', '--follow-tags'], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    return { mode: 'token', ...r };
  }
  // ۲) کلید SSH دپلوی
  if (existsSync(DEPLOY_KEY)) {
    const sshBase = `ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
    let r = sh('git', ['push', 'git@github.com:' + remote.owner + '/' + remote.repo + '.git', 'main', '--follow-tags'],
      { env: { ...process.env, GIT_SSH_COMMAND: sshBase } });
    if (r.code !== 0) {
      // fallback: SSH روی پورت 443
      r = sh('git', ['push', 'git@github.com:' + remote.owner + '/' + remote.repo + '.git', 'main', '--follow-tags'],
        { env: { ...process.env, GIT_SSH_COMMAND: sshBase + ' -o Hostname=ssh.github.com -o Port=443' } });
      if (r.code === 0) r.via443 = true;
    }
    return { mode: 'ssh', ...r };
  }
  // ۳) بدون اعتبارنامه
  return { mode: 'none', code: 1, out: '', err: 'no credentials' };
}

/* ---------- publish releases for tags ---------- */
async function publishMissingReleases(tags, token, remote) {
  const results = [];
  let currentTag = null;
  try { currentTag = JSON.parse(readFileSync(VERSION_FILE, 'utf8')).tag || null; } catch { /* ignore */ }
  for (const tag of tags) {
    const existing = await getReleaseByTag(tag, token, remote);
    if (existing) { results.push({ tag, status: 'exists', url: existing.html_url }); continue; }
    const notes = extractNotes(tag);
    const title = notesTitle(notes, tag);
    if (OPT.dryRun) { results.push({ tag, status: 'dry-run-create', title }); continue; }
    const cr = await createRelease(tag, title, notes, token, remote);
    if (!cr.ok) { results.push({ tag, status: 'error', detail: cr.status + ' ' + (cr.json && cr.json.message || cr.text.slice(0, 200)) }); continue; }
    const rel = cr.json;
    // دارایی‌ها فقط برای Release نسخهٔ فعلی (نسخه‌های قدیمی بدون پیوست)
    if (currentTag && tag !== currentTag) { results.push({ tag, status: 'created', url: rel.html_url, note: 'بدون پیوست (نسخهٔ قدیمی)' }); continue; }
    const assets = [];
    if (existsSync(STANDALONE_OUT)) assets.push([STANDALONE_OUT, basename(STANDALONE_OUT), 'text/html; charset=utf-8']);
    if (existsSync(WP_ZIP)) assets.push([WP_ZIP, basename(WP_ZIP), 'application/zip']);
    for (const [fp, name, ct] of assets) {
      const up = await uploadAsset(rel.upload_url, token, fp, name, ct);
      results.push({ tag, status: up.ok ? 'asset-uploaded' : 'asset-failed', asset: name, detail: up.ok ? '' : String(up.status) });
    }
    results.push({ tag, status: 'created', url: rel.html_url });
  }
  return results;
}

function localTags() {
  const r = sh('git', ['tag', '-l', 'v*']);
  return r.out ? r.out.split('\n').filter(Boolean) : [];
}

/* ================= main ================= */
console.log('\n📦 انتشار نسخه — رصدگر دلار');
const remote = parseRemote();
info(`مخزن: ${remote.owner}/${remote.repo}`);

/* --- حالت push-only: فقط ارسال و تکمیل انتشارها --- */
if (OPT.pushOnly) {
  const tags = localTags();
  info('تگ‌های محلی: ' + (tags.join(', ') || '—'));
  if (OPT.dryRun) {
    info('[dry-run] push main + follow-tags و ساخت Release برای تگ‌های بدون انتشار');
    await publishMissingReleases(tags, OPT.token || 'dry', remote);
    process.exit(0);
  }
  const p = doPush(remote);
  if (p.mode === 'none') {
    console.error('✗ هیچ اعتبارنامه‌ای برای push نیست — توکن بدهید یا Deploy Key بسازید (راهنما در پایان اجرای عادی release).');
    process.exit(1);
  }
  if (p.code !== 0) {
    console.error('✗ push ناموفق:\n' + (p.err || p.out).split('\n').slice(0, 8).join('\n'));
    process.exit(1);
  }
  info(`push موفق (${p.mode}${p.via443 ? ' روی پورت 443' : ''}) — main + تگ‌ها`);
  if (!OPT.token) {
    info('برای ساخت صفحه Release و پیوست فایل‌ها، اسکریپت را با توکن دوباره اجرا کنید: node scripts/release.mjs --push-only --token <PAT>');
    process.exit(0);
  }
  const res = await publishMissingReleases(tags, OPT.token, remote);
  for (const r of res) {
    info(`Release ${r.tag}: ${r.status}${r.url ? ' → ' + r.url : ''}${r.asset ? ' (' + r.asset + ')' : ''}${r.detail ? ' ' + r.detail : ''}`);
  }
  process.exit(0);
}

/* --- حالت عادی: نسخه جدید --- */
const vjson = JSON.parse(readFileSync(VERSION_FILE, 'utf8'));
const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8'));
const current = vjson.version;

let target;
if (OPT.version) target = OPT.version;
else if (OPT.type) target = bumpSemver(current, OPT.type);
else if (has('--type') || args.length === 0) target = bumpSemver(current, 'patch');
else die('پارامتر نامعتبر — از --type یا --version یا --push-only استفاده کنید');

if (!/^\d+\.\d+\.\d+$/.test(target)) die('شماره نسخه نامعتبر: ' + target);
const TAG = 'v' + target;

const dupTag = sh('git', ['tag', '-l', TAG]);
if (dupTag.out) die(`تگ ${TAG} از قبل وجود دارد — برای ارسال از --push-only استفاده کنید`);

const notes = extractNotes(TAG);
const title = notesTitle(notes, TAG);

console.log('');
info(`نسخه فعلی: ${current}  →  هدف: ${TAG}`);
info(`عنوان: ${title}`);
info(notes ? 'یادداشت انتشار از CHANGELOG.md استخراج شد ✓' : '⚠ بخش CHANGELOG برای ' + TAG + ' پیدا نشد (Release بدون متن منتشر می‌شود)');

if (OPT.dryRun) {
  console.log('');
  info('[dry-run] برنامه:');
  info('  1) version.json + package.json → ' + target);
  if (!OPT.skipBuild) info('  2) node scripts/build-standalone.mjs + کپی به آینه وردپرس + بازساخت zip');
  info('  3) git add (version.json, package.json, CHANGELOG.md, خروجی‌ها) + commit "release: ' + TAG + ' — ' + title + '"');
  info('  4) tag ' + TAG + ' (annotated)');
  info('  5) push main + تگ‌ها (' + (OPT.token ? 'token' : existsSync(DEPLOY_KEY) ? 'ssh deploy key' : 'بدون اعتبارنامه → محلی می‌ماند') + ')');
  info('  6) GitHub Release ' + TAG + ' + دارایی‌ها (html مستقل + zip وردپرس)' + (OPT.token ? '' : ' — نیازمند توکن'));
  process.exit(0);
}

/* ۱) بروزرسانی نسخه‌ها */
requireCleanTree();
vjson.version = target;
vjson.tag = TAG;
writeFileSync(VERSION_FILE, JSON.stringify(vjson, null, 2) + '\n');
pkg.version = target;
writeFileSync(PKG_FILE, JSON.stringify(pkg, null, 2) + '\n');
info('نسخه‌ها بروزرسانی شد: version.json + package.json → ' + target);

/* ۲) ساخت فایل مستقل */
if (!OPT.skipBuild) {
  const b = sh('node', ['scripts/build-standalone.mjs']);
  if (b.code !== 0) die('ساخت فایل مستقل ناموفق:\n' + (b.err || b.out));
  info('فایل مستقل: ' + (b.out.split('\n').find((l) => l.startsWith('OK')) || b.out));
  if (existsSync(STANDALONE_OUT) && existsSync(resolve(WP_DIR, 'assets'))) {
    writeFileSync(WP_ASSET, readFileSync(STANDALONE_OUT));
    info('آینه وردپرس بروزرسانی شد');
  }
  if (existsSync(WP_DIR)) {
    const z = sh('zip', ['-rq', WP_ZIP, 'rasadgar-dollar'], { cwd: resolve(ROOT, 'scripts/wp-plugin') });
    if (z.code !== 0) info('⚠ ساخت zip وردپرس ناموفق (ادامه می‌دهم)');
    else info('zip وردپرس بازسازی شد: ' + basename(WP_ZIP));
  }
}

/* ۳) کامیت */
const addList = ['version.json', 'package.json', 'CHANGELOG.md', 'download/rasadgar-dollar.html'];
if (existsSync(WP_ASSET)) addList.push('scripts/wp-plugin/rasadgar-dollar/assets/rasadgar-dollar.html');
if (existsSync(WP_ZIP)) addList.push('download/rasadgar-dollar-wp.zip');
const a = sh('git', ['add', ...addList]);
if (a.code !== 0) die('git add ناموفق');
const leftover = sh('git', ['status', '--porcelain']).out.split('\n').filter((l) => l && !l.startsWith('A ') && !l.startsWith('M '));
if (leftover.length) info('⚠ فایل‌های تغییرنکردهٔ خارج از لیست انتشار: ' + leftover.join(' | '));

const c = sh('git', ['commit', '-m', `release: ${TAG} — ${title}`]);
if (c.code !== 0) die('commit ناموفق:\n' + (c.err || c.out));
info('کامیت انتشار ساخته شد');

/* ۴) تگ */
const tagMsg = `رصدگر دلار ${TAG} — ${title}\n\n${(notes || '').slice(0, 600)}`;
const t = sh('git', ['tag', '-a', TAG, '-m', tagMsg]);
if (t.code !== 0) die('تگ ناموفق:\n' + (t.err || t.out));
info(`تگ ${TAG} ساخته شد`);

/* ۵) push */
const p = doPush(remote);
if (p.mode === 'none') {
  console.log('');
  info('⚠ push انجام نشد (اعتبارنامه نیست) — کامیت و تگ محلی آماده‌اند.');
  info('  اسکریپت را با توکن دوباره اجرا کنید (هرگز ذخیره نمی‌شود):');
  info('    node scripts/release.mjs --push-only --token <GitHub Fine-grained PAT با اجازه Contents: RW>');
  info('  پس از انتشار موفق می‌توانید توکن را در گیت‌هاب حذف (Revoke) کنید.');
} else if (p.code !== 0) {
  console.error('✗ push ناموفق:\n' + (p.err || p.out).split('\n').slice(0, 8).join('\n'));
  console.error('  بعد از رفع مشکل: node scripts/release.mjs --push-only');
  process.exit(1);
} else {
  info(`push موفق (${p.mode}${p.via443 ? ' روی پورت 443' : ''})`);
}

/* ۶) GitHub Release */
if (OPT.token) {
  const res = await publishMissingReleases(localTags(), OPT.token, remote);
  for (const r of res) {
    info(`Release ${r.tag}: ${r.status}${r.url ? ' → ' + r.url : ''}${r.asset ? ' (' + r.asset + ')' : ''}${r.detail ? ' ' + r.detail : ''}`);
  }
  console.log('');
  info('✅ انتشار کامل شد — صفحه Releases: https://github.com/' + remote.owner + '/' + remote.repo + '/releases');
} else if (p.mode !== 'none') {
  info('برای ساخت صفحه Release و پیوست دارایی‌ها، با توکن اجرا کنید: node scripts/release.mjs --push-only --token <PAT>');
}
console.log('');
