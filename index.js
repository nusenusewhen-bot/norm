require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Collection,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const db = require('./database.js');

const OWNER_ID = process.env.OWNER_ID || '1459833646130401429';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// Helper functions
function isOwner(userId) {
  return userId === OWNER_ID;
}

function getStock() {
  return db.prepare('SELECT * FROM stock WHERE id = 1').get();
}

function updateStock(offline, online) {
  db.prepare('UPDATE stock SET offline_amount = ?, online_amount = ? WHERE id = 1').run(offline, online);
}

function getUser(userId) {
  let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!user) {
    db.prepare('INSERT INTO users (user_id, offline_credits, online_credits) VALUES (?, 0, 0)').run(userId);
    user = { user_id: userId, offline_credits: 0, online_credits: 0 };
  }
  return user;
}

function updateUserCredits(userId, offline, online) {
  db.prepare(`
    INSERT INTO users (user_id, offline_credits, online_credits) 
    VALUES (?, ?, ?) 
    ON CONFLICT(user_id) DO UPDATE SET 
    offline_credits = offline_credits + ?,
    online_credits = online_credits + ?
  `).run(userId, offline, online, offline, online);
}

function generateKey(type, amount) {
  const key = `KEY-${uuidv4().toUpperCase().replace(/-/g, '').substring(0, 16)}`;
  db.prepare('INSERT INTO keys (key_code, type, amount) VALUES (?, ?, ?)').run(key, type, amount);
  return key;
}

function redeemKey(keyCode, userId) {
  const key = db.prepare('SELECT * FROM keys WHERE key_code = ? AND used = 0').get(keyCode);
  if (!key) return null;
  
  db.prepare('UPDATE keys SET used = 1, used_by = ? WHERE key_code = ?').run(userId, keyCode);
  
  if (key.type === 'offline') {
    updateUserCredits(userId, key.amount, 0);
  } else {
    updateUserCredits(userId, 0, key.amount);
  }
  
  return key;
}

// Commands definition
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),
  
  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Shows current stock amounts'),
  
  new SlashCommandBuilder()
    .setName('generatekey')
    .setDescription('Generate a redeemable key (Owner only)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of credits')
        .setRequired(true)
        .addChoices(
          { name: 'Offline', value: 'offline' },
          { name: 'Online', value: 'online' }
        ))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of credits')
        .setRequired(true)
        .setMinValue(1)),
  
  new SlashCommandBuilder()
    .setName('redeemkey')
    .setDescription('Redeem a key for credits')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('The key to redeem')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('redeem_credit')
    .setDescription('Redeem credits from your balance (Owner only)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of credits')
        .setRequired(true)
        .addChoices(
          { name: 'Offline', value: 'offline' },
          { name: 'Online', value: 'online' }
        ))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to redeem')
        .setRequired(true)
        .setMinValue(1)),
  
  new SlashCommandBuilder()
    .setName('share')
    .setDescription('Share credits with another user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to share with')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of credits')
        .setRequired(true)
        .addChoices(
          { name: 'Offline', value: 'offline' },
          { name: 'Online', value: 'online' }
        ))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to share')
        .setRequired(true)
        .setMinValue(1)),
  
  new SlashCommandBuilder()
    .setName('oauth2')
    .setDescription('Get bot invite link'),
  
  new SlashCommandBuilder()
    .setName('mycredits')
    .setDescription('Check your credit balance'),
  
  new SlashCommandBuilder()
    .setName('stockoff')
    .setDescription('Add offline stock (Owner only)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to add')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('stockon')
    .setDescription('Add online stock (Owner only)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to add')
        .setRequired(true))
];

// Register commands
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  try {
    await client.application.commands.set(commands);
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

// Message handler for prefix commands (.stockoff, .stockon)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  
  // Owner only prefix commands
  if (command === '.stockoff' || command === '.stockon') {
    if (!isOwner(message.author.id)) {
      return; // Silently ignore non-owners
    }
    
    const amount = parseInt(args[1]);
    if (!amount || isNaN(amount) || amount < 1) {
      return message.reply('❌ Please provide a valid amount. Usage: `.stockoff 100` or `.stockon 100`');
    }
    
    const stock = getStock();
    
    if (command === '.stockoff') {
      updateStock(stock.offline_amount + amount, stock.online_amount);
      const embed = new EmbedBuilder()
        .setTitle('📦 Stock Updated')
        .setDescription(`Added **${amount}** offline credits to stock`)
        .addFields(
          { name: 'Offline Stock', value: `\`${stock.offline_amount + amount}\``, inline: true },
          { name: 'Online Stock', value: `\`${stock.online_amount}\``, inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();
      message.reply({ embeds: [embed] });
    } else {
      updateStock(stock.offline_amount, stock.online_amount + amount);
      const embed = new EmbedBuilder()
        .setTitle('📦 Stock Updated')
        .setDescription(`Added **${amount}** online credits to stock`)
        .addFields(
          { name: 'Offline Stock', value: `\`${stock.offline_amount}\``, inline: true },
          { name: 'Online Stock', value: `\`${stock.online_amount + amount}\``, inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();
      message.reply({ embeds: [embed] });
    }
  }
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName } = interaction;
  
  // /help command
  if (commandName === 'help') {
    const isUserOwner = isOwner(interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle('📜 Bot Commands')
      .setDescription('Here are all available commands:')
      .setColor('#5865F2')
      .setThumbnail(client.user.displayAvatarURL());
    
    // Public commands
    embed.addFields({
      name: '🌍 Public Commands',
      value: 
        '`/help` - Show this help message\n' +
        '`/stock` - View current stock amounts\n' +
        '`/mycredits` - Check your credit balance\n' +
        '`/redeemkey` - Redeem a key for credits\n' +
        '`/share @user <type> <amount>` - Share credits with others\n' +
        '`/oauth2` - Get bot invite link'
    });
    
    // Owner only commands
    if (isUserOwner) {
      embed.addFields({
        name: '👑 Owner Commands',
        value: 
          '`.stockoff <amount>` - Add offline stock (prefix)\n' +
          '`.stockon <amount>` - Add online stock (prefix)\n' +
          '`/generatekey <type> <amount>` - Generate redeemable key\n' +
          '`/redeem_credit <type> <amount>` - Redeem credits from stock\n' +
          '`/stockoff <amount>` - Add offline stock (slash)\n' +
          '`/stockon <amount>` - Add online stock (slash)'
      });
    }
    
    embed.setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
  
  // /stock command
  if (commandName === 'stock') {
    const stock = getStock();
    
    const embed = new EmbedBuilder()
      .setTitle('📦 Current Stock')
      .addFields(
        { 
          name: '🔴 Offline Credits', 
          value: `\`\`\`${stock.offline_amount}\`\`\``, 
          inline: true 
        },
        { 
          name: '🟢 Online Credits', 
          value: `\`\`\`${stock.online_amount}\`\`\``, 
          inline: true 
        }
      )
      .setColor('#FFD700')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
  
  // /mycredits command
  if (commandName === 'mycredits') {
    const user = getUser(interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle('💳 Your Credits')
      .setDescription(`Balance for <@${interaction.user.id}>`)
      .addFields(
        { 
          name: '🔴 Offline Credits', 
          value: `\`\`\`${user.offline_credits}\`\`\``, 
          inline: true 
        },
        { 
          name: '🟢 Online Credits', 
          value: `\`\`\`${user.online_credits}\`\`\``, 
          inline: true 
        }
      )
      .setColor('#00FF00')
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // /oauth2 command
  if (commandName === 'oauth2') {
    const clientId = process.env.CLIENT_ID || client.user.id;
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    
    const embed = new EmbedBuilder()
      .setTitle('🔗 Bot Invite Link')
      .setDescription(`Click the button below to invite the bot to your server!`)
      .setColor('#5865F2');
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite Bot')
          .setStyle(ButtonStyle.Link)
          .setURL(inviteLink)
          .setEmoji('🤖')
      );
    
    await interaction.reply({ embeds: [embed], components: [row] });
  }
  
  // Owner only commands check
  if (['generatekey', 'redeem_credit', 'stockoff', 'stockon'].includes(commandName)) {
    if (!isOwner(interaction.user.id)) {
      return await interaction.reply({ content: '❌ Only the bot owner can use this command!', ephemeral: true });
    }
  }
  
  // /generatekey command
  if (commandName === 'generatekey') {
    const type = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');
    
    const key = generateKey(type, amount);
    
    const embed = new EmbedBuilder()
      .setTitle('🔑 Key Generated')
      .setDescription('A new key has been generated!')
      .addFields(
        { name: 'Key', value: `\`${key}\``, inline: false },
        { name: 'Type', value: type === 'offline' ? '🔴 Offline' : '🟢 Online', inline: true },
        { name: 'Amount', value: `\`${amount}\``, inline: true }
      )
      .setColor('#00FF00')
      .setFooter({ text: 'Share this key with users to redeem credits' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // /redeemkey command
  if (commandName === 'redeemkey') {
    const keyCode = interaction.options.getString('key').trim();
    
    const key = redeemKey(keyCode, interaction.user.id);
    
    if (!key) {
      return await interaction.reply({ content: '❌ Invalid or already used key!', ephemeral: true });
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Key Redeemed!')
      .setDescription(`Successfully redeemed **${key.amount}** ${key.type} credits!`)
      .setColor('#00FF00')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
  
  // /redeem_credit command (Owner only)
  if (commandName === 'redeem_credit') {
    const type = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');
    
    const stock = getStock();
    
    if (type === 'offline' && stock.offline_amount < amount) {
      return await interaction.reply({ content: '❌ Not enough offline stock!', ephemeral: true });
    }
    if (type === 'online' && stock.online_amount < amount) {
      return await interaction.reply({ content: '❌ Not enough online stock!', ephemeral: true });
    }
    
    // Deduct from stock and add to owner
    if (type === 'offline') {
      updateStock(stock.offline_amount - amount, stock.online_amount);
      updateUserCredits(interaction.user.id, amount, 0);
    } else {
      updateStock(stock.offline_amount, stock.online_amount - amount);
      updateUserCredits(interaction.user.id, 0, amount);
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Credits Redeemed')
      .setDescription(`Redeemed **${amount}** ${type} credits from stock`)
      .setColor('#00FF00')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // /share command
  if (commandName === 'share') {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');
    
    if (targetUser.id === interaction.user.id) {
      return await interaction.reply({ content: '❌ You cannot share credits with yourself!', ephemeral: true });
    }
    
    if (targetUser.bot) {
      return await interaction.reply({ content: '❌ You cannot share credits with bots!', ephemeral: true });
    }
    
    const sender = getUser(interaction.user.id);
    
    if (type === 'offline' && sender.offline_credits < amount) {
      return await interaction.reply({ content: '❌ You don\'t have enough offline credits!', ephemeral: true });
    }
    if (type === 'online' && sender.online_credits < amount) {
      return await interaction.reply({ content: '❌ You don\'t have enough online credits!', ephemeral: true });
    }
    
    // Deduct from sender and add to receiver
    if (type === 'offline') {
      updateUserCredits(interaction.user.id, -amount, 0);
      updateUserCredits(targetUser.id, amount, 0);
    } else {
      updateUserCredits(interaction.user.id, 0, -amount);
      updateUserCredits(targetUser.id, 0, amount);
    }
    
    const embed = new EmbedBuilder()
      .setTitle('💝 Credits Shared')
      .setDescription(`<@${interaction.user.id}> shared **${amount}** ${type} credits with <@${targetUser.id}>!`)
      .setColor('#FF69B4')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
  
  // /stockoff slash command (Owner only)
  if (commandName === 'stockoff') {
    const amount = interaction.options.getInteger('amount');
    const stock = getStock();
    
    updateStock(stock.offline_amount + amount, stock.online_amount);
    
    const embed = new EmbedBuilder()
      .setTitle(' Stock Updated')
      .setDescription(`Added **${amount}** offline credits to stock`)
      .addFields(
        { name: 'Offline Stock', value: `\`${stock.offline_amount + amount}\``, inline: true },
        { name: 'Online Stock', value: `\`${stock.online_amount}\``, inline: true }
      )
      .setColor('#00FF00')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
  
  // /stockon slash command (Owner only)
  if (commandName === 'stockon') {
    const amount = interaction.options.getInteger('amount');
    const stock = getStock();
    
    updateStock(stock.offline_amount, stock.online_amount + amount);
    
    const embed = new EmbedBuilder()
      .setTitle('Stock Updated')
      .setDescription(`Added **${amount}** online credits to stock`)
      .addFields(
        { name: 'Offline Stock', value: `\`${stock.offline_amount}\``, inline: true },
        { name: 'Online Stock', value: `\`${stock.online_amount + amount}\``, inline: true }
      )
      .setColor('#00FF00')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err);
  process.exit(1);
});
