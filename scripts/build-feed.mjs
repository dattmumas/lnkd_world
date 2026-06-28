#!/usr/bin/env node
/*
 * build-feed.mjs — Publish your 3 Cowork artifacts as a login-gated "/feed".
 *
 * It reads the latest generated HTML for each artifact, strips the Cowork-only
 * controls (the "Refresh now" button + reload hints), keeps the content and the
 * Copy buttons, builds a small hub page, and writes each page as a TypeScript
 * module under <repo>/feed-content/ (NOT public/). Those modules are imported by
 * the authenticated route handler app/feed/view/[slug]/route.ts, which serves the
 * HTML only to logged-in users. Keeping the HTML out of public/ is what makes the
 * gate real — nothing is fetchable without auth, on Cloudflare Workers included.
 *
 * Your existing scheduled tasks keep regenerating the artifacts as normal — this
 * script just snapshots the latest versions onto your site when you choose.
 *
 * USAGE
 *   1. Edit SITE_REPO below (or pass it as an env var).
 *   2. Run:        SITE_REPO=/path/to/your/site node build-feed.mjs
 *      Auto-push:  SITE_REPO=/path/to/your/site GIT_PUSH=1 node build-feed.mjs
 *
 * No dependencies — plain Node (v16+).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// ---------- CONFIG (edit these, or pass as env vars) ----------
const SITE_REPO  = process.env.SITE_REPO  || '/path/to/your/site';                 // your Next.js / React repo root
const CONTENT_DIR = process.env.CONTENT_DIR || 'feed-content';                       // non-public; bundled into the Worker
const ARTIFACTS  = process.env.ARTIFACTS_DIR || path.join(os.homedir(), 'Documents', 'Claude', 'Artifacts');
const GIT_PUSH   = process.env.GIT_PUSH === '1';                                     // set GIT_PUSH=1 to commit + push
// --------------------------------------------------------------

const SITE_TITLE = 'Health · Longevity · Startups — Signal Feed';

// Each artifact → output slug, card title, blurb, accent.
const PAGES = [
  { id: 'contentious-health-longevity-news', slug: 'contentious-news',
    title: 'Contentious Health & Longevity News',
    blurb: 'The most-debated stories in health & longevity — both sides, with sources.',
    accent: '#d97706', bg: '#fffaf2' },
  { id: 'x-trends-startups-health-longevity', slug: 'x-trends',
    title: 'Trending on X',
    blurb: 'What’s trending across startups, health & longevity — expand for the posts.',
    accent: '#2563eb', bg: '#f5f8ff' },
  { id: 'x-reply-opportunities', slug: 'reply-radar',
    title: 'Reply Radar',
    blurb: 'Recent on-topic posts worth replying to, each with a drafted reply.',
    accent: '#0d9488', bg: '#f2fbf9' },
];

const OUT_DIR = path.join(SITE_REPO, CONTENT_DIR);

function resolveSource(id) {
  // Default Cowork layout: <Artifacts>/<id>/index.html
  const nested = path.join(ARTIFACTS, id, 'index.html');
  if (fs.existsSync(nested)) return nested;
  // Fallback: a flat file named <id>.html or the out name in ARTIFACTS (useful for testing)
  const flat = path.join(ARTIFACTS, id + '.html');
  if (fs.existsSync(flat)) return flat;
  return null;
}

// Remove Cowork-only UI; keep content + Copy buttons.
function cleanForWeb(html) {
  // Structural removals: the refresh button row + the expand/refresh hint line.
  let out = html
    .replace(/<div class="controls">[\s\S]*?<\/div>/, '')
    .replace(/<div class="hint">[\s\S]*?<\/div>/, '');

  // Strip Cowork-only prose sentences, but NEVER touch <script>…</script> blocks
  // (the broad sentence regex would otherwise corrupt JS string literals and the
  // JSON metadata block, which only stayed valid before by lucky boundaries).
  out = out
    .split(/(<script[\s\S]*?<\/script>)/i)
    .map((seg) =>
      seg.slice(0, 7).toLowerCase() === '<script'
        ? seg
        : seg
            // seed-banner instruction that wraps "Refresh now" in <b> tags (Reply Radar)
            .replace(/Press\s*<b>\s*↻?\s*Refresh now\s*<\/b>[^.<]*\.\s*/gi, '')
            // any remaining sentence referencing the Cowork Refresh/Reload buttons
            .replace(/[^.<>]*(?:Reload button|Refresh now)[^.<>]*\.\s*/g, '')
    )
    .join('');

  // Neutralize the now-orphaned Cowork JS: setStatus referenced the removed
  // #status element, and refresh called window.cowork. Neither is reachable once
  // the Refresh button is gone. Both replacements fail safe — if the artifact's
  // shape ever changes they simply don't match and the code is left as-is.
  out = out
    .replace(/function setStatus\(msg\)\{[^}]*\}/, 'function setStatus(){}')
    .replace(
      /(?:async\s+)?function refresh\s*\([\s\S]*?(?=\n\s*function\s+(?:copyTweet|copyReply)\b)/,
      'function refresh(){}\n  '
    );

  return out.trim();
}

function fmtDate() {
  return new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Wrap a cleaned HTML string as an auto-generated TS module so esbuild inlines it
// into the Worker bundle (workerd has no filesystem, so we can't fs-read at runtime).
function toModule(html) {
  return `// AUTO-GENERATED by scripts/build-feed.mjs — do not edit by hand.\nexport default ${JSON.stringify(html)};\n`;
}

function buildHub(cards) {
  const when = fmtDate();
  const cardHtml = cards.map(c => `
      <a class="card" href="/feed/view/${c.slug}" style="--accent:${c.accent};--bg:${c.bg}">
        <div class="card-bar"></div>
        <div class="card-body">
          <h2>${c.title}</h2>
          <p>${c.blurb}</p>
          <span class="open">Open →</span>
        </div>
      </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SITE_TITLE}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#0f172a; background:#f7f8fa; line-height:1.5; }
  .wrap { max-width:820px; margin:0 auto; padding:40px 20px 64px; }
  header { margin-bottom:6px; }
  h1 { font-size:27px; margin:0 0 6px; }
  .sub { color:#64748b; font-size:14px; margin-bottom:26px; }
  .grid { display:grid; gap:16px; }
  @media (min-width:640px){ .grid { grid-template-columns:1fr 1fr; } }
  a.card { display:block; text-decoration:none; color:inherit; background:var(--bg,#fff); border:1px solid #e6e9ee; border-radius:14px; overflow:hidden; transition:transform .1s ease, box-shadow .1s ease; }
  a.card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,.08); }
  .card-bar { height:5px; background:var(--accent,#2563eb); }
  .card-body { padding:18px 18px 16px; }
  .card h2 { font-size:17px; margin:0 0 8px; line-height:1.3; }
  .card p { font-size:13.5px; color:#475569; margin:0 0 14px; }
  .open { font-size:13px; font-weight:700; color:var(--accent,#2563eb); }
  footer { margin-top:30px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${SITE_TITLE}</h1>
      <div class="sub">Updated ${when}</div>
    </header>
    <div class="grid">
${cardHtml}
    </div>
    <footer>Snapshots published from a local pipeline. Drafts shown are suggestions, not posted.</footer>
  </div>
</body>
</html>
`;
}

// ---------- run ----------
fs.mkdirSync(OUT_DIR, { recursive: true });

const published = [];
for (const p of PAGES) {
  const src = resolveSource(p.id);
  if (!src) { console.warn(`! skip ${p.id} — source not found under ${ARTIFACTS}`); continue; }
  const html = cleanForWeb(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.ts`), toModule(html));
  published.push(p);
  console.log(`✓ ${p.slug}.ts  ←  ${src}`);
}

if (published.length === 0) {
  console.error('No artifacts found. Check ARTIFACTS_DIR.'); process.exit(1);
}

fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), toModule(buildHub(published)));
console.log(`✓ index.ts (hub) → ${OUT_DIR}`);

if (GIT_PUSH) {
  try {
    execSync(`git -C "${SITE_REPO}" add "${CONTENT_DIR}"`, { stdio: 'inherit' });
    execSync(`git -C "${SITE_REPO}" commit -m "feed: publish snapshot ${new Date().toISOString()}"`, { stdio: 'inherit' });
    execSync(`git -C "${SITE_REPO}" push`, { stdio: 'inherit' });
    console.log('✓ committed + pushed (deploy should trigger)');
  } catch (e) {
    console.error('git step failed (nothing to commit, or check your remote):', e.message);
  }
}

console.log(`\nDone. Published ${published.length} page(s) to ${OUT_DIR}`);
console.log('Live (after deploy) at:  /feed   (login required)');
