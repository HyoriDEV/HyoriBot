import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnsStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnlist')
    .setDescription('Consulter l\'historique des avertissements d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre ciblé')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const store = await warnsStore.read();
    const sanctions = store.sanctions || [];

    const userWarns = sanctions.filter(
      s => s.guildId === interaction.guild.id && s.userId === targetUser.id && s.type === 'WARN'
    );

    if (userWarns.length === 0) {
      return interaction.reply({
        content: `✅ Le membre **${targetUser.tag}** ne possède aucun avertissement.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`📋 Avertissements de ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `Total : ${userWarns.length} avertissement(s)` })
      .setTimestamp();

    const formatted = userWarns.slice(-10).map((w, index) => {
      const date = `<t:${Math.floor(w.timestamp / 1000)}:d>`;
      return `**#${index + 1}** [${date}] - **Modérateur:** <@${w.moderatorId}>\n↳ *${w.reason}* (ID: \`${w.id}\`)`;
    }).join('\n\n');

    embed.setDescription(formatted);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
