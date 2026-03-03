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
const OWNER_ID = '1459833646130401429'; // your ID here

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
  new SlashCommandBuilder().setName('n-raid').setDescription('Send invite 10/100×').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('g-raid').setDescription('Send invite 10/100×').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('l-raid').setDescription('Send invite 10/100×').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('p-raid').setDescription('Send invite 10/100×').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('invote').setDescription('Set your invite link').addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist user (owner only)').addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Get bot invite'),
  new SlashCommandBuilder().setName('bot').setDescription('Add to applications')
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`[Zlalux] ${client.user.tag} online - whitelisted: ${whitelisted.size}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands deployed globally');
  } catch (e) {
    console.error('Command deploy failed:', e);
  }
});

// Bot sees every message
client.on('messageCreate', message => {
  if (message.author.bot) return;
  console.log(`[MSG] ${message.author.tag} (${message.author.id}) in ${message.guild?.name || 'DM'} #${message.channel.name || 'unknown'}: ${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}`);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  switch (cmd) {
    case 'n-raid':
    case 'g-raid':
    case 'l-raid':
    case 'p-raid': {
      const isWhitelisted = whitelisted.has(i.user.id);
      const count = isWhitelisted ? 100 : 10;
      console.log(`${i.user.tag} (${i.user.id}) used ${cmd} (${count}x) - whitelisted: ${isWhitelisted}`);

      let channel = i.channel;
      if (!channel && i.guild && i.channelId) {
        channel = i.guild.channels.cache.get(i.channelId);
      }

      if (!channel) {
        console.log(`No channel for ${i.id} - user: ${i.user.tag}`);
        try { await i.reply({ content: 'Cannot send here (no channel access)', ephemeral: true }); } catch {}
        break;
      }

      for (let k = 0; k < count; k++) {
        try {
          await channel.send(currentInvite);
          await new Promise(r => setTimeout(r, 400));
        } catch (e) {
          console.log(`Stopped at ${k+1}/${count}: ${e.message}`);
          break;
        }
      }
      break;
    }

    case 'invote': {
      const link = i.options.getString('link');
      if (link && (link.includes('discord.gg/') || link.includes('discord.com/invite/'))) {
        currentInvite = link;
        await i.reply({ content: `Invite updated: ${link}`, ephemeral: true });
      } else {
        await i.reply({ content: 'Invalid link - must be discord.gg/... or discord.com/invite/...', ephemeral: true });
      }
      break;
    }

    case 'whitelist': {
      if (i.user.id !== OWNER_ID) {
        return i.reply({ content: 'Only owner can whitelist users', ephemeral: true });
      }
      const user = i.options.getUser('user');
      if (user) {
        whitelisted.add(user.id);
        await i.reply({ content: `Whitelisted ${user.tag} (${user.id})`, ephemeral: true });
        console.log(`Added to whitelist: ${user.tag} (${user.id})`);
      }
      break;
    }

    case 'oauth2': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      await i.reply({ content: url, ephemeral: true });
      break;
    }

    case 'bot': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      const embed = new EmbedBuilder()
        .setTitle('Zlalux Raid Bot')
        .setDescription('Click to add Zlalux to your applications')
        .setColor(0x5865F2);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Add to Applications')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );
      await i.reply({ embeds: [embed], components: [row] });
      break;
    }
  }
});

client.login(TOKEN);
