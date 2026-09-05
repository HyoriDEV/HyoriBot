import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur par son identifiant ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(opt =>
      opt
        .setName('user_id')
        .setDescription('L\'ID Discord de l\'utilisateur à débannir')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison du débannissement')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('raison') || 'Révocation manuelle du bannissement';

    await interaction.deferReply({ ephemeral: true });

    try {
      const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) {
        return interaction.editReply({
          content: `❌ Aucun bannissement trouvé pour l'ID \`${userId}\`.`
        });
      }

      await interaction.guild.bans.remove(userId, `${interaction.user.tag}: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤝 Utilisateur Débanni')
        .addFields(
          { name: 'Utilisateur', value: `${banInfo.user.tag} (\`${banInfo.user.id}\`)`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Raison', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(interaction.guild, embed);
    } catch (err) {
      await interaction.editReply({
        content: `❌ Erreur lors du débannissement : ${err.message}`
      });
    }
  }
};
