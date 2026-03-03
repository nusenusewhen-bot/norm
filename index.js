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
  Routes,
  PermissionsBitField
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
  new SlashCommandBuilder().setName('n-raid').setDescription('Flood invite 10/100×'),
  new SlashCommandBuilder().setName('g-raid').setDescription('Flood invite 10/100×'),
  new SlashCommandBuilder().setName('l-raid').setDescription('Flood invite 10/100×'),
  new SlashCommandBuilder().setName('p-raid').setDescription('Flood invite 10/100×'),
  new SlashCommandBuilder().setName('invote').setDescription('Set invite link').addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist user (owner)').addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Bot invite'),
  new SlashCommandBuilder().setName('bot').setDescription('Publicly share add-bot embed')
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`[Zlalux] ${client.user.tag} online - whitelisted: ${whitelisted.size}`);

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
      console.log(`${i.user.tag} used ${cmd} (${count}x) whitelisted: ${isWhitelisted}`);

      let channel = i.channel || (i.guild && i.channelId ? i.guild.channels.cache.get(i.channelId) : null);

      if (!channel) {
        await i.reply({ content: 'No channel found', ephemeral: true });
        break;
      }

      const perms = channel.permissionsFor(client.user);
      if (!perms?.has(PermissionsBitField.Flags.SendMessages)) {
        await i.reply({ content: 'Bot missing Send Messages perm here', ephemeral: true });
        try { await i.user.send(currentInvite); } catch {}
        break;
      }

      for (let k = 0; k < count; k++) {
        try {
          await channel.send(currentInvite);
          await new Promise(r => setTimeout(r, 400));
        } catch (e) {
          console.log(`Stopped at ${k+1}: ${e.message}`);
          break;
        }
      }
      break;
    }

    case 'invote': {
      const link = i.options.getString('link');
      if (link && (link.includes('discord.gg/') || link.includes('discord.com/invite/'))) {
        currentInvite = link;
        await i.reply({ content: `Invite set: ${link}`, ephemeral: true });
      } else {
        await i.reply({ content: 'Invalid invite', ephemeral: true });
      }
      break;
    }

    case 'whitelist': {
      if (i.user.id !== OWNER_ID) return i.reply({ content: 'Owner only', ephemeral: true });
      const user = i.options.getUser('user');
      if (user) {
        whitelisted.add(user.id);
        await i.reply({ content: `Whitelisted ${user.tag}`, ephemeral: true });
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
        .setDescription('Click below to add Zlalux to any server you want')
        .setColor(0x5865F2)
        .setFooter({ text: 'Public add link — share freely' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Add Zlalux Now')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );
      await i.reply({ embeds: [embed], components: [row] });  // ← this is public, not ephemeral
      break;
    }
  }
});

client.login(TOKEN);
