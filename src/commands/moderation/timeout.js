import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import ms from 'ms';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Appliquer un timeout customisé avec rôle restrictif (blacklist salons)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à sanctionner')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('duree')
        .setDescription('Durée de la sanction (ex: 10m, 2h, 1d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison du timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const durationInput = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 1000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Format de durée invalide. Exemples valides : `10m`, `1h`, `12h`, `3d` (max 28 jours).',
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'a pas été trouvé sur le serveur.',
        ephemeral: true
      });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous sanctionner vous-même.',
        ephemeral: true
      });
    }

    if (member.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas m\'appliquer cette sanction.',
        ephemeral: true
      });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas sanctionner un membre ayant un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { expiresAt, role } = await timeoutScheduler.addTimeout(
        interaction.guild,
        member,
        durationMs,
        reason,
        interaction.user
      );

      // Notification en MP si possible
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🔇 Vous avez été restreint sur ${interaction.guild.name}`)
            .addFields(
              { name: 'Raison', value: reason },
              { name: 'Fin de la sanction', value: `<t:${Math.floor(expiresAt / 1000)}:F> (<t:${Math.floor(expiresAt / 1000)}:R>)` }
            )
            .setTimestamp()
        ]
      }).catch(() => {});

      const successEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔇 Timeout Customisé Appliqué')
        .setDescription(`Le membre ${member} a reçu le rôle restrictif <@&${role.id}>.`)
        .addFields(
          { name: 'Membre', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Durée', value: `\`${durationInput}\``, inline: true },
          { name: 'Expiration', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
          { name: 'Raison', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 2000);

      // Envoi du log de modération
      await sendModLog(interaction.guild, successEmbed);
    } catch (err) {
      await interaction.editReply({
        content: `❌ Une erreur est survenue lors de l'application du timeout : ${err.message}`
      });
    }
  }
};
