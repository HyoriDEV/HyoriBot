import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const clearwarnsCommand = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription("Réinitialise et efface tous les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le membre ciblé').setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('utilisateur');
    const result = await modActions.executeClearwarns({
      guild: interaction.guild,
      targetUser,
      moderator: interaction.user,
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
