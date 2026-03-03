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
  console.error('Missing TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

let currentInvite = 'https://discord.gg/your-default-link-here';
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
  new SlashCommandBuilder()
    .setName('n-raid')
    .setDescription('Reply flood custom or invite')
    .addStringOption(o => o.setName('msg').setDescription('Custom message (optional)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('g-raid')
    .setDescription('Reply flood gif')
    .addStringOption(o => o.setName('gif').setDescription('Gif URL').setRequired(true)),
  new SlashCommandBuilder()
    .setName('l-raid')
    .setDescription('Reply flood link')
    .addStringOption(o => o.setName('link').setDescription('Any URL').setRequired(true)),
  new SlashCommandBuilder()
    .setName('p-raid')
    .setDescription('Reply flood invite'),
  new SlashCommandBuilder()
    .setName('invote')
    .setDescription('Set invite link')
    .addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Whitelist user (owner only)')
    .addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Bot invite link'),
  new SlashCommandBuilder().setName('bot').setDescription('Public add-bot embed')
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`[Zlalux] ${client.user.tag} ready`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered');
  } catch (e) {
    console.error('Command registration failed:', e);
  }
});

client.on('messageCreate', msg => {
  if (msg.author.bot) return;
  console.log(`[MSG] ${msg.author.tag} (${msg.author.id}): ${msg.content.slice(0, 100)}`);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  // Defer instantly to prevent "Application did not respond"
  await i.deferReply({ ephemeral: true }).catch(() => console.log('Defer failed'));

  let content = currentInvite;

  if (cmd === 'n-raid') {
    const custom = i.options.getString('msg');
    if (custom) content = custom;
  } else if (cmd === 'g-raid') {
    content = i.options.getString('gif') || currentInvite;
  } else if (cmd === 'l-raid') {
    content = i.options.getString('link') || currentInvite;
  }

  const isWl = whitelisted.has(i.user.id);
  const count = isWl ? 30 : 5; // start low to survive

  console.log(`${i.user.tag} ran ${cmd} (${count}x) wl:${isWl} | channel:${i.channel?.name || 'null'}`);

  let firstReply = null;

  for (let k = 0; k < count; k++) {
    try {
      const opts = {
        content,
        reply: { messageReference: firstReply ? firstReply.id : i.id, failIfNotExists: false }
      };

      const sent = await i.channel.send(opts);

      if (k === 0) {
        firstReply = sent;
        setTimeout(() => sent.delete().catch(e => console.log('First delete failed:', e.message)), 2000);
      }

      await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
    } catch (e) {
      console.error(`Loop ${k+1}/${count} failed: ${e.message} (code ${e.code || '?'})`);
      break;
    }
  }

  
  await i.deleteReply().catch(() => {});
});

client.login(TOKEN);
