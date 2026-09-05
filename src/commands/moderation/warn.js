import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnsStore } from '../../storage/index.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre et enregistrer la sanction dans warns.json')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de l\'avertissement')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison');

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Vous ne pouvez pas vous avertir vous-même.', ephemeral: true });
    }
    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Vous ne pouvez pas avertir un bot.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas avertir un membre de rang supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    const now = Date.now();
    const warnId = `warn_${now}_${Math.random().toString(36).slice(2, 7)}`;

    let userWarnCount = 0;
    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      data.sanctions.push({
        id: warnId,
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'WARN',
        reason,
        timestamp: now
      });
      userWarnCount = data.sanctions.filter(
        s => s.guildId === interaction.guild.id && s.userId === targetUser.id && s.type === 'WARN'
      ).length;
      return data;
    });

    // Envoi d'un MP d'avertissement
    if (member) {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⚠️ Avertissement reçu sur ${interaction.guild.name}`)
            .addFields(
              { name: 'Raison', value: reason },
              { name: 'Total d\'avertissements', value: `\`${userWarnCount}\``, inline: true }
            )
            .setTimestamp()
        ]
      }).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚠️ Avertissement Appliqué')
      .setDescription(`Le membre <@${targetUser.id}> a reçu un avertissement.`)
      .addFields(
        { name: 'Membre', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Total Avertissements', value: `\`${userWarnCount}\``, inline: true },
        { name: 'Raison', value: reason, inline: false }
      )
      .setFooter({ text: `ID: ${warnId}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    await sendModLog(interaction.guild, embed);
  }
};
