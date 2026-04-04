const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const TOKEN = '8287060645:AAEZItCeLCCw9aAivwy9_JuyAhj1FSupWiM';
const OWNER_CHAT_ID = '8151289296';

const INDEX_URL = 'https://wabetainfo.com/testflight/';
const STATE_FILE = path.join(__dirname, 'state.json');

const TARGETS = [
  {
    key: 'whatsapp',
    matchAny: ['whatsapp messenger', 'whatsapp beta', 'whatsapp'],
    label: 'WhatsApp Beta'
  },
  {
    key: 'instagram',
    matchAny: ['instagram'],
    label: 'Instagram Beta'
  }
];

let lastUpdateId = 0;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Erro ao ler state.json:', err.message);
  }

  return {
    seenLinks: {},
    notifiedLinks: {},
    notifiedOpen: {},
    status: {}
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar state.json:', err.message);
  }
}

const state = loadState();

async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    });
  } catch (err) {
    console.error('Erro Telegram:', err.response?.data || err.message);
  }
}

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function matchesTarget(title, target) {
  const t = title.toLowerCase();
  return target.matchAny.some(term => t.includes(term));
}

function detectTestFlightAvailability(html) {
  const t = html.toLowerCase();

  const isFull =
    t.includes('this beta is full') ||
    t.includes("isn't accepting any new testers right now") ||
    t.includes('isn’t accepting any new testers right now');

  const isAvailable =
    t.includes('open in testflight') ||
    t.includes('start testing') ||
    t.includes('accept') ||
    t.includes('install') ||
    t.includes('instalar');

  return { isFull, isAvailable };
}

function extractVersionInfo(html) {
  const text = String(html || '');

  const versionMatch =
    text.match(/Vers[aã]o\s*<[^>]*>\s*([0-9]+(?:\.[0-9]+)+)/i) ||
    text.match(/Vers[aã]o\s*([0-9]+(?:\.[0-9]+)+)/i) ||
    text.match(/Version\s*<[^>]*>\s*([0-9]+(?:\.[0-9]+)+)/i) ||
    text.match(/Version\s*([0-9]+(?:\.[0-9]+)+)/i);

  const buildMatch =
    text.match(/Compila[cç][aã]o\s*<[^>]*>\s*([0-9]+)/i) ||
    text.match(/Compila[cç][aã]o\s*([0-9]+)/i) ||
    text.match(/Build\s*<[^>]*>\s*([0-9]+)/i) ||
    text.match(/Build\s*([0-9]+)/i);

  return {
    version: versionMatch ? versionMatch[1] : null,
    build: buildMatch ? buildMatch[1] : null
  };
}

async function fetchIndexEntries() {
  const res = await axios.get(INDEX_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    },
    timeout: 20000
  });

  const html = String(res.data || '');
  const $ = cheerio.load(html);

  const entries = [];

  $('a').each((_, el) => {
    const text = normalize($(el).text());
    const href = $(el).attr('href');

    if (!text || !href) return;

    let absoluteUrl = href;
    if (href.startsWith('/')) {
      absoluteUrl = new URL(href, INDEX_URL).toString();
    }

    entries.push({
      title: text,
      url: absoluteUrl
    });
  });

  return entries;
}

async function resolveTargetUrl(entryUrl) {
  try {
    const res = await axios.get(entryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 20000
    });

    const html = String(res.data || '');
    const $ = cheerio.load(html);

    let tfUrl = null;

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('testflight.apple.com')) {
        tfUrl = href;
      }
    });

    return tfUrl || entryUrl;
  } catch (err) {
    console.error('Erro ao resolver link:', entryUrl, err.message);
    return entryUrl;
  }
}

function buildVersionSuffix(version, build) {
  if (version && build) return ` (v${version} build ${build})`;
  if (version) return ` (v${version})`;
  if (build) return ` (build ${build})`;
  return '';
}

async function checkIndex() {
  try {
    const entries = await fetchIndexEntries();

    for (const target of TARGETS) {
      const matched = entries.filter(e => matchesTarget(e.title, target));

      if (!matched.length) {
        state.status[target.key] = `${target.label}: não encontrado no índice`;
        state.notifiedOpen[target.key] = false;
        continue;
      }

      const entry = matched[0];
      const resolvedUrl = await resolveTargetUrl(entry.url);
      const previous = state.seenLinks[target.key];
      const previousNotified = state.notifiedLinks[target.key];

      state.seenLinks[target.key] = resolvedUrl;

      if (!previous || previous !== resolvedUrl) {
        state.status[target.key] = `${target.label}: novo link detectado no índice`;

        if (previousNotified !== resolvedUrl) {
          await sendMessage(
            OWNER_CHAT_ID,
            `🚨 NOVO LINK DETECTADO NO WABETAINFO INDEX!\n` +
              `📱 ${target.label}\n` +
              `🔗 ${resolvedUrl}`
          );
          state.notifiedLinks[target.key] = resolvedUrl;
        }
      } else {
        state.status[target.key] = `${target.label}: mesmo link no índice`;
      }

      try {
        const tfRes = await axios.get(resolvedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 20000
        });

        const tfHtml = String(tfRes.data || '');
        const { isFull, isAvailable } = detectTestFlightAvailability(tfHtml);
        const { version, build } = extractVersionInfo(tfHtml);
        const versionSuffix = buildVersionSuffix(version, build);

        if (!isFull && isAvailable) {
          state.status[target.key] = `${target.label}: vaga aberta${versionSuffix}`;

          const openKey = `${resolvedUrl}|${version || ''}|${build || ''}`;
          if (state.notifiedOpen[target.key] !== openKey) {
            const versionLine = version ? `🧪 Versão: ${version}\n` : '';
            const buildLine = build ? `🏗️ Build: ${build}\n` : '';

            await sendMessage(
              OWNER_CHAT_ID,
              `🔥 VAGA ABERTA!\n` +
                `📱 ${target.label}\n` +
                versionLine +
                buildLine +
                `🔗 ${resolvedUrl}`
            );

            state.notifiedOpen[target.key] = openKey;
          }
        } else {
          state.status[target.key] = `${target.label}: link encontrado, mas ainda cheio${versionSuffix}`;
          state.notifiedOpen[target.key] = false;
        }
      } catch (err) {
        state.status[target.key] = `${target.label}: erro ao validar TestFlight`;
        state.notifiedOpen[target.key] = false;
      }
    }

    saveState(state);
  } catch (err) {
    console.error('Erro ao verificar índice:', err.response?.data || err.message);
  }
}

function buildStatusText() {
  const lines = ['📡 Status do monitoramento:\n'];

  for (const target of TARGETS) {
    lines.push(`• ${state.status[target.key] || `${target.label}: sem status`}`);
  }

  return lines.join('\n');
}

function buildLinksText() {
  const lines = ['🔗 Links atuais vistos no índice:\n'];

  for (const target of TARGETS) {
    const link = state.seenLinks[target.key] || 'nenhum';
    lines.push(`• ${target.label}\n${link}`);
  }

  return lines.join('\n\n');
}

async function checkCommands() {
  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}`,
      { timeout: 15000 }
    );

    const updates = res.data?.result || [];

    for (const update of updates) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg?.text) continue;

      const text = msg.text.trim().toLowerCase();
      const chatId = msg.chat.id;

      let response = '';

      if (text === '/start') {
        response =
          `🚀 Bot ativado!\n\n` +
          `Eu monitoro apenas o índice TestFlight do WABetaInfo.\n` +
          `Filtro só WhatsApp Beta e Instagram Beta quando estiverem no índice.\n\n` +
          `Comandos:\n` +
          `/status - ver status\n` +
          `/links - ver links atuais\n` +
          `/ajuda - como funciona`;
      } else if (text === '/status') {
        response = buildStatusText();
      } else if (text === '/links') {
        response = buildLinksText();
      } else if (text === '/ajuda') {
        response =
          `❓ Como funciona:\n` +
          `- Leio o índice do WABetaInfo\n` +
          `- Filtro só WhatsApp Beta e Instagram Beta\n` +
          `- Se surgir link novo, te aviso\n` +
          `- Depois valido o TestFlight\n` +
          `- Quando possível, mostro versão e build na notificação`;
      }

      if (response) {
        await sendMessage(chatId, response);
      }
    }
  } catch (err) {
    console.error('Erro comandos:', err.response?.data || err.message);
  }
}

console.log('Bot monitorando o WABetaInfo TestFlight Index...');
checkIndex();
checkCommands();

setInterval(checkIndex, 60 * 1000);
setInterval(checkCommands, 3000);
