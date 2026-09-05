import { logger } from '../../logger/index.js';

export default {
  name: 'customButtonInteraction',
  async execute(interaction) {
    if (!interaction.customId.startsWith('role_toggle_')) return;

    const roleId = interaction.customId.replace('role_toggle_', '');
    const guild = interaction.guild;
    const member = interaction.member;

    if (!guild || !member) return;

    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return interaction.reply({
        content: '❌ Ce rôle n\'existe plus ou est introuvable sur le serveur.',
        ephemeral: true
      });
    }

    const botMember = guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: '⚠️ Je ne peux pas gérer ce rôle car il est hiérarchiquement supérieur ou égal à mon rôle le plus élevé.',
        ephemeral: true
      });
    }

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id, 'Auto-rôle par bouton (Retrait)');
        return interaction.reply({
          content: `❌ Le rôle **@${role.name}** vous a été retiré.`,
          ephemeral: true
        });
      } else {
        await member.roles.add(role.id, 'Auto-rôle par bouton (Attribution)');
        return interaction.reply({
          content: `✅ Le rôle **@${role.name}** vous a été attribué !`,
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error({ error, roleId, user: interaction.user.tag }, 'Erreur lors du toggle de rôle par bouton');
      return interaction.reply({
        content: '⚠️ Une erreur est survenue lors de l\'attribution ou du retrait du rôle.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};
