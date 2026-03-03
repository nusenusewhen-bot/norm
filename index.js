import { config } from 'dotenv';
config();

import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  REST,
  Routes
} from 'discord.js';

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = '1459833646130401429';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID');
  process.exit(1);
}

let currentInvite = 'https://discord.gg/your-link-here';
const whitelisted = new Set([OWNER_ID]);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

const commands = [
  new SlashCommandBuilder().setName('n-raid').setDescription('Flood reply').addStringOption(o => o.setName('msg').setDescription('Optional custom').setRequired(false)),
  new SlashCommandBuilder().setName('g-raid').setDescription('Flood gif').addStringOption(o => o.setName('gif').setDescription('Gif url').setRequired(true)),
  new SlashCommandBuilder().setName('l-raid').setDescription('Flood link').addStringOption(o => o.setName('link').setDescription('Url').setRequired(true)),
  new SlashCommandBuilder().setName('p-raid').setDescription('Flood invite'),
  new SlashCommandBuilder().setName('invote').setDescription('Set invite').addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist').addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Bot invite'),
  new SlashCommandBuilder().setName('bot').setDescription('Public add')
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`[Zlalux] ${client.user.tag} ready`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands registered');
  } catch (e) {
    console.error('Deploy error:', e);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  await i.deferReply().catch(() => {});

  let channel = i.channel;
  if (!channel && i.channelId && i.guild) {
    channel = i.guild.channels.cache.get(i.channelId);
  }

  let content = currentInvite;
  if (cmd === 'n-raid') {
    const m = i.options.getString('msg');
    if (m) content = m;
  } else if (cmd === 'g-raid') {
    content = i.options.getString('gif') || currentInvite;
  } else if (cmd === 'l-raid') {
    content = i.options.getString('link') || currentInvite;
  }

  const isWl = whitelisted.has(i.user.id);
  const count = isWl ? 30 : 5;

  console.log(`${i.user.tag} ${cmd} ${count}x channel: ${channel ? channel.name : 'NULL'}`);

  if (!channel) {
    console.log('Channel null - trying DM fallback');
    await i.user.send(content).catch(e => console.log('DM fail:', e.message));
    await i.editReply({ content: 'No channel access - sent to your DMs' }).catch(() => {});
    await i.deleteReply().catch(() => {});
    return;
  }

  let first = null;

  for (let k = 0; k < count; k++) {
    try {
      const opts = {
        content,
        reply: { messageReference: first ? first.id : i.id, failIfNotExists: false }
      };

      const sent = await channel.send(opts);

      if (k === 0) {
        first = sent;
        setTimeout(() => sent.delete().catch(() => {}), 2000);
      }

      await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));
    } catch (e) {
      console.log(`Loop ${k+1} fail: ${e.message}`);
      await i.editReply({ content: `Failed: ${e.message}` }).catch(() => {});
      break;
    }
  }

  await i.deleteReply().catch(() => {});
});

client.login(TOKEN);
