const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType
} = require('discord.js');

const express = require('express');
const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CONFIG =================
const restrictedRoleName = "Accès restreint";

const RULES_CHANNEL_ID = "1511373888041259048";
const TICKET_CHANNEL_ID = "1512123337038364892";

const MOD_LOGS_ID = "1512505687559635005";
const TICKET_LOGS_ID = "1512512378300923924";

// ================= EXPRESS (RENDER) =================
app.get('/', (req, res) => {
  res.status(200).send('Bot is alive');
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log("Server running");
});

// ================= READY =================
client.once('ready', async () => {
  console.log("Bot connecté");

  try {

    // ================= RÈGLEMENT =================
    const rulesChannel = await client.channels.fetch(RULES_CHANNEL_ID);
    const messages = await rulesChannel.messages.fetch({ limit: 10 });

    const already = messages.some(m => m.author.id === client.user.id);

    if (!already) {

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('accept_rules')
          .setLabel('J’accepte le règlement')
          .setStyle(ButtonStyle.Success)
      );

      const rulesText = `
📜 RÈGLEMENT DU SERVEUR

- Respect obligatoire
- Aucun spam / insultes
- Aucun contenu interdit
- Respect du staff

Sanctions possibles : mute / ban
      `;

      await rulesChannel.send({
        content: rulesText,
        components: [btn]
      });

      console.log("Règlement envoyé");
    }

    // ================= TICKETS PANEL =================
    const ticketChannel = await client.channels.fetch(TICKET_CHANNEL_ID);
    const ticketMsgs = await ticketChannel.messages.fetch({ limit: 10 });

    const ticketExists = ticketMsgs.some(m => m.author.id === client.user.id);

    if (!ticketExists) {

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('🎟️ Ouvrir un ticket')
          .setStyle(ButtonStyle.Primary)
      );

      await ticketChannel.send({
        content: "🎫 Support / Tickets",
        components: [btn]
      });

      console.log("Tickets envoyés");
    }

  } catch (err) {
    console.log(err);
  }
});

// ================= ROLE JOIN =================
client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(r => r.name === restrictedRoleName);
  if (role) member.roles.add(role).catch(() => {});
});

// ================= BUTTONS =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isButton()) return;

  // ===== RULES =====
  if (interaction.customId === 'accept_rules') {
    const role = interaction.guild.roles.cache.find(r => r.name === restrictedRoleName);
    if (role) await interaction.member.roles.remove(role);

    return interaction.reply({
      content: "✔ Règlement accepté",
      ephemeral: true
    });
  }

  // ===== CREATE TICKET =====
  if (interaction.customId === 'create_ticket') {

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('❌ Fermer')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `Ticket de ${interaction.user}`,
      components: [closeBtn]
    });

    const log = interaction.guild.channels.cache.get(TICKET_LOGS_ID);
    if (log) log.send(`🎟 Ticket ouvert par ${interaction.user.tag}`);

    return interaction.reply({
      content: `Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  // ===== CLOSE TICKET =====
  if (interaction.customId === 'close_ticket') {

    const log = interaction.guild.channels.cache.get(TICKET_LOGS_ID);
    if (log) log.send(`❌ Ticket fermé : ${interaction.channel.name}`);

    return interaction.channel.delete();
  }
});

// ================= MUTE / UNMUTE =================
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ===== MUTE =====
  if (message.content.startsWith('!mute')) {

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Pas la permission");
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention un utilisateur");

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`mute_${user.id}`)
        .setPlaceholder("Raison du mute")
        .addOptions([
          { label: "Insulte", value: "insult" },
          { label: "Spam", value: "spam" },
          { label: "Troll", value: "troll" },
          { label: "Harcèlement", value: "harassment" },
          { label: "Publicité", value: "ads" },
          { label: "Racisme", value: "racism" }
        ])
    );

    return message.reply({ content: "Choisis une raison", components: [menu] });
  }

  // ===== UNMUTE =====
  if (message.content.startsWith('!unmute')) {

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Pas la permission");
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention un utilisateur");

    await user.timeout(null);

    const log = message.guild.channels.cache.get(MOD_LOGS_ID);
    if (log) {
      log.send(`${user.user.tag} a été unmute par ${message.author.tag}`);
    }

    return message.reply(`✔ ${user.user.tag} unmute`);
  }
});

// ================= SELECT MENU MUTE =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId.startsWith('mute_')) {

    const id = interaction.customId.split('_')[1];
    const member = await interaction.guild.members.fetch(id);

    const reasons = {
      insult: "Insulte",
      spam: "Spam",
      troll: "Troll",
      harassment: "Harcèlement",
      ads: "Publicité",
      racism: "Racisme"
    };

    const reason = interaction.values[0];

    await member.timeout(10 * 60 * 1000);

    const log = interaction.guild.channels.cache.get(MOD_LOGS_ID);
    if (log) {
      log.send(`${member.user.tag} a été mute par ${interaction.user.tag}
Raison : ${reasons[reason]}
Durée : 10 minutes`);
    }

    return interaction.update({
      content: `✔ ${member.user.tag} mute`,
      components: []
    });
  }
});

client.login(process.env.TOKEN);