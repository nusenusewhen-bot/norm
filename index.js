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
  User
} from 'discord.js';

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = '1459833646130401429'; // change to your Discord ID

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

let currentInvite = "https://discord.gg/your-default-link-here";
const whitelisted = new Set([OWNER_ID]); // starts with owner

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
  new SlashCommandBuilder().setName('n-raid').setDescription('Send invite 10/100x').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('g-raid').setDescription('Send invite 10/100x').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('l-raid').setDescription('Send invite 10/100x').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('p-raid').setDescription('Send invite 10/100x').addStringOption(o => o.setName('dummy').setDescription('Ignored').setRequired(false)),
  new SlashCommandBuilder().setName('invote').setDescription('Set server invite').addStringOption(o => o.setName('link').setDescription('discord.gg/...').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist').setDescription('Add user to whitelist (owner only)').addUserOption(o => o.setName('user').setDescription('@user').setRequired(true)),
  new SlashCommandBuilder().setName('oauth2').setDescription('Bot invite'),
  new SlashCommandBuilder().setName('bot').setDescription('Add to applications')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`[Zlalux] ${client.user.tag} online - whitelisted: ${whitelisted.size}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands deployed');
  } catch (e) {
    console.error('Deploy failed:', e);
  }
});

// Bot now sees all messages (logs to console)
client.on('messageCreate', message => {
  if (message.author.bot) return;
  console.log(`[MSG] ${message.author.tag} in ${message.guild?.name || 'DM'}: ${message.content}`);
  // You can add more logic here later if you want the bot to react to normal messages
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  // No more auto-delete of YOUR message — it stays visible

  switch (cmd) {
    case 'n-raid':
    case 'g-raid':
    case 'l-raid':
    case 'p-raid': {
      const isWhitelisted = whitelisted.has(i.user.id);
      const count = isWhitelisted ? 100 : 10;
      console.log(`${i.user.tag} used ${cmd} (${count}x) - whitelisted: ${isWhitelisted}`);

      for (let k = 0; k < count; k++) {
        try {
          await i.channel.send(currentInvite);
          await new Promise(r => setTimeout(r, 400)); // slight delay to avoid instant ratelimit
        } catch (e) {
          console.log(`Spam stopped at ${k+1}:`, e.message);
          break;
        }
      }
      break;
    }

    case 'invote': {
      const newLink = i.options.getString('link');
      if (newLink.includes('discord.gg/') || newLink.includes('discord.com/invite/')) {
        currentInvite = newLink;
        await i.reply({ content: `Invite set to: ${newLink}`, ephemeral: true });
      } else {
        await i.reply({ content: 'Invalid invite (must be discord.gg/... or discord.com/invite/... )', ephemeral: true });
      }
      break;
    }

    case 'whitelist': {
      if (i.user.id !== OWNER_ID) {
        return i.reply({ content: 'Only owner can whitelist', ephemeral: true });
      }
      const user = i.options.getUser('user');
      if (user) {
        whitelisted.add(user.id);
        await i.reply({ content: `Added ${user.tag} (${user.id}) to whitelist`, ephemeral: true });
        console.log(`Whitelisted: ${user.tag}`);
      }
      break;
    }

    case 'oauth2': {
      const u = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      await i.reply({ content: u, ephemeral: true });
      break;
    }

    case 'bot': {
      const u = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      const e = new EmbedBuilder().setTitle('Zlalux Raid Bot').setDescription('Click to add Zlalux to your applications').setColor(0x5865F2);
      const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Add to Applications').setStyle(ButtonStyle.Link).setURL(u)
      );
      await i.reply({ embeds: [e], components: [r] });
      break;
    }
  }
});

client.login(TOKEN);
