import { Events, EmbedBuilder } from 'discord.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    // Éviter de logger si le contenu n'a pas changé (ex: Discord a chargé un embed d'aperçu de lien)
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Message Modifié')
      .setAuthor({
        name: `${newMessage.author.tag} (${newMessage.author.id})`,
        iconURL: newMessage.author.displayAvatarURL()
      })
      .addFields(
        { name: 'Salon', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'Lien direct', value: `[Accéder au message](${newMessage.url})`, inline: true }
      )
      .setTimestamp();

    const oldText = oldMessage.content?.trim();
    const newText = newMessage.content?.trim();

    const formatContent = (txt) => {
      if (!txt) return '*Contenu non mis en cache avant modification*';
      return txt.length > 1000 ? `${txt.slice(0, 1000)}... *(tronqué)*` : txt;
    };

    embed.addFields(
      { name: '🔴 Avant modification', value: `\`\`\`\n${formatContent(oldText)}\n\`\`\``, inline: false },
      { name: '🟢 Après modification', value: `\`\`\`\n${formatContent(newText)}\n\`\`\``, inline: false }
    );

    await sendAuditLog(newMessage.guild, 'messagesChannelId', embed);
  }
};
