#!/usr/bin/env node
// Build whatsapp/upload-guide.html from whatsapp/UPLOAD-FROM-IPHONE.md.
//
//   npm install marked@14 && node tools/build-upload-guide.js
//
// The markdown is the source of truth; this produces a single self-contained
// file with the SVG mock-ups inlined, so it works offline, on the phone, and
// when printed. Never hand-edit the generated HTML — re-run this instead.
const fs = require('fs');
const path = require('path');

let marked;
try {
  ({ marked } = require('marked'));
} catch (e) {
  console.error('This builder needs "marked". Run:  npm install marked@14');
  process.exit(1);
}

const REPO = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(REPO, 'whatsapp/UPLOAD-FROM-IPHONE.md'), 'utf8');

marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: true });
let body = marked.parse(src);

// Inline every mock-up. A downloaded file with seven broken images would be
// worse than no pictures at all.
let inlined = 0;
body = body.replace(/<img src="img\/([^"]+)"([^>]*)>/g, (m, file, rest) => {
  const p = path.join(REPO, 'whatsapp/img', file);
  if (!fs.existsSync(p)) { console.warn('  MISSING:', file); return m; }
  inlined++;
  const svg = fs.readFileSync(p, 'utf8')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace('<svg ', '<svg class="mock" ');
  const alt = (rest.match(/alt="([^"]*)"/) || [, ''])[1];
  return `<figure>${svg}${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`;
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Uploading a chat export from the iPhone — Tony's Recipes</title>
<meta name="theme-color" content="#5C3D2E">
<style>
  :root{--cream:#FAF7F2;--warm-brown:#5C3D2E;--terracotta:#C1440E;--gold:#D4A843;
        --ink:#1C1A18;--muted:#8A8279;--border:#E8E0D5;--card:#fff;}
  @media (prefers-color-scheme: dark){
    :root{--cream:#171310;--ink:#F2EDE6;--muted:#A29A90;--border:#332A22;--card:#211A15;}
  }
  *{box-sizing:border-box;}
  body{font-family:-apple-system,'DM Sans',system-ui,Arial,sans-serif;background:var(--cream);
       color:var(--ink);margin:0;padding:26px 18px calc(60px + env(safe-area-inset-bottom));
       line-height:1.65;font-size:16.5px;}
  .wrap{max-width:760px;margin:0 auto;}
  h1{font-family:Georgia,serif;color:var(--warm-brown);font-size:27px;line-height:1.25;margin:0 0 18px;}
  h2{font-family:Georgia,serif;color:var(--warm-brown);font-size:22px;margin:34px 0 10px;
     padding-top:16px;border-top:1px solid var(--border);}
  h3{font-size:18px;margin:26px 0 8px;color:var(--terracotta);}
  @media (prefers-color-scheme: dark){ h1,h2{color:var(--gold);} }
  a{color:var(--terracotta);}
  code{background:rgba(128,128,128,0.14);border-radius:4px;padding:1.5px 5px;font-size:14px;
       font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word;}
  pre{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:13px 14px;
      overflow-x:auto;font-size:13.5px;line-height:1.5;}
  pre code{background:none;padding:0;font-size:13.5px;}
  blockquote{margin:14px 0;padding:12px 15px;background:var(--card);border:1px solid var(--border);
             border-inline-start:4px solid var(--gold);border-radius:0 10px 10px 0;font-size:15.5px;}
  blockquote p{margin:7px 0;}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;display:block;overflow-x:auto;}
  th,td{border:1px solid var(--border);padding:9px 11px;text-align:start;vertical-align:top;}
  th{background:rgba(128,128,128,0.10);font-weight:600;}
  figure{margin:16px 0;}
  svg.mock{width:100%;height:auto;display:block;border:1px solid var(--border);border-radius:12px;}
  figcaption{font-size:13px;color:var(--muted);margin-top:6px;text-align:center;}
  hr{border:none;border-top:1px solid var(--border);margin:28px 0;}
  li{margin:5px 0;}
  .note{background:#FFF8E8;border:1px solid #E8D9A8;color:#7A5C00;border-radius:10px;
        padding:12px 14px;font-size:14.5px;margin-bottom:20px;}
  @media print{
    body{background:#fff;color:#000;font-size:11pt;padding:0;}
    h1,h2{color:#000;} blockquote,pre,svg.mock{break-inside:avoid;}
    a{color:#000;text-decoration:underline;}
  }
</style>
</head>
<body>
<div class="wrap">
<div class="note">Self-contained copy — the pictures are embedded, so this works offline and prints.
The living version is in the repo at <code>whatsapp/UPLOAD-FROM-IPHONE.md</code>; this file is
generated from it by <code>tools/build-upload-guide.js</code>.</div>
${body}
</div>
</body>
</html>`;

fs.writeFileSync(path.join(REPO, 'whatsapp/upload-guide.html'), html);
console.log('  inlined', inlined, 'mock-ups');
console.log('  wrote whatsapp/upload-guide.html —', Math.round(html.length / 1024), 'KB');
