import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Retirer manuellement le timeout customisé d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à libérer')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la levée de sanction')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') || 'Levée anticipée par un modérateur';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'a pas été trouvé sur le serveur.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await timeoutScheduler.removeTimeout(interaction.guild, member, reason, interaction.user);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Timeout Customisé Retiré')
        .setDescription(`Le rôle restrictif a été retiré à ${member}.`)
        .addFields(
          { name: 'Membre', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Raison', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(interaction.guild, embed);
    } catch (err) {
      await interaction.editReply({
        content: `❌ Une erreur est survenue lors de la levée du timeout : ${err.message}`
      });
    }
  }
};
