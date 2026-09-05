import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un utilisateur du serveur Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription("L'utilisateur à bannir").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription('Raison du bannissement').setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('purge_jours')
        .setDescription('Nombre de jours de messages à purger (0 à 7 jours)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('motif') || 'Non précisé';
    const purgeDays = interaction.options.getInteger('purge_jours') || 0;
    const result = await modActions.executeBan({
      guild: interaction.guild,
      targetUser,
      moderator: interaction.user,
      reason,
      purgeDays,
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
