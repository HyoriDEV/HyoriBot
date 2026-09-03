import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const warnlistCommand = {
  data: new SlashCommandBuilder()
    .setName('warnlist')
    .setDescription("Affiche l'historique complet des avertissements d'un joueur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le joueur ciblé').setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('utilisateur');
    const result = await modActions.executeWarnlist({
      targetUser,
    });
    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
    return interaction.editReply({
      embeds: [result.embed],
    });
  },
};
