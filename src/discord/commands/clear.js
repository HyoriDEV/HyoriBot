import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const clearCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription("Supprime un nombre de messages récents dans le salon (jusqu'à 100)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 100, défaut: 10)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt
        .setName('utilisateur')
        .setDescription('Ne supprimer que les messages de cet utilisateur')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({
      ephemeral: true,
    });
    const amount = interaction.options.getInteger('nombre') || 10;
    const filterUser = interaction.options.getUser('utilisateur');
    const result = await modActions.executeClear({
      channel: interaction.channel,
      moderator: interaction.user,
      amount,
      filterUser,
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
