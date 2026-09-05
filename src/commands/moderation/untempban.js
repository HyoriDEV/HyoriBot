import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { sendModLog } from '../../utils/modLogger.js';

export const untempbanCommand = {
  data: new SlashCommandBuilder()
    .setName('untempban')
    .setDescription('Lever le tempban / isolement d\'un membre avant son expiration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à libérer du tempban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la levée de sanction')
        .setRequired(false)
    ),

  async execute(interactionOrMessage, args = []) {
    const isInteraction = typeof interactionOrMessage.isCommand === 'function' || interactionOrMessage.isChatInputCommand?.();
    const guild = interactionOrMessage.guild;
    const author = isInteraction ? interactionOrMessage.user : interactionOrMessage.author;

    if (!guild) {
      const err = '❌ Cette commande doit être exécutée sur un serveur.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    let targetUser, reason;

    if (isInteraction) {
      targetUser = interactionOrMessage.options.getUser('membre');
      reason = interactionOrMessage.options.getString('raison') || 'Levée manuelle par le staff';
    } else {
      if (!args[0]) {
        return interactionOrMessage.reply('❌ Utilisation : `?untempban <@membre|ID> [raison...]`');
      }
      const targetId = args[0].replace(/[<@!>]/g, '');
      targetUser = await interactionOrMessage.client.users.fetch(targetId).catch(() => null);
      reason = args.slice(1).join(' ') || 'Levée manuelle par le staff';
    }

    if (!targetUser) {
      const err = '❌ Membre introuvable.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      const err = '❌ Ce membre n\'est pas sur le serveur.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (isInteraction) await interactionOrMessage.deferReply();

    try {
      const { restoredCount } = await timeoutScheduler.removeTempban(guild, member, reason, author);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Tempban Levé & Rerank Effectué')
        .setDescription(
          `Le rôle d'isolement a été retiré à ${member}. Le membre retrouve ses accès normaux.` +
          (restoredCount > 0 ? `\n✨ **Rerank automatique :** **${restoredCount} rôle(s)** ont été restitués avec succès.` : '')
        )
        .addFields(
          { name: '👤 Membre', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: '🛡️ Modérateur', value: `${author.tag}`, inline: true },
          { name: '📝 Motif', value: reason, inline: false }
        )
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
      const errTxt = `❌ Une erreur est survenue lors du dé-tempban : ${err.message}`;
      if (isInteraction) {
        await interactionOrMessage.editReply({ content: errTxt });
      } else {
        await interactionOrMessage.reply(errTxt);
      }
    }
  }
};

export const untoCommand = {
  data: new SlashCommandBuilder()
    .setName('unto')
    .setDescription('(Raccourci /untempban) Lever le tempban d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Le membre à libérer du tempban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la levée de sanction')
        .setRequired(false)
    ),
  execute: untempbanCommand.execute
};

export default untempbanCommand;
