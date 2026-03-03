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
  new SlashCommandBuilder().setName('n-raid').setDescription('Reply flood invite/custom 10/100×').addStringOption(o => o.setName('message').setDescription('Custom text optional').setRequired(false)),
  new SlashCommandBuilder().setName('g-raid').setDescription('Reply flood gif 10/100×').addStringOption(o => o.setName('gif').setDescription('Gif url').setRequired(true)),
  new SlashCommandBuilder().setName('l-raid').setDescription('Reply flood link 10/100×').addStringOption(o => o.setName('link').setDescription('Url').setRequired(true)),
  new SlashCommandBuilder().setName('p-raid').setDescription('Reply flood invite 10/100×'),
  new SlashCommandBuilder().setName('invote').setDescription('Set invite').addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist (owner)').addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Bot invite'),
  new SlashCommandBuilder().setName('bot').setDescription('Public add embed')
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`[Zlalux] ${client.user.tag} online`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands deployed');
  } catch (e) {
    console.error('Deploy failed:', e);
  }
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  console.log(`[MSG] ${message.author.tag}: ${message.content.slice(0, 100)}`);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  let contentToSend = currentInvite;

  if (cmd === 'n-raid') {
    const custom = i.options.getString('message');
    if (custom) contentToSend = custom;
  } else if (cmd === 'g-raid') {
    contentToSend = i.options.getString('gif') || currentInvite;
  } else if (cmd === 'l-raid') {
    contentToSend = i.options.getString('link') || currentInvite;
  } // p-raid uses invite

  const isWhitelisted = whitelisted.has(i.user.id);
  const count = isWhitelisted ? 100 : 10;
  console.log(`${i.user.tag} ${cmd} (${count}x)`);

  let firstReply = null;

  for (let k = 0; k < count; k++) {
    try {
      const replyOptions = {
        content: contentToSend,
        reply: { messageReference: firstReply ? firstReply.id : i.id, failIfNotExists: false }
      };

      const msg = await i.channel.send(replyOptions);

      if (k === 0) {
        firstReply = msg;
        setTimeout(() => msg.delete().catch(() => {}), 1500); // delete first after 1.5s
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 300)); // jitter
    } catch (e) {
      console.log(`Stopped at ${k+1}: ${e.message}`);
      break;
    }
  }
});

client.login(TOKEN);
