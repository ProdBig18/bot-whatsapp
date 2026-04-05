const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const TOKEN = '8287060645:AAEZItCeLCCw9aAivwy9_JuyAhj1FSupWiM';
const OWNER_CHAT_ID = '8151289296';

const INDEX_URL = 'https://wabetainfo.com/testflight/';
const STATE_FILE = path.join(__dirname, 'state.json');

const TARGETS = [
  { key: 'whatsapp', matchAny: ['whatsapp'], label: 'WhatsApp Beta' },
  { key: 'instagram', matchAny: ['instagram'], label: 'Instagram Beta' }
];

let lastUpdateId = 0;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}

  return { seenLinks: {}, versions: {} };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = loadState();

async function sendMessage(text) {
  await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    chat_id: OWNER_CHAT_ID,
    text
  });
}

async function clearWebhook() {
  await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true`);
}

function extractVersion(html) {
  const v = (html.match(/\d+\.\d+\.\d+/) || [])[0];
  return v || null;
}

async function fetchIndex() {
  const res = await axios.get(INDEX_URL);
  const $ = cheerio.load(res.data);
  const links = [];

  $('a').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href');
    if (href && text) links.push({ text, href });
  });

  return links;
}

async function checkIndex() {
  const links = await fetchIndex();

  for (const t of TARGETS) {
    const found = links.find(l => l.text.includes(t.key));
    if (!found) continue;

    const url = found.href;
    const prev = state.seenLinks[t.key];

    const page = await axios.get(url);
    const html = page.data;
    const version = extractVersion(html);

    state.seenLinks[t.key] = url;
    state.versions[t.key] = version;

    if (!prev || prev !== url) {
      await sendMessage(`🚨 NOVO LINK\n${t.label}\n${version ? '🧪 '+version+'\n' : ''}${url}`);
    }
  }

  saveState(state);
}

function buildLinks() {
  let txt = '🔗 LINKS:\n';
  for (const t of TARGETS) {
    const link = state.seenLinks[t.key] || 'nenhum';
    const v = state.versions[t.key] || '';
    txt += `\n${t.label}\n${link}${v ? '\n🧪 '+v : ''}\n`;
  }
  return txt;
}

async function checkCommands() {
  const res = await axios.get(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId+1}`);
  for (const u of res.data.result) {
    lastUpdateId = u.update_id;
    const txt = u.message?.text;

    if (txt === '/link' || txt === '/links') {
      await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        chat_id: u.message.chat.id,
        text: buildLinks()
      });
    }
  }
}

async function loop() {
  while (true) {
    await checkCommands();
    await new Promise(r => setTimeout(r, 3000));
  }
}

(async () => {
  await clearWebhook();
  console.log('BOT ONLINE');
  checkIndex();
  loop();
  setInterval(checkIndex, 60000);
})();
