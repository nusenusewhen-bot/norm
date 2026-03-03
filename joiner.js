// joiner.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node joiner.js <token> <inviteCode> <proxy>');
  process.exit(1);
}

const token = args[0];
const invite = args[1];          // e.g. "abc123" or full "https://discord.gg/abc123"
const proxyStr = args[2];

let proxy = null;
if (proxyStr) {
  if (proxyStr.includes('@')) {
    const [auth, hostPort] = proxyStr.split('@');
    const [user, pass] = auth.split(':');
    proxy = { server: `http://${hostPort}`, username: user, password: pass };
  } else {
    proxy = { server: `http://${proxyStr}` };
  }
}

(async () => {
  const userDataDir = path.join(__dirname, 'userdata', token.slice(-12)); // per-token profile
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,                       // change to false for debugging
    proxy,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
  });

  const page = await context.newPage();

  try {
    // 1. Inject token (most reliable login method in 2026)
    await page.goto('https://discord.com/login', { waitUntil: 'domcontentloaded', timeout: 45000 });

    await page.evaluate((tok) => {
      localStorage.setItem('token', JSON.stringify(tok));
    }, token);

    // Reload to apply login
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

    // Check if actually logged in
    const isLoggedIn = await page.evaluate(() => !!document.querySelector('[data-list-item-id="guildsnav___home"]') || window.location.href.includes('/channels/@me'));
    if (!isLoggedIn) throw new Error('Login failed - probably invalid/locked token');

    console.log(`Token ${token.slice(0,8)}... logged in`);

    // 2. Join
    const joinUrl = invite.startsWith('http') ? invite : `https://discord.com/invite/${invite}`;
    await page.goto(joinUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for join indicator / redirect
    await Promise.race([
      page.waitForURL(url => url.href.includes('/channels/'), { timeout: 45000 }),
      page.waitForTimeout(25000), // fallback
    ]);

    // Simple success check
    const joined = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes('welcome') ||
             window.location.href.includes('/channels/') ||
             !!document.querySelector('[aria-label*="Server"]');
    });

    if (joined) {
      console.log(`SUCCESS: Joined server`);
      process.exit(0);
    } else {
      throw new Error('Did not detect join success');
    }
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  } finally {
    await context.close();
  }
})();
