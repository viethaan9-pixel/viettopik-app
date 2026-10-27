// Makes mp3 files for every listening line and vocab word with Google Cloud Text-to-Speech.
// Run by .github/workflows/tts.yml. Needs env GOOGLE_TTS_KEY. `--dry` only counts.
// The app finds a file by audio/<ttsKey(voice|text)>.mp3, listed in audio/index.json.
import fs from "node:fs"; import vm from "node:vm";
const DRY = process.argv.includes("--dry");
const html = fs.readFileSync("index.html", "utf8");
const block = (name) => {                       // grab `const NAME=...;` (object/array literal)
  const i = html.indexOf(`const ${name}=`); if (i < 0) throw new Error("missing " + name);
  let j = i + `const ${name}=`.length, d = 0, q = null;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{" || c === "[") d++;
    if (c === "}" || c === "]") { d--; if (!d) return html.slice(i, k + 1) + ";"; }
  }
};
const ctx = {}; vm.createContext(ctx);
const setsSrc = html.match(/^const SETS_\d+=.*$/gm) || [];
vm.runInContext([...setsSrc, block("TTSV"), block("DAYS"), block("VOCAB"),
  "this.TTSV=TTSV;this.DAYS=DAYS;this.VOCAB=VOCAB;"].join("\n"), ctx);
const { TTSV, DAYS, VOCAB } = ctx;
// must match ttsKey() in index.html
const fnv = (s, h) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const ttsKey = (sp, t) => { const s = TTSV[sp] + "|" + t; return fnv(s, 2166136261).toString(16).padStart(8, "0") + fnv(s, 0x811c9dc6 ^ 0x5bd1e995).toString(16).padStart(8, "0"); };
const clean = (t) => String(t).replace(/\(.*?\)/g, "").replace(/~/g, "").trim();

const want = new Map();                           // key -> {sp, text}
const add = (sp, t) => { t = clean(t); if (t && t !== "_") want.set(ttsKey(sp, t), { sp, text: t }); };
for (const d of Object.values(DAYS)) for (const q of d.q) {
  (q.l || []).forEach(([sp, t]) => add(sp === "M" ? "M" : "F", t));
  (q.w || []).forEach((w) => add("F", w[0]));
}
for (const list of Object.values(VOCAB)) list.forEach((w) => add("F", w[0]));
[["M", "수미야, 오늘 면접 있지? 면접 잘 봐."], ["F", "어쩌지? 벌써부터 너무 떨려서 아무 생각이 안 나."], ["M", "준비 많이 했으니까 잘할 수 있을 거야."], ["F", "안녕하세요. 오늘 면접 잘 보세요."], ["M", "안녕하세요. 오늘 면접 잘 보세요."]].forEach(([s, t]) => add(s, t));

fs.mkdirSync("audio", { recursive: true });
const have = new Set(fs.readdirSync("audio").filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)));
const todo = [...want].filter(([k]) => !have.has(k));
const chars = todo.reduce((n, [, v]) => n + v.text.length, 0);
console.log(`lines ${want.size}, already made ${want.size - todo.length}, to make ${todo.length} (${chars} chars)`);
if (chars > 400000) throw new Error("too many characters in one run — stopping to stay in the free tier");
if (DRY) process.exit(0);
const KEY = process.env.GOOGLE_TTS_KEY; if (!KEY) throw new Error("GOOGLE_TTS_KEY is not set");

async function synth(sp, text) {
  for (let a = 1; ; a++) {
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + KEY, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: "ko-KR", name: TTSV[sp] }, audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 } }),
    });
    if (r.ok) return Buffer.from((await r.json()).audioContent, "base64");
    const msg = await r.text();
    if (a >= 4 || (r.status !== 429 && r.status < 500)) throw new Error(`TTS ${r.status}: ${msg.slice(0, 300)}`);
    await new Promise((s) => setTimeout(s, 2000 * a));
  }
}
let done = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let it; (it = queue.shift()); ) {
    const [k, { sp, text }] = it;
    fs.writeFileSync(`audio/${k}.mp3`, await synth(sp, text));
    if (++done % 50 === 0) console.log(`made ${done}/${todo.length}`);
  }
}));
for (const k of have) if (!want.has(k)) fs.unlinkSync(`audio/${k}.mp3`);   // old lines no longer used
fs.writeFileSync("audio/index.json", JSON.stringify({ voices: TTSV, keys: [...want.keys()].sort() }));
console.log(`done: made ${done}`);
