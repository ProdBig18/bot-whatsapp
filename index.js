const axios = require('axios');

const TOKEN = '8287060645:AAEZItCeLCCw9aAivwy9_JuyAhj1FSupWiM';
const OWNER_CHAT_ID = '8151289296';

const APPS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp Messenger',
    url: 'https://wabetainfo.com/wa-testflight/',
    detectAny: ['whatsapp messenger'],
    ignoreIfContains: ['whatsapp business'],
    enabled: true
  },
  {
    key: 'instagram',
    label: 'Instagram',
    url: 'https://testflight.apple.com/join/YirpiDN2',
    detectAny: ['instagram', 'ig mobile'],
    ignoreIfContains: [],
    enabled: true
  }
];

let lastUpdateId = 0;
const notifiedOpen = {};
const appStatus = {};

for (const app of APPS) {
  notifiedOpen[app.key] = false;
  appStatus[app.key] = 'Iniciando...';
}

async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (err) {
    console.error(err.message);
  }
}

function isFull(html) {
  const t = html.toLowerCase();
  return t.includes('this beta is full') || t.includes("isn't accepting");
}

function isAvailable(html) {
  const t = html.toLowerCase();
  return t.includes('open in testflight') || t.includes('accept');
}

async function checkApps() {
  for (const app of APPS) {
    try {
      const res = await axios.get(app.url);
      const html = String(res.data);

      if (!isFull(html) && isAvailable(html)) {
        if (!notifiedOpen[app.key]) {
          notifiedOpen[app.key] = true;
          await sendMessage(OWNER_CHAT_ID, `🔥 VAGA ABERTA!\n📱 ${app.label}\n🔗 ${app.url}`);
        }
      } else {
        notifiedOpen[app.key] = false;
      }

    } catch (e) {
      console.log('erro', e.message);
    }
  }
}

async function commands() {
  try {
    const res = await axios.get(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
    for (const u of res.data.result) {
      lastUpdateId = u.update_id;
      if (!u.message) continue;

      const chatId = u.message.chat.id;
      const text = u.message.text;

      if (text === '/start') {
        await sendMessage(chatId, '🚀 Bot ativo! Monitorando WhatsApp + Instagram');
      }

      if (text === '/status') {
        await sendMessage(chatId, '📡 Rodando 24h');
      }

      if (text === '/apps') {
        await sendMessage(chatId, '📱 Apps: WhatsApp + Instagram');
      }
    }
  } catch (e) {}
}

setInterval(checkApps, 30000);
setInterval(commands, 3000);

console.log('BOT ONLINE');
