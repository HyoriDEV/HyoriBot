import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const unmuteCommand = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription("Rétablit la parole d'un membre actuellement muet")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le membre à démuter').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription('Raison de la levée').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetMember = interaction.options.getMember('utilisateur');
    const reason = interaction.options.getString('motif') || 'Levée manuelle';
    const result = await modActions.executeUnmute({
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
