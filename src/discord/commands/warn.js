import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const warnCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Donne un avertissement à un membre avec motif')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le membre à avertir').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription("Raison de l'avertissement").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('motif');
    const result = await modActions.executeWarn({
      guild: interaction.guild,
      targetUser,
      moderator: interaction.user,
      reason,
    });
    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
    return interaction.editReply({
      content: result.message,
    });
  },
};
