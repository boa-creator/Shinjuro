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

// ================= READY =================
client.once('ready', async () => {
  console.log("Bot connecté");

  try {

    // ================= RÈGLEMENT =================
    const rulesChannel = await client.channels.fetch(RULES_CHANNEL_ID);
    const rulesMessages = await rulesChannel.messages.fetch({ limit: 10 });

    const rulesAlreadySent = rulesMessages.some(m => m.author.id === client.user.id);

    if (!rulesAlreadySent) {

      const rulesButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('accept_rules')
          .setLabel('J’accepte le règlement')
          .setStyle(ButtonStyle.Success)
      );

      const rules = `

Bienvenue sur notre serveur !

**Respect et bienveillance**
- Respect obligatoire
- Aucun harcèlement

**Contenu interdit**
- NSFW interdit
- Insultes interdites

**Sanctions**
Le non-respect entraîne des sanctions.
      `;

      await rulesChannel.send({
        content: rules,
        components: [rulesButton]
      });

      console.log("Règlement envoyé");
    }

    // ================= TICKETS =================
    const ticketChannel = await client.channels.fetch(TICKET_CHANNEL_ID);
    const ticketMessages = await ticketChannel.messages.fetch({ limit: 10 });

    const ticketAlreadySent = ticketMessages.some(m => m.author.id === client.user.id);

    if (!ticketAlreadySent) {

      const ticketButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('🎟️ Ouvrir un ticket')
          .setStyle(ButtonStyle.Primary)
      );

      await ticketChannel.send({
        content: "🎟️ Système de tickets",
        components: [ticketButton]
      });

      console.log("Tickets envoyés");
    }

  } catch (err) {
    console.log(err);
  }
});

// ================= ROLE =================
client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(r => r.name === restrictedRoleName);
  if (role) member.roles.add(role).catch(() => {});
});

// ================= BUTTONS =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isButton()) return;

  // ACCEPT RULES
  if (interaction.customId === 'accept_rules') {
    const role = interaction.guild.roles.cache.find(r => r.name === restrictedRoleName);
    if (role) await interaction.member.roles.remove(role);

    return interaction.reply({
      content: "✔️ Règlement accepté",
      ephemeral: true
    });
  }

  // CREATE TICKET
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

    const logChannel = interaction.guild.channels.cache.get(TICKET_LOGS_ID);
    if (logChannel) {
      logChannel.send(`🎟️ Ticket ouvert par ${interaction.user.tag}`);
    }

    return interaction.reply({
      content: `✔️ Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  // CLOSE TICKET
  if (interaction.customId === 'close_ticket') {

    const logChannel = interaction.guild.channels.cache.get(TICKET_LOGS_ID);
    if (logChannel) {
      logChannel.send(`❌ Ticket fermé : ${interaction.channel.name}`);
    }

    return interaction.channel.delete();
  }
});

// ================= MUTE / UNMUTE =================
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.startsWith('!mute')) {

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Pas la permission");
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention un utilisateur");

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`mute_reason_${user.id}`)
        .setPlaceholder("📌 Raison du mute")
        .addOptions([
          { label: "Insulte", value: "insult" },
          { label: "Spam", value: "spam" },
          { label: "Troll", value: "troll" },
          { label: "Harcèlement", value: "harassment" },
          { label: "Contenu inapproprié", value: "inappropriate" },
          { label: "Publicité", value: "ads" },
          { label: "Racisme", value: "racism" },
          { label: "Discrimination", value: "discrimination" },
          { label: "Menace", value: "threat" }
        ])
    );

    return message.reply({
      content: "📌 Choisis une raison",
      components: [menu]
    });
  }

  if (message.content.startsWith('!unmute')) {

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Pas la permission");
    }

    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention un utilisateur");

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`unmute_reason_${user.id}`)
        .setPlaceholder("📌 Raison du unmute")
        .addOptions([
          { label: "Fin de sanction", value: "end" },
          { label: "Erreur de modération", value: "error" },
          { label: "Autre", value: "other" }
        ])
    );

    return message.reply({
      content: "📌 Choisis une raison",
      components: [menu]
    });
  }
});

// ================= SELECT MENUS =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isStringSelectMenu()) return;

  // ===== MUTE =====
  if (interaction.customId.startsWith('mute_reason_')) {

    const memberId = interaction.customId.split('_')[2];
    const member = await interaction.guild.members.fetch(memberId);

    const durations = {
      insult: 10 * 60 * 1000,
      spam: 5 * 60 * 1000,
      troll: 10 * 60 * 1000,
      harassment: 60 * 60 * 1000,
      inappropriate: 60 * 60 * 1000,
      ads: 10 * 60 * 1000,
      racism: 24 * 60 * 60 * 1000,
      discrimination: 24 * 60 * 60 * 1000,
      threat: 24 * 60 * 60 * 1000
    };

    const labels = {
      insult: "Insulte",
      spam: "Spam",
      troll: "Troll",
      harassment: "Harcèlement",
      inappropriate: "Contenu inapproprié",
      ads: "Publicité",
      racism: "Racisme",
      discrimination: "Discrimination",
      threat: "Menace"
    };

    const timeText = {
      insult: "10 minutes",
      spam: "5 minutes",
      troll: "10 minutes",
      harassment: "1 heure",
      inappropriate: "1 heure",
      ads: "10 minutes",
      racism: "24 heures",
      discrimination: "24 heures",
      threat: "24 heures"
    };

    const reason = interaction.values[0];

    await member.timeout(durations[reason]);

    const log = interaction.guild.channels.cache.get(MOD_LOGS_ID);
    if (log) {
      log.send(
        `${member.user.tag} a été mute par ${interaction.user.tag}\nRaison : ${labels[reason]}\nDurée : ${timeText[reason]}`
      );
    }

    return interaction.update({
      content: `${member.user.tag} a été mute\nRaison : ${labels[reason]}\nDurée : ${timeText[reason]}`,
      components: []
    });
  }

  // ===== UNMUTE =====
  if (interaction.customId.startsWith('unmute_reason_')) {

    const memberId = interaction.customId.split('_')[2];
    const member = await interaction.guild.members.fetch(memberId);

    await member.timeout(null);

    const reasons = {
      end: "Fin de sanction",
      error: "Erreur de modération",
      other: "Autre"
    };

    const reason = reasons[interaction.values[0]];

    const log = interaction.guild.channels.cache.get(MOD_LOGS_ID);
    if (log) {
      log.send(
        `${member.user.tag} a été démute par ${interaction.user.tag}\nRaison : ${reason}`
      );
    }

    return interaction.update({
      content: `${member.user.tag} a été démute\nRaison : ${reason}`,
      components: []
    });
  }
});

// ================= EXPRESS (RENDER) =================
app.get('/', (req, res) => {
  res.status(200).send('Bot is alive');
});

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log("Server running on port " + process.env.PORT);
});

// KEEP ALIVE
setInterval(() => {
  fetch(process.env.RENDER_EXTERNAL_URL)
    .then(() => console.log("Ping keep-alive"))
    .catch(() => {});
}, 14 * 60 * 1000);

client.login(process.env.TOKEN);