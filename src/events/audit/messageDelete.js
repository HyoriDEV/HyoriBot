import { Events, EmbedBuilder } from 'discord.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild) return;
    // Ignorer les messages de bots si souhaité, mais autoriser pour traçabilité si utile
    if (message.author?.bot) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Message Supprimé')
      .setTimestamp();

    if (message.author) {
      embed.setAuthor({
        name: `${message.author.tag} (${message.author.id})`,
        iconURL: message.author.displayAvatarURL()
      });
    } else {
      embed.setAuthor({ name: 'Auteur inconnu (Non mis en cache)' });
    }

    embed.addFields(
      { name: 'Salon', value: `<#${message.channelId}>`, inline: true }
    );

    // Contenu textuel
    const content = message.content?.trim();
    if (content) {
      const truncated = content.length > 1000 ? `${content.slice(0, 1000)}... *(tronqué)*` : content;
      embed.addFields({ name: 'Contenu exact supprimé', value: `\`\`\`\n${truncated}\n\`\`\``, inline: false });
    } else {
      embed.addFields({ name: 'Contenu exact supprimé', value: '*Aucun contenu textuel ou message antérieur au démarrage du bot.*', inline: false });
    }

    // Pièces jointes / Médias supprimés
    if (message.attachments && message.attachments.size > 0) {
      const attachmentsList = message.attachments.map(att => {
        return `• [${att.name}](${att.proxyURL || att.url}) (${Math.round(att.size / 1024)} Ko)`;
      }).join('\n');

      embed.addFields({
        name: `📎 Pièces jointes supprimées (${message.attachments.size})`,
        value: attachmentsList.slice(0, 1024),
        inline: false
      });

      // Si la première pièce jointe est une image, on peut l'afficher en aperçu si accessible
      const firstImage = message.attachments.find(att => att.contentType?.startsWith('image/'));
      if (firstImage) {
        embed.setImage(firstImage.proxyURL || firstImage.url);
      }
    }

    await sendAuditLog(message.guild, 'messagesChannelId', embed);
  }
};
