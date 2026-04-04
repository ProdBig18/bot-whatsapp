const axios = require('axios');

const TESTFLIGHT_URL = 'https://testflight.apple.com/join/oscYikr0';
const TOKEN = 'SEU_TOKEN_AQUI';
const CHAT_ID = 'SEU_CHAT_ID_AQUI';

let notified = false;

async function sendTelegramMessage(text) {
  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text
      }
    );
    console.log('Mensagem enviada no Telegram.');
    return res.data;
  } catch (err) {
    console.error(
      'Erro ao enviar para Telegram:',
      err.response?.data || err.message
    );
  }
}

async function checkTestFlight() {
  try {
    const res = await axios.get(TESTFLIGHT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const html = String(res.data || '').toLowerCase();

    const isFull =
      html.includes('this beta is full') ||
      html.includes('isn’t accepting any new testers right now') ||
      html.includes("isn't accepting any new testers right now");

    const isAvailable =
      html.includes('open in testflight') ||
      html.includes('start testing') ||
      html.includes('accept');

    if (!isFull && isAvailable) {
      if (!notified) {
        notified = true;
        console.log('VAGA ABERTA!');
        await sendTelegramMessage(
          '🔥 Vaga do WhatsApp Beta abriu! Corre: ' + TESTFLIGHT_URL
        );
      } else {
        console.log('Vaga continua aberta. Aviso já enviado.');
      }
    } else {
      notified = false;
      console.log('Ainda cheio...');
    }
  } catch (err) {
    console.error('Erro ao verificar TestFlight:', err.message);
  }
}

console.log('Bot rodando...');
checkTestFlight();
setInterval(checkTestFlight, 30000);