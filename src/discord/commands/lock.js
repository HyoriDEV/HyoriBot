import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const lockCommand = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription("Verrouille l'envoi de messages dans un salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Le salon à verrouiller (salon actuel par défaut)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription('Raison du verrouillage').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
    const reason = interaction.options.getString('motif') || 'Salon verrouillé par la modération';
    const result = await modActions.executeLock({
      channel: targetChannel,
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
