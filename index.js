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
  console.error('ERROR: Add TOKEN= and CLIENT_ID= to your .env file dumbass');
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
    .setDescription('Spam text')
    .addStringOption(o => o.setName('message').setDescription('Text').setRequired(true)),

  new SlashCommandBuilder()
    .setName('g-raid')
    .setDescription('Spam gif')
    .addStringOption(o => o.setName('gif').setDescription('Gif url').setRequired(true)),

  new SlashCommandBuilder()
    .setName('l-raid')
    .setDescription('Spam link')
    .addStringOption(o => o.setName('link').setDescription('Url').setRequired(true)),

  new SlashCommandBuilder()
    .setName('p-raid')
    .setDescription('Mass ping online users')
    .addStringOption(o => o.setName('message').setDescription('Text').setRequired(false)),

  new SlashCommandBuilder().setName('oauth2').setDescription('Get invite link'),

  new SlashCommandBuilder().setName('bot').setDescription('Show add button')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`[Jack] Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands pushed globally — wait up to 1h or add GUILD_ID in .env for fast test');
  } catch (e) {
    console.error('Slash command deploy fucked up:', e);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  const hide = async () => {
    try {
      await i.deferReply({ ephemeral: true });
      await i.deleteReply();
    } catch {}
  };

  if (['n-raid', 'g-raid', 'l-raid', 'p-raid'].includes(cmd)) await hide();

  switch (cmd) {
    case 'n-raid': {
      const m = i.options.getString('message');
      for (let k = 0; k < SPAM_COUNT; k++) {
        try {
          await i.channel.send(m);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS));
        } catch { break; }
      }
      break;
    }

    case 'g-raid':
    case 'l-raid': {
      const key = cmd === 'g-raid' ? 'gif' : 'link';
      const c = i.options.getString(key);
      for (let k = 0; k < SPAM_COUNT; k++) {
        try {
          await i.channel.send(c);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS));
        } catch { break; }
      }
      break;
    }

    case 'p-raid': {
      const txt = i.options.getString('message') || 'get fucked lol';
      const online = i.guild.members.cache.filter(m => 
        m.presence?.status !== 'offline' && !m.user.bot
      );

      if (online.size === 0) {
        await i.followup({ content: 'no online targets', ephemeral: true });
        return;
      }

      const arr = [...online.values()];
      for (let k = 0; k < SPAM_COUNT; k++) {
        const chunk = arr.slice(k * 20, (k + 1) * 20);
        if (!chunk.length) break;
        const p = chunk.map(m => m.toString()).join(' ');
        try {
          await i.channel.send(`${p} ${txt}`);
          await new Promise(r => setTimeout(r, SPAM_DELAY_MS * 1.5));
        } catch { break; }
      }
      break;
    }

    case 'oauth2': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      await i.reply({ content: `Add me here:\n${url}`, ephemeral: true });
      break;
    }

    case 'bot': {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=274877945856`;
      const emb = new EmbedBuilder()
        .setTitle('Jack Raid Bot')
        .setDescription('Click to add to your server')
        .setColor(0xFF0000);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Invite Bot')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );
      await i.reply({ embeds: [emb], components: [row] });
      break;
    }
  }
});

client.login(TOKEN);
