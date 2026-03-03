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

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const SPAM_COUNT = 100;
const SPAM_DELAY_MS = 350;

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
    .setDescription('Spam text message')
    .addStringOption(o => o.setName('message').setDescription('The text').setRequired(true)),

  new SlashCommandBuilder()
    .setName('g-raid')
    .setDescription('Spam gif/image link')
    .addStringOption(o => o.setName('gif').setDescription('Gif url').setRequired(true)),

  new SlashCommandBuilder()
    .setName('l-raid')
    .setDescription('Spam any link')
    .addStringOption(o => o.setName('link').setDescription('Url').setRequired(true)),

  new SlashCommandBuilder()
    .setName('p-raid')
    .setDescription('Mass ping online members')
    .addStringOption(o => o.setName('message').setDescription('Text after pings').setRequired(false)),

  new SlashCommandBuilder()
    .setName('oauth2')
    .setDescription('Get bot invite link'),

  new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Add Zlalux to your applications')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`[Zlalux] ${client.user.tag} online`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands registered globally');
  } catch (err) {
    console.error('Deploy failed:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  const hide = async () => {
    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.deleteReply();
    } catch {}
  };

  if (['n-raid', 'g-raid', 'l-raid', 'p-raid'].includes(cmd)) await hide();

  switch (cmd) {
    case 'n-raid': {
      const text = interaction.options.getString('message');
      for (let i = 0; i < SPAM_COUNT; i++) {
        try {
          await interaction.channel.send(text);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS));
        } catch { break; }
      }
      break;
    }

    case 'g-raid':
    case 'l-raid': {
      const content = interaction.options.getString(cmd === 'g-raid' ? 'gif' : 'link');
      for (let i = 0; i < SPAM_COUNT; i++) {
        try {
          await interaction.channel.send(content);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS));
        } catch { break; }
      }
      break;
    }

    case 'p-raid': {
      const msg = interaction.options.getString('message') || 'get pinged';
      const online = interaction.guild.members.cache.filter(m =>
        m.presence?.status !== 'offline' && !m.user.bot
      );

      if (online.size === 0) {
        await interaction.followup({ content: 'No online members', ephemeral: true });
        return;
      }

      const members = [...online.values()];
      for (let i = 0; i < SPAM_COUNT; i++) {
        const chunk = members.slice(i * 20, (i + 1) * 20);
        if (chunk.length === 0) break;
        const pings = chunk.map(m => m.toString()).join(' ');
        try {
          await interaction.channel.send(`${pings} ${msg}`);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS * 1.5));
        } catch { break; }
      }
      break;
    }

    case 'oauth2': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      await interaction.reply({ content: url, ephemeral: true });
      break;
    }

    case 'bot': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      const embed = new EmbedBuilder()
        .setTitle('Zlalux Raid Bot')
        .setDescription('Click below to add Zlalux to your applications')
        .setColor(0x5865F2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Add to Applications')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      break;
    }
  }
});

client.login(TOKEN);
