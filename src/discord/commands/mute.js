import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const muteCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rend un membre muet (timeout) pour une durée déterminée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('utilisateur').setDescription('Le membre à rendre muet').setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('duree')
        .setDescription('Durée du mute (ex: 60s, 5m, 10m, 1h, 1d, 1w)')
        .setRequired(true)
        .addChoices(
          {
            name: '60 secondes',
            value: '60s',
          },
          {
            name: '5 minutes',
            value: '5m',
          },
          {
            name: '15 minutes',
            value: '15m',
          },
          {
            name: '30 minutes',
            value: '30m',
          },
          {
            name: '1 heure',
            value: '1h',
          },
          {
            name: '6 heures',
            value: '6h',
          },
          {
            name: '12 heures',
            value: '12h',
          },
          {
            name: '1 jour',
            value: '1d',
          },
          {
            name: '3 jours',
            value: '3d',
          },
          {
            name: '1 semaine',
            value: '1w',
          }
        )
    )
    .addStringOption(opt =>
      opt.setName('motif').setDescription('Raison du mute').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetMember = interaction.options.getMember('utilisateur');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('motif') || 'Non précisé';
    const result = await modActions.executeMute({
      guild: interaction.guild,
      targetMember,
      moderator: interaction.user,
      durationStr,
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
