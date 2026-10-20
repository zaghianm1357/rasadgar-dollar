/**
 * تولید جفت‌کلید ed25519 برای Deploy Key گیت‌هاب (بدون ssh-keygen)
 * خروجی:
 *   .git-keys/deploy_key      → کلید خصوصی (PKCS8 PEM — سازگار با OpenSSH ≥7.8)
 *   .git-keys/deploy_key.pub  → کلید عمومی (فرمت OpenSSH ssh-ed25519)
 */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const DIR = '/home/z/my-project/.git-keys';
mkdirSync(DIR, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

// کلید خصوصی — PKCS8 PEM (ssh آن را می‌خواند)
writeFileSync(DIR + '/deploy_key', privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });

// کلید عمومی — تبدیل SPKI به فرمت OpenSSH
const spki = publicKey.export({ type: 'spki', format: 'der' });
// آخرین ۳۲ بایت SPKI اِد۲۵۵۱۹ = نقطهٔ عمومی
const raw = spki.subarray(spki.length - 32);
function sshBuf(part) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(part.length, 0);
  return Buffer.concat([len, Buffer.from(part)]);
}
const wire = Buffer.concat([sshBuf('ssh-ed25519'), sshBuf(raw)]);
const pub = 'ssh-ed25519 ' + wire.toString('base64') + ' rasadgar-dollar-release';
writeFileSync(DIR + '/deploy_key.pub', pub + '\n');

console.log('OK');
console.log(pub);
