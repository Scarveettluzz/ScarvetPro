const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const Pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const moment = require('moment-timezone');
require('dotenv').config();

// ==================== KONFIGURASI ====================
const config = {
  owner: process.env.OWNER || '6288994421519',
  botName: process.env.BOT_NAME || 'ScarvetFx',
  prefix: process.env.PREFIX || '.'
};

const logger = Pino({ level: 'info' });
const commands = new Map();
fs.ensureDirSync('./tmp');
fs.ensureDirSync('./sessions');

// ==================== DOWNLOADER ====================
async function downloadMedia(url, type) {
  try {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info, { 
      quality: type === 'audio' ? 'highestaudio' : 'highestvideo' 
    });
    return {
      title: info.videoDetails.title,
      download: format.url,
      author: info.videoDetails.author.name
    };
  } catch (e) {
    throw new Error('Gagal download: ' + e.message);
  }
}

// ==================== COMMANDS ====================

// ----- PING -----
commands.set('ping', {
  async execute(sock, args, { from }) {
    const start = Date.now();
    await sock.sendMessage(from, { text: '🏓 Ping...' });
    await sock.sendMessage(from, { text: `✅ Pong! ${Date.now() - start}ms` });
  }
});

// ----- MENU -----
commands.set('menu', {
  async execute(sock, args, { from, cfg }) {
    const menu = `
🤖 *${cfg.botName}*
📌 Prefix: ${cfg.prefix}

📁 *GENERAL*
${cfg.prefix}ping - Cek bot
${cfg.prefix}info - Info bot
${cfg.prefix}menu - Menu ini

⬇️ *DOWNLOADER*
${cfg.prefix}ytmp3 <url> - Audio YouTube
${cfg.prefix}ytmp4 <url> - Video YouTube
${cfg.prefix}tiktok <url> - TikTok (via API)
${cfg.prefix}ig <url> - Instagram
${cfg.prefix}fb <url> - Facebook

🎨 *FUN*
${cfg.prefix}sticker - Buat stiker (kirim gambar/video)
${cfg.prefix}meme - Meme random

👥 *GROUP*
${cfg.prefix}kick @tag - Kick member
${cfg.prefix}promote @tag - Naikkan admin
${cfg.prefix}demote @tag - Turunkan admin
${cfg.prefix}tagall - Tag semua

👑 *OWNER*
${cfg.prefix}bc <pesan> - Broadcast
${cfg.prefix}restart - Restart bot
${cfg.prefix}eval <code> - Jalankan kode
    `;
    await sock.sendMessage(from, { text: menu });
  }
});

// ----- INFO -----
commands.set('info', {
  async execute(sock, args, { from }) {
    const os = require('os');
    await sock.sendMessage(from, { text: `
🤖 *${config.botName}*
📌 Versi: 3.0.0
👤 Owner: ${config.owner}
⚡ Status: Aktif
💻 OS: ${os.platform()}
📅 Waktu: ${moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss')}
    ` });
  }
});

// ----- YTMP3 -----
commands.set('ytmp3', {
  async execute(sock, args, { from }) {
    const url = args[0];
    if (!url || !ytdl.validateURL(url)) {
      return sock.sendMessage(from, { text: '❌ Masukkan URL YouTube valid!' });
    }
    try {
      await sock.sendMessage(from, { text: '⏳ Download audio...' });
      const result = await downloadMedia(url, 'audio');
      const response = await axios({ method: 'get', url: result.download, responseType: 'stream' });
      const tempPath = './tmp/audio.mp3';
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      await sock.sendMessage(from, { 
        audio: fs.readFileSync(tempPath), 
        mimetype: 'audio/mpeg',
        fileName: `${result.title}.mp3`
      });
      fs.unlinkSync(tempPath);
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ ${err.message}` });
    }
  }
});

// ----- YTMP4 -----
commands.set('ytmp4', {
  async execute(sock, args, { from }) {
    const url = args[0];
    if (!url || !ytdl.validateURL(url)) {
      return sock.sendMessage(from, { text: '❌ Masukkan URL YouTube valid!' });
    }
    try {
      await sock.sendMessage(from, { text: '⏳ Download video...' });
      const result = await downloadMedia(url, 'video');
      const response = await axios({ method: 'get', url: result.download, responseType: 'stream' });
      const tempPath = './tmp/video.mp4';
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      await sock.sendMessage(from, { 
        video: fs.readFileSync(tempPath),
        caption: `📥 ${result.title}`,
        mimetype: 'video/mp4'
      });
      fs.unlinkSync(tempPath);
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ ${err.message}` });
    }
  }
});

// ----- TIKTOK (via API) -----
commands.set('tiktok', {
  async execute(sock, args, { from }) {
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❌ Masukkan URL TikTok!' });
    try {
      await sock.sendMessage(from, { text: '⏳ Mendownload TikTok...' });
      const { data } = await axios.get('https://api.agatz.xyz/api/tiktok', { params: { url } });
      const mediaUrl = data.video_url || data.video;
      if (!mediaUrl) throw new Error('Video tidak ditemukan');
      
      const response = await axios({ method: 'get', url: mediaUrl, responseType: 'stream' });
      const tempPath = './tmp/tiktok.mp4';
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      await sock.sendMessage(from, { video: fs.readFileSync(tempPath), caption: `📥 TikTok` });
      fs.unlinkSync(tempPath);
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ ${err.message}` });
    }
  }
});

// ----- STICKER -----
commands.set('sticker', {
  async execute(sock, args, { from, m }) {
    if (!m.message.imageMessage && !m.message.videoMessage) {
      return sock.sendMessage(from, { text: '❌ Kirim gambar/video dengan caption .sticker' });
    }
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const sharp = require('sharp');
      const media = await downloadMediaMessage(m, 'buffer');
      const tempPath = './tmp/sticker.webp';
      await sharp(media).resize(512, 512).webp().toFile(tempPath);
      await sock.sendMessage(from, { sticker: fs.readFileSync(tempPath) });
      fs.unlinkSync(tempPath);
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Gagal: ${err.message}` });
    }
  }
});

// ----- MEME -----
commands.set('meme', {
  async execute(sock, args, { from }) {
    try {
      const { data } = await axios.get('https://meme-api.com/gimme');
      await sock.sendMessage(from, {
        image: { url: data.url },
        caption: `🤣 ${data.title}\n⬆️ ${data.ups}`
      });
    } catch {
      await sock.sendMessage(from, { text: '❌ Gagal ambil meme' });
    }
  }
});

// ----- KICK -----
commands.set('kick', {
  async execute(sock, args, { from, isGroup, m }) {
    if (!isGroup) return sock.sendMessage(from, { text: '❌ Hanya di grup!' });
    const metadata = await sock.groupMetadata(from);
    const isAdmin = metadata.participants.find(p => p.id === (m.key.participant || from))?.admin === 'admin';
    if (!isAdmin) return sock.sendMessage(from, { text: '❌ Anda bukan admin!' });
    const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mention.length) return sock.sendMessage(from, { text: '❌ Tag member!' });
    await sock.groupParticipantsUpdate(from, mention, 'remove');
    await sock.sendMessage(from, { text: '✅ Berhasil dikick!' });
  }
});

// ----- TAGALL -----
commands.set('tagall', {
  async execute(sock, args, { from, isGroup }) {
    if (!isGroup) return sock.sendMessage(from, { text: '❌ Hanya di grup!' });
    const metadata = await sock.groupMetadata(from);
    const mentions = metadata.participants.map(p => p.id);
    const text = `📢 *Tag All*\n${args.join(' ') || 'Halo semua!'}`;
    await sock.sendMessage(from, { text, mentions });
  }
});

// ----- BROADCAST -----
commands.set('bc', {
  ownerOnly: true,
  async execute(sock, args, { from }) {
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❌ Masukkan pesan!' });
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.keys(groups);
    let sent = 0;
    for (const g of list) {
      try {
        await sock.sendMessage(g, { text: `📢 *Broadcast*\n\n${text}` });
        sent++;
      } catch (e) {}
    }
    await sock.sendMessage(from, { text: `✅ Broadcast ke ${sent} dari ${list.length} grup` });
  }
});

// ----- RESTART -----
commands.set('restart', {
  ownerOnly: true,
  async execute(sock, args, { from }) {
    await sock.sendMessage(from, { text: '🔄 Restarting...' });
    process.exit(0);
  }
});

// ----- EVAL -----
commands.set('eval', {
  ownerOnly: true,
  async execute(sock, args, { from }) {
    const code = args.join(' ');
    if (!code) return sock.sendMessage(from, { text: '❌ Masukkan kode!' });
    try {
      const result = eval(code);
      await sock.sendMessage(from, { text: `✅ Hasil:\n${JSON.stringify(result, null, 2)}` });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
    }
  }
});

// ==================== BOT START ====================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');
  
  const sock = makeWASocket({
    auth: state,
    logger: logger,
    printQRInTerminal: true,
    browser: ['ZmZBot', 'Chrome', '120.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(startBot, 5000);
    } else if (connection === 'open') {
      logger.info(`✅ ${config.botName} AKTIF!`);
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const m = msg.messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const isGroup = from.endsWith('@g.us');
    const isOwner = sender === config.owner + '@s.whatsapp.net';

    let body = '';
    if (m.message.conversation) body = m.message.conversation;
    else if (m.message.extendedTextMessage) body = m.message.extendedTextMessage.text;
    else if (m.message.imageMessage) body = m.message.imageMessage.caption;
    else if (m.message.videoMessage) body = m.message.videoMessage.caption;
    else return;

    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const cmd = commands.get(command);
    if (!cmd) return;

    if (cmd.ownerOnly && !isOwner) {
      return sock.sendMessage(from, { text: '❌ Khusus Owner!' });
    }

    try {
      await cmd.execute(sock, args, { from, sender, isGroup, isOwner, m, cfg: config });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
    }
  });
}

startBot().catch(err => logger.error(err));
