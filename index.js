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

// ================= READY =================
client.once('ready', async () => {
  console.log("Bot connecté");

  try {

    // ================= RÈGLEMENT (ANTI SPAM) =================
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
Bienvenue sur notre serveur ! Afin de garantir une expérience agréable et respectueuse pour tous, merci de prendre connaissance et de respecter les règles suivantes.

**Respect et bienveillance**

Traitez chaque membre avec courtoisie et respect, sans distinction d'origine, de genre, d'orientation sexuelle, de religion ou d'opinions.
Les propos haineux, discriminatoires, menaçants ou harcelants sont strictement interdits.
Tout comportement perturbateur ou toxique sera sanctionné.

**Contenu inapproprié**

Le partage de contenu à caractère sexuel, violent, choquant ou illégal est formellement prohibé.

**Langage et communication**

Utilisez un langage clair et respectueux. Évitez les insultes, le langage vulgaire et le spam.

**Publicité et promotions**

La publicité non autorisée est interdite. Pour partager un lien ou une promotion, contactez un modérateur au préalable.
Les liens vers des sites frauduleux, illégaux ou à caractère pornographique sont formellement interdits.

**Comportement en cas de conflit**

En cas de désaccord ou de conflit, adressez-vous calmement à un modérateur plutôt que de répondre aux provocations.
Le lynchage ou l'acharnement contre un membre est interdit.

**Respect de la modération**

Les décisions des modérateurs sont à respecter. En cas de doute ou de contestation, contactez un administrateur en privé.
Les modérateurs se réservent le droit de supprimer tout contenu jugé inapproprié.

**Sanctions**

Le non-respect de ces règles peut entraîner des sanctions allant de l'avertissement au bannissement définitif.
      `;

      await rulesChannel.send({
        content: rules,
        components: [rulesButton]
      });

      console.log("Règlement envoyé");
    } else {
      console.log("Règlement déjà présent");
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
    } else {
      console.log("Tickets déjà présents");
    }

  } catch (err) {
    console.log("Erreur ready :", err);
  }
});

// ================= ROLE JOIN =================
client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(r => r.name === restrictedRoleName);
  if (role) member.roles.add(role).catch(() => {});
});

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isButton()) return;

  // ================= ACCEPT RULES =================
  if (interaction.customId === 'accept_rules') {
    const role = interaction.guild.roles.cache.find(r => r.name === restrictedRoleName);

    if (role) await interaction.member.roles.remove(role);

    return interaction.reply({
      content: "✔️ Règlement accepté",
      ephemeral: true
    });
  }

  // ================= TICKET CREATE =================
  if (interaction.customId === 'create_ticket') {

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
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

    return interaction.reply({
      content: `✔️ Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  // ================= CLOSE TICKET =================
  if (interaction.customId === 'close_ticket') {
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

  // ===== UNMUTE =====
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

    const ms = durations[interaction.values[0]];

    await member.timeout(ms);

    return interaction.update({
      content: `✔️ ${member.user.tag} mute`,
      components: []
    });
  }

  // ===== UNMUTE =====
  if (interaction.customId.startsWith('unmute_reason_')) {

    const memberId = interaction.customId.split('_')[2];
    const member = await interaction.guild.members.fetch(memberId);

    await member.timeout(null);

    return interaction.update({
      content: `✔️ ${member.user.tag} unmute`,
      components: []
    });
  }
});

client.login(process.env.TOKEN);
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive');
});

app.listen(process.env.PORT || 3000);