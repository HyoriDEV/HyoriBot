import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const clearCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription("Supprime un nombre de messages récents dans le salon (jusqu'à 50)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 50)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(true)
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
    const amount = interaction.options.getInteger('nombre');
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
