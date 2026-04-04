const axios = require('axios');

const TOKEN = '8287060645:AAEZItCeLCCw9aAivwy9_JuyAhj1FSupWiM';
const CHAT_ID = '8151289296';
const TESTFLIGHT_URL = 'https://testflight.apple.com/join/oscYikr0';

let notified = false;
let lastUpdateId = 0;

async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (err) {
    console.error('Erro Telegram:', err.response?.data || err.message);
  }
}

async function checkTestFlight() {
  try {
    const res = await axios.get(TESTFLIGHT_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const html = String(res.data || '').toLowerCase();

    const isFull =
      html.includes('this beta is full') ||
      html.includes("isn't accepting any new testers right now") ||
      html.includes('isn’t accepting any new testers right now');

    let appName = 'Desconhecido';

    if (html.includes('whatsapp messenger')) {
      appName = 'WhatsApp NORMAL';
    } else if (html.includes('whatsapp business')) {
      appName = 'WhatsApp BUSINESS';
    }

    if (appName === 'WhatsApp BUSINESS') {
      console.log('Link atual aponta para WhatsApp Business. Alerta ignorado.');
      return;
    }

    const isAvailable =
      html.includes('open in testflight') ||
      html.includes('start testing') ||
      html.includes('accept');

    if (!isFull && isAvailable) {
      if (!notified) {
        notified = true;
        console.log(`VAGA ABERTA! App: ${appName}`);
        await sendMessage(
          CHAT_ID,
          `🔥 VAGA ABERTA!\n📱 App: ${appName}\n🔗 ${TESTFLIGHT_URL}`
        );
      } else {
        console.log('Vaga continua aberta. Aviso já enviado.');
      }
    } else {
      notified = false;
      console.log(`Ainda cheio... App detectado: ${appName}`);
    }
  } catch (err) {
    console.error('Erro TestFlight:', err.response?.data || err.message);
  }
}

async function checkCommands() {
  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
    );

    const updates = res.data?.result || [];

    for (const update of updates) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg || !msg.text) continue;

      const text = msg.text.trim().toLowerCase();
      const chatId = msg.chat.id;

      let response = '';

      if (text === '/start') {
        response =
          '🚀 Bot ativado!\n\n' +
          'Eu monitoro vagas do TestFlight e te aviso quando abrir.\n\n' +
          'Comandos disponíveis:\n' +
          '/status - ver status\n' +
          '/link - ver link monitorado\n' +
          '/ajuda - como funciona';
      } else if (text === '/status') {
        response = '📡 Monitoramento ativo 24/7.';
      } else if (text === '/link') {
        response = `🔗 Link monitorado:\n${TESTFLIGHT_URL}`;
      } else if (text === '/ajuda') {
        response =
          '❓ Como funciona:\n' +
          '- Eu verifico periodicamente a página do TestFlight\n' +
          '- Se detectar vaga aberta, envio alerta no Telegram\n' +
          '- Se o link apontar para WhatsApp Business, eu ignoro';
      }

      if (response) {
        await sendMessage(chatId, response);
      }
    }
  } catch (err) {
    console.error('Erro comandos:', err.response?.data || err.message);
  }
}

console.log('Bot rodando...');
checkTestFlight();
checkCommands();

setInterval(checkTestFlight, 30000);
setInterval(checkCommands, 3000);
