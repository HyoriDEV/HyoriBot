import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const slowmodeCommand = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Configure le mode lent dans un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('secondes')
        .setDescription("Délai d'attente en secondes (0 pour désactiver)")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Le salon ciblé (salon actuel par défaut)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const seconds = interaction.options.getInteger('secondes');
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
    const result = await modActions.executeSlowmode({
      channel: targetChannel,
      moderator: interaction.user,
      seconds,
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
