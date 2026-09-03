import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const kickCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre du serveur Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le membre à expulser').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription("Raison de l'expulsion").setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetMember = interaction.options.getMember('utilisateur');
    const reason = interaction.options.getString('motif') || 'Non précisé';
    const result = await modActions.executeKick({
      guild: interaction.guild,
      targetMember,
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
