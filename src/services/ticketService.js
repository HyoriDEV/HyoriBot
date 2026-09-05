import fs from 'fs';
import path from 'path';
import {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import { ticketsStore, configStore, DATA_DIR } from '../storage/index.js';
import { sendAuditLog } from '../utils/auditLogger.js';
import { logger } from '../logger/index.js';

export class TicketService {
  /**
   * Crée un nouveau salon de ticket pour un utilisateur.
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string} categoryType
   */
  static async createTicket(interaction, categoryType = 'Support') {
    const guild = interaction.guild;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    // 1. Vérifier si l'utilisateur a déjà un ticket ouvert
    const ticketsData = await ticketsStore.read();
    const existingTicket = (ticketsData.tickets || []).find(
      t => t.guildId === guild.id && t.userId === user.id && t.status === 'OPEN'
    );

    if (existingTicket) {
      return interaction.editReply({
        content: `⚠️ Vous possédez déjà un ticket ouvert dans <#${existingTicket.channelId}>.`
      });
    }

    // 2. Incrémentation du compteur de tickets
    let ticketNumber = 1;
    await ticketsStore.update(data => {
      data.ticketCounter = (data.ticketCounter || 0) + 1;
      ticketNumber = data.ticketCounter;
      return data;
    });

    const formattedId = `ticket-${String(ticketNumber).padStart(4, '0')}`;
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `${formattedId}-${cleanUsername || 'user'}`;

    // 3. Récupération de la configuration (Catégorie & Rôles Staff)
    const config = await configStore.read();
    const categoryId = config.tickets?.categoryId;
    const staffRoleIds = config.roles?.staffRoleIds || [];

    // 4. Définition des permissions du salon
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      }
    ];

    // Ajouter l'accès pour chaque rôle staff configuré
    for (const roleId of staffRoleIds) {
      const staffRole = guild.roles.cache.get(roleId);
      if (staffRole) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles
          ]
        });
      }
    }

    try {
      // 5. Création du salon textuel privé
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || null,
        permissionOverwrites,
        topic: `Ticket #${formattedId} créé par ${user.tag} (${user.id}) - Catégorie: ${categoryType}`
      });

      // 6. Enregistrement dans tickets.json
      await ticketsStore.update(data => {
        data.tickets = data.tickets || [];
        data.tickets.push({
          id: formattedId,
          channelId: ticketChannel.id,
          guildId: guild.id,
          userId: user.id,
          userTag: user.tag,
          category: categoryType,
          status: 'OPEN',
          createdAt: Date.now()
        });
        return data;
      });

      // 7. Envoi du message d'accueil dans le ticket
      const staffPings = staffRoleIds.map(id => `<@&${id}>`).join(' ');
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫 ${formattedId.toUpperCase()} - ${categoryType}`)
        .setDescription(
          `Bonjour ${user}, bienvenue dans votre ticket.\n\n` +
          `L'équipe du support a été notifiée et vous répondra dans les plus brefs délais.\n` +
          `Veuillez décrire votre problème ou votre demande en détail avec des captures d'écran si nécessaire.\n\n` +
          `Pour fermer ce ticket à tout moment, cliquez sur le bouton rouge ci-dessous.`
        )
        .setFooter({ text: 'Système de Support Autonome' })
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close_confirm')
          .setLabel('Fermer le ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `${user} ${staffPings}`.trim(),
        embeds: [welcomeEmbed],
        components: [closeRow]
      });

      return interaction.editReply({
        content: `✅ Votre ticket a été créé avec succès dans <#${ticketChannel.id}>.`
      });
    } catch (err) {
      logger.error({ err, user: user.tag }, 'Erreur lors de la création du ticket');
      return interaction.editReply({
        content: `❌ Une erreur est survenue lors de la création du salon : ${err.message}`
      });
    }
  }

  /**
   * Ferme un ticket, génère le transcript HTML localement et supprime le salon.
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  static async closeTicket(interaction) {
    const channel = interaction.channel;
    const guild = interaction.guild;
    const closedBy = interaction.user;

    await interaction.reply({
      content: '🔒 Fermeture du ticket en cours... Génération de la transcription...',
      ephemeral: true
    });

    // 1. Recherche du ticket dans tickets.json
    const ticketsData = await ticketsStore.read();
    const ticketIndex = (ticketsData.tickets || []).findIndex(t => t.channelId === channel.id);
    const ticketInfo = ticketIndex !== -1 ? ticketsData.tickets[ticketIndex] : null;

    // 2. Récupération de l'historique des messages (jusqu'à 100 récents)
    let fetchedMessages = [];
    try {
      const messagesCollection = await channel.messages.fetch({ limit: 100 });
      fetchedMessages = Array.from(messagesCollection.values()).reverse();
    } catch (fetchErr) {
      logger.error({ fetchErr }, 'Erreur lors de la récupération des messages du ticket');
    }

    // 3. Génération de la transcription HTML moderne
    const transcriptId = ticketInfo ? ticketInfo.id : `ticket-${channel.name}`;
    const transcriptsDir = path.join(DATA_DIR, 'transcripts');
    if (!fs.existsSync(transcriptsDir)) {
      await fs.promises.mkdir(transcriptsDir, { recursive: true });
    }

    const htmlFileName = `transcript-${transcriptId}-${Date.now()}.html`;
    const htmlFilePath = path.join(transcriptsDir, htmlFileName);

    const htmlContent = this.generateHtmlTranscript({
      ticketId: transcriptId,
      channelName: channel.name,
      guildName: guild.name,
      messages: fetchedMessages,
      creatorTag: ticketInfo?.userTag || 'Inconnu',
      closedByTag: closedBy.tag,
      createdAt: ticketInfo?.createdAt || channel.createdTimestamp
    });

    await fs.promises.writeFile(htmlFilePath, htmlContent, 'utf-8');

    // 4. Mise à jour du statut dans tickets.json
    if (ticketIndex !== -1) {
      await ticketsStore.update(data => {
        data.tickets[ticketIndex].status = 'CLOSED';
        data.tickets[ticketIndex].closedAt = Date.now();
        data.tickets[ticketIndex].closedBy = closedBy.id;
        data.tickets[ticketIndex].closedByTag = closedBy.tag;
        data.tickets[ticketIndex].transcriptPath = `./data/transcripts/${htmlFileName}`;
        return data;
      });
    }

    // 5. Création de la pièce jointe pour envoi
    const attachment = new AttachmentBuilder(htmlFilePath, { name: htmlFileName });

    const summaryEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`📁 Ticket Fermé - ${transcriptId.toUpperCase()}`)
      .addFields(
        { name: 'Créateur', value: ticketInfo ? `<@${ticketInfo.userId}> (\`${ticketInfo.userTag}\`)` : 'Inconnu', inline: true },
        { name: 'Fermé par', value: `${closedBy.tag} (\`${closedBy.id}\`)`, inline: true },
        { name: 'Messages archivés', value: `\`${fetchedMessages.length}\``, inline: true },
        { name: 'Fichier local', value: `\`./data/transcripts/${htmlFileName}\``, inline: false }
      )
      .setTimestamp();

    // Envoi du transcript en MP à l'auteur du ticket si possible
    if (ticketInfo?.userId) {
      try {
        const ticketCreator = await guild.members.fetch(ticketInfo.userId).catch(() => null);
        if (ticketCreator) {
          await ticketCreator.send({
            content: `Voici la transcription complète de votre ticket sur **${guild.name}** :`,
            embeds: [summaryEmbed],
            files: [attachment]
          }).catch(() => {});
        }
      } catch {}
    }

    // Envoi du log d'audit
    await sendAuditLog(guild, 'moderationChannelId', summaryEmbed);

    // Annonce dans le salon avant suppression
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('⚠️ Ce salon sera automatiquement supprimé dans **5 secondes**.')
      ]
    });

    setTimeout(async () => {
      await channel.delete('Fermeture du ticket').catch(() => {});
    }, 5000);
  }

  /**
   * Générateur de transcription HTML autonome, stylisé Discord Dark Theme.
   */
  static generateHtmlTranscript({ ticketId, channelName, guildName, messages, creatorTag, closedByTag, createdAt }) {
    const formattedDate = new Date(createdAt).toLocaleString('fr-FR');
    const closedDate = new Date().toLocaleString('fr-FR');

    const escapeHtml = (text = '') => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const messagesHtml = messages.map(msg => {
      const timeStr = new Date(msg.createdTimestamp).toLocaleTimeString('fr-FR');
      const authorTag = escapeHtml(msg.author.tag);
      const isBot = msg.author.bot;
      const avatarUrl = msg.author.displayAvatarURL({ size: 64 });
      const content = escapeHtml(msg.content).replace(/\n/g, '<br>');

      let attachmentsHtml = '';
      if (msg.attachments && msg.attachments.size > 0) {
        attachmentsHtml = msg.attachments.map(att => {
          const isImg = att.contentType?.startsWith('image/');
          if (isImg) {
            return `<div class="attachment"><a href="${att.url}" target="_blank"><img src="${att.url}" style="max-width: 320px; border-radius: 6px; margin-top: 6px;" alt="${escapeHtml(att.name)}"></a></div>`;
          }
          return `<div class="attachment">📎 <a href="${att.url}" target="_blank" style="color: #00aff4;">${escapeHtml(att.name)}</a></div>`;
        }).join('');
      }

      return `
        <div class="message">
          <img class="avatar" src="${avatarUrl}" alt="${authorTag}">
          <div class="message-body">
            <div class="header">
              <span class="author">${authorTag}</span>
              ${isBot ? '<span class="bot-badge">BOT</span>' : ''}
              <span class="timestamp">${timeStr}</span>
            </div>
            <div class="content">${content || '<em>(Message sans texte)</em>'}</div>
            ${attachmentsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Transcription - ${escapeHtml(ticketId)}</title>
  <style>
    body {
      background-color: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .top-bar {
      background-color: #2b2d31;
      border-radius: 8px;
      padding: 16px 24px;
      margin-bottom: 24px;
      border-left: 4px solid #5865f2;
    }
    h1 { margin: 0 0 8px 0; font-size: 20px; color: #f2f3f5; }
    .meta { font-size: 13px; color: #949ba4; }
    .messages-container { display: flex; flex-direction: column; gap: 14px; }
    .message { display: flex; gap: 14px; padding: 4px 8px; border-radius: 4px; }
    .message:hover { background-color: #2e3035; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .message-body { flex: 1; }
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .author { font-weight: 600; color: #f2f3f5; font-size: 15px; }
    .bot-badge {
      background-color: #5865f2;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .timestamp { font-size: 12px; color: #949ba4; }
    .content { font-size: 14px; line-height: 1.4; word-break: break-word; }
  </style>
</head>
<body>
  <div class="top-bar">
    <h1>Transcription : ${escapeHtml(ticketId.toUpperCase())} (#${escapeHtml(channelName)})</h1>
    <div class="meta">
      <strong>Serveur :</strong> ${escapeHtml(guildName)} |
      <strong>Créateur :</strong> ${escapeHtml(creatorTag)} (${formattedDate}) |
      <strong>Fermé par :</strong> ${escapeHtml(closedByTag)} (${closedDate}) |
      <strong>Messages archivés :</strong> ${messages.length}
    </div>
  </div>
  <div class="messages-container">
    ${messagesHtml}
  </div>
</body>
</html>`;
  }
}
