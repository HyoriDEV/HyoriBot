import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import ms from 'ms';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { sendModLog } from '../../utils/modLogger.js';

export const tempbanCommand = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannir temporairement un membre avec isolement sur les salons autorisés')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à sanctionner')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('duree')
        .setDescription('Durée du tempban (ex: 12h, 1d, 7d, 30d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la sanction')
        .setRequired(false)
    ),

  async execute(interactionOrMessage, args = []) {
    const isInteraction = typeof interactionOrMessage.isCommand === 'function' || interactionOrMessage.isChatInputCommand?.();
    const guild = interactionOrMessage.guild;
    const author = isInteraction ? interactionOrMessage.user : interactionOrMessage.author;
    const authorMember = isInteraction ? interactionOrMessage.member : interactionOrMessage.member;

    if (!guild) {
      const err = '❌ Cette commande doit être exécutée sur un serveur.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    let targetUser, durationInput, reason;

    if (isInteraction) {
      targetUser = interactionOrMessage.options.getUser('membre');
      durationInput = interactionOrMessage.options.getString('duree');
      reason = interactionOrMessage.options.getString('raison') || 'Aucun motif spécifié';
    } else {
      if (!args[0] || !args[1]) {
        return interactionOrMessage.reply('❌ Utilisation : `?tempban <@membre|ID> <durée (ex: 1d, 7d)> [raison...]`');
      }
      const targetId = args[0].replace(/[<@!>]/g, '');
      targetUser = await interactionOrMessage.client.users.fetch(targetId).catch(() => null);
      durationInput = args[1];
      reason = args.slice(2).join(' ') || 'Aucun motif spécifié';
    }

    if (!targetUser) {
      const err = '❌ Membre introuvable.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 60000 || durationMs > 365 * 24 * 60 * 60 * 1000) {
      const err = '❌ Format de durée invalide. Exemples : `1h`, `12h`, `1d`, `7d`, `30d` (minimum 1 minute, maximum 365 jours).';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      const err = '❌ Ce membre n\'est pas présent sur le serveur.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (member.id === author.id) {
      const err = '❌ Vous ne pouvez pas vous bannir temporairement vous-même.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (member.id === interactionOrMessage.client.user.id) {
      const err = '❌ Je ne peux pas m\'appliquer cette sanction.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (
      authorMember &&
      member.roles.highest.position >= authorMember.roles.highest.position &&
      author.id !== guild.ownerId
    ) {
      const err = '❌ Vous ne pouvez pas sanctionner un membre ayant un rôle supérieur ou égal au vôtre.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (isInteraction) await interactionOrMessage.deferReply();

    try {
      const { expiresAt, role, savedRoleIds } = await timeoutScheduler.addTempban(
        guild,
        member,
        durationMs,
        reason,
        author
      );

      // Notification en message privé
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`⚖️ Notification de Sanction — ${guild.name}`)
            .setDescription(`Vous avez été **temporairement banni (isolé)** sur **${guild.name}**. Vos rôles ont été temporairement retirés et vous seront restitués à la fin de votre sanction.`)
            .addFields(
              { name: 'Motif', value: reason },
              { name: 'Durée', value: `\`${durationInput}\``, inline: true },
              { name: 'Fin de la sanction', value: `<t:${Math.floor(expiresAt / 1000)}:F> (<t:${Math.floor(expiresAt / 1000)}:R>)`, inline: true }
            )
            .setFooter({ text: 'Si vous avez accès à un salon de réclamation, vous pouvez y échanger avec l\'équipe.' })
            .setTimestamp()
        ]
      }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⚖️ Membre Temporairement Banni (Tempban)')
        .setDescription(
          `Le membre ${member} a reçu le rôle d'isolement <@&${role.id}>.\n` +
          `🔒 **Rôles retirés :** ${savedRoleIds.length} rôle(s) sauvegardé(s) pour rerank automatique à la fin du tempban.`
        )
        .addFields(
          { name: '👤 Membre', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: '🛡️ Modérateur', value: `${author.tag}`, inline: true },
          { name: '⏳ Durée', value: `\`${durationInput}\``, inline: true },
          { name: '🔓 Expiration', value: `<t:${Math.floor(expiresAt / 1000)}:F> (<t:${Math.floor(expiresAt / 1000)}:R>)`, inline: true },
          { name: '📝 Raison', value: reason, inline: false }
        )
        .setFooter({ text: 'Hyori RP • Modération & Sécurité' })
        .setTimestamp();

      if (isInteraction) {
        await interactionOrMessage.editReply({ embeds: [embed] });
        setTimeout(() => {
          interactionOrMessage.deleteReply().catch(() => {});
        }, 2000);
      } else {
        const sentReply = await interactionOrMessage.reply({ embeds: [embed] });
        setTimeout(() => {
          sentReply.delete().catch(() => {});
          interactionOrMessage.delete().catch(() => {});
        }, 2000);
      }

      await sendModLog(guild, embed);
    } catch (err) {
      const errTxt = `❌ Une erreur est survenue lors du tempban : ${err.message}`;
      if (isInteraction) {
        await interactionOrMessage.editReply({ content: errTxt });
      } else {
        await interactionOrMessage.reply(errTxt);
      }
    }
  }
};

export const toCommand = {
  data: new SlashCommandBuilder()
    .setName('to')
    .setDescription('(Raccourci /tempban) Bannir temporairement un membre avec rôle d\'isolement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à sanctionner')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('duree')
        .setDescription('Durée du tempban (ex: 12h, 1d, 7d, 30d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la sanction')
        .setRequired(false)
    ),
  execute: tempbanCommand.execute
};

export default tempbanCommand;
