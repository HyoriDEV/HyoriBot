import { Events, EmbedBuilder } from 'discord.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (!newMember.guild) return;

    const changes = [];

    // 1. Changement de surnom (nickname)
    if (oldMember.nickname !== newMember.nickname) {
      const oldNick = oldMember.nickname || oldMember.user.displayName;
      const newNick = newMember.nickname || newMember.user.displayName;
      changes.push({
        name: '🏷️ Changement de surnom',
        value: `**Avant :** \`${oldNick}\`\n**Après :** \`${newNick}\``,
        inline: false
      });
    }

    // 2. Ajout de rôles
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    if (addedRoles.size > 0) {
      const rolesList = addedRoles.map(r => `<@&${r.id}>`).join(', ');
      changes.push({
        name: `🟢 Rôle(s) attribué(s) (+${addedRoles.size})`,
        value: rolesList.slice(0, 1024),
        inline: false
      });
    }

    // 3. Retrait de rôles
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (removedRoles.size > 0) {
      const rolesList = removedRoles.map(r => `<@&${r.id}>`).join(', ');
      changes.push({
        name: `🔴 Rôle(s) retiré(s) (-${removedRoles.size})`,
        value: rolesList.slice(0, 1024),
        inline: false
      });
    }

    // S'il n'y a eu aucun des changements ciblés, on ne spamme pas les logs
    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('👤 Profil Membre Mis à Jour')
      .setAuthor({
        name: `${newMember.user.tag} (${newMember.id})`,
        iconURL: newMember.user.displayAvatarURL()
      })
      .addFields(changes)
      .setTimestamp();

    await sendAuditLog(newMember.guild, 'membersChannelId', embed);
  }
};
