import { Events, EmbedBuilder } from 'discord.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const roles = member.roles?.cache
      .filter(r => r.id !== member.guild.id)
      .map(r => `<@&${r.id}>`)
      .join(', ') || 'Aucun rôle';

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('📤 Départ d\'un Membre')
      .setAuthor({
        name: `${member.user.tag} (${member.id})`,
        iconURL: member.user.displayAvatarURL()
      })
      .addFields(
        { name: 'Rejoint le', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Inconnu', inline: true },
        { name: 'Membres restants', value: `\`${member.guild.memberCount}\``, inline: true },
        { name: 'Rôles possédés', value: roles.slice(0, 1024), inline: false }
      )
      .setTimestamp();

    await sendAuditLog(member.guild, 'membersChannelId', embed);
  }
};
