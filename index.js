const axios = require('axios');

const TOKEN = '8287060645:AAEZItCeLCCw9aAivwy9_JuyAhj1FSupWiM';
const CHAT_ID = '8151289296';
const TESTFLIGHT_URL = 'https://testflight.apple.com/join/oscYikr0';

let notified = false;
let lastUpdateId = 0;

// 🔔 Enviar mensagem
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

// 📡 Monitorar vaga
async function checkTestFlight() {
  try {
    const res = await axios.get(TESTFLIGHT_URL);
    const html = String(res.data).toLowerCase();

    const isFull =
      html.includes('this beta is full') ||
      html.includes("isn't accepting any new testers");

    if (!isFull && !notified) {
      notified = true;
      console.log('🔥 VAGA ABERTA!');
      await sendMessage(CHAT_ID, '🔥 Vaga aberta! Corre: ' + TESTFLIGHT_URL);
    }

    if (isFull) {
      notified = false;
      console.log('Ainda cheio...');
    }

  } catch (err) {
    console.error('Erro TestFlight:', err.message);
  }
}

// 🤖 Comandos do Telegram
async function checkCommands() {
  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
    );

    for (const update of res.data.result) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg) continue;

      const text = msg.text;
      const chatId = msg.chat.id;

      let resposta = '';

      if (text === '/start') {
        resposta =
          '🚀 Bot ativado!\nVou te avisar quando abrir vaga no WhatsApp Beta.';
      }

      if (text === '/status') {
        resposta = '📡 Monitoramento ativo 24/7.';
      }

      if (text === '/link') {
        resposta = '🔗 ' + TESTFLIGHT_URL;
      }

      if (text === '/ajuda') {
        resposta =
          '❓ Eu monitoro o TestFlight automaticamente e te aviso quando abrir vaga.';
      }

      if (resposta) {
        await sendMessage(chatId, resposta);
      }
    }

  } catch (err) {
    console.error('Erro comandos:', err.message);
  }
}

// 🚀 Inicialização
console.log('Bot rodando...');

// loops
setInterval(checkTestFlight, 30000);
setInterval(checkCommands, 3000);