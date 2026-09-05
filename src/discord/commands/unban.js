import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const unbanCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannit un utilisateur via son ID Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt
        .setName('id_discord')
        .setDescription("Identifiant Discord de l'utilisateur")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription('Raison du débannissement').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.options.getString('id_discord');
    const reason = interaction.options.getString('motif') || 'Débannissement manuel';
    const result = await modActions.executeUnban({
      guild: interaction.guild,
      userId,
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
