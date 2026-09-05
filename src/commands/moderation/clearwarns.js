import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnsStore } from '../../storage/index.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Supprimer tous les avertissements d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre ciblé')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');

    let removedCount = 0;
    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      const before = data.sanctions.length;
      data.sanctions = data.sanctions.filter(
        s => !(s.guildId === interaction.guild.id && s.userId === targetUser.id && s.type === 'WARN')
      );
      removedCount = before - data.sanctions.length;
      return data;
    });

    if (removedCount === 0) {
      return interaction.reply({
        content: `ℹ️ Aucun avertissement à supprimer pour **${targetUser.tag}**.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🧹 Avertissements Effacés')
      .setDescription(`Les avertissements de <@${targetUser.id}> ont été réinitialisés.`)
      .addFields(
        { name: 'Membre', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Nombre d\'avertissements effacés', value: `\`${removedCount}\``, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    await sendModLog(interaction.guild, embed);
  }
};
