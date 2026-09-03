import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const unlockCommand = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription("Déverrouille l'envoi de messages dans un salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Le salon à déverrouiller (salon actuel par défaut)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
    const result = await modActions.executeUnlock({
      channel: targetChannel,
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
