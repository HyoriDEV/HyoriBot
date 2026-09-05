import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warnsStore } from '../../storage/index.js';
import { sendModLog } from '../../utils/modLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir définitivement un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison du bannissement')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('supprimer_jours')
        .setDescription('Supprimer l\'historique des messages (0 à 7 jours)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
    const deleteMessageDays = interaction.options.getInteger('supprimer_jours') || 0;
    const deleteMessageSeconds = deleteMessageDays * 24 * 60 * 60;

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
      if (!member.bannable) {
        return interaction.reply({
          content: '❌ Je n\'ai pas la permission de bannir ce membre (rôle supérieur ou permissions manquantes).',
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Vous ne pouvez pas bannir un membre ayant un rôle supérieur ou égal au vôtre.',
          ephemeral: true
        });
      }

      // Notification en MP avant le ban
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🔨 Vous avez été banni de ${interaction.guild.name}`)
            .setDescription(`**Raison :** ${reason}`)
            .setTimestamp()
        ]
      }).catch(() => {});
    }

    await interaction.deferReply({ ephemeral: true });

    await interaction.guild.bans.create(targetUser.id, {
      deleteMessageSeconds,
      reason: `${interaction.user.tag}: ${reason}`
    });

    const now = Date.now();
    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      data.sanctions.push({
        id: `ban_${now}_${Math.random().toString(36).slice(2, 7)}`,
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'BAN',
        reason,
        timestamp: now
      });
      return data;
    });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Membre Banni')
      .addFields(
        { name: 'Membre', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Messages supprimés', value: `${deleteMessageDays} jour(s)`, inline: true },
        { name: 'Raison', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(interaction.guild, embed);
  }
};
