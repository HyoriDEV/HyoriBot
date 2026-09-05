import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';

export const purgeCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Supprime des messages récents dans le salon (alias direct de /clear)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 100)')
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
      commandName: 'purge',
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
