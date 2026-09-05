import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnsStore } from '../../storage/index.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à expulser')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de l\'expulsion')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'est pas présent sur le serveur.',
        ephemeral: true
      });
    }

    if (!member.kickable) {
      return interaction.reply({
        content: '❌ Je n\'ai pas la permission d\'expulser ce membre (rôle supérieur ou permissions manquantes).',
        ephemeral: true
      });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas expulser un membre ayant un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Notifier le membre en MP
    await member.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🚪 Vous avez été expulsé de ${interaction.guild.name}`)
          .setDescription(`**Raison :** ${reason}`)
          .setTimestamp()
      ]
    }).catch(() => {});

    await member.kick(`${interaction.user.tag}: ${reason}`);

    const now = Date.now();
    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      data.sanctions.push({
        id: `kick_${now}_${Math.random().toString(36).slice(2, 7)}`,
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'KICK',
        reason,
        timestamp: now
      });
      return data;
    });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚪 Membre Expulsé')
      .addFields(
        { name: 'Membre', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Raison', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(interaction.guild, embed);
  }
};
