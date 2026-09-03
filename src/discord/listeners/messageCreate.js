import { PermissionFlagsBits } from 'discord.js';
import { getEnv } from '../../config/env.js';
import { modActions } from '../moderation/modActions.js';
import { modLogService } from '../services/modLogService.js';
import { logger } from '../../logger/index.js';
const DISCORD_INVITE_REGEX =
  /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9_-]+/i;
export async function handleMessageCreate(message) {
  if (message.author.bot || !message.guild) return;
  const env = getEnv();
  const prefix = env.PREFIX || '!';
  const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
  if (!isStaff && DISCORD_INVITE_REGEX.test(message.content)) {
    try {
      await message.delete();
      const warningMsg = await message.channel.send({
        content: `⚠️ **${message.author.tag}**, les liens d'invitations Discord ne sont pas autorisés ici.`,
      });
      setTimeout(() => warningMsg.delete().catch(() => null), 4000);

      // Log to moderation channel
      await modLogService.sendModLog({
        guild: message.guild,
        action: 'AUTOMOD (LIEN DISCORD)',
        target: message.author,
        moderator: { tag: 'AutoMod (HyoriBot)', id: message.client.user.id },
        reason: "Tentative d'envoi d'un lien d'invitation Discord externe",
        extraFields: [
          {
            name: 'Salon',
            value: `<#${message.channel.id}> (\`#${message.channel.name}\`)`,
            inline: true,
          },
          { name: 'Contenu intercepté', value: message.content.slice(0, 1024), inline: false },
        ],
      });

      logger.info(
        {
          userId: message.author.id,
          guildId: message.guild.id,
        },
        'AutoMod blocked external Discord invite link'
      );
      return;
    } catch (err) {
      logger.warn(
        {
          error: err.message,
        },
        'Failed to delete external invite message'
      );
    }
  }
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;
  const getTargetMember = async arg => {
    if (!arg) return null;
    const cleanId = arg.replace(/[<@!>]/g, '');
    return message.guild.members.fetch(cleanId).catch(() => null);
  };
  const getTargetUser = async arg => {
    if (!arg) return null;
    const cleanId = arg.replace(/[<@!>]/g, '');
    return message.client.users.fetch(cleanId).catch(() => null);
  };
  try {
    switch (commandName) {
      case 'mute': {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");
        }
        const memberArg = args[0];
        const durationArg = args[1];
        const reason = args.slice(2).join(' ') || 'Non précisé';
        if (!memberArg || !durationArg) {
          return message.reply(
            `❌ Utilisation : \`${prefix}mute <@utilisateur|ID> <durée> [motif]\` (ex: \`${prefix}mute @joueur 1h Spam\`)`
          );
        }
        const targetMember = await getTargetMember(memberArg);
        const result = await modActions.executeMute({
          guild: message.guild,
          targetMember,
          moderator: message.author,
          durationStr: durationArg,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'unmute': {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");
        }
        const memberArg = args[0];
        const reason = args.slice(1).join(' ') || 'Levée manuelle';
        if (!memberArg) {
          return message.reply(`❌ Utilisation : \`${prefix}unmute <@utilisateur|ID> [motif]\``);
        }
        const targetMember = await getTargetMember(memberArg);
        const result = await modActions.executeUnmute({
          guild: message.guild,
          targetMember,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'kick': {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
          return message.reply("❌ Tu n'as pas la permission d'expulser des membres.");
        }
        const memberArg = args[0];
        const reason = args.slice(1).join(' ') || 'Non précisé';
        if (!memberArg) {
          return message.reply(`❌ Utilisation : \`${prefix}kick <@utilisateur|ID> [motif]\``);
        }
        const targetMember = await getTargetMember(memberArg);
        const result = await modActions.executeKick({
          guild: message.guild,
          targetMember,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'ban': {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return message.reply("❌ Tu n'as pas la permission de bannir des membres.");
        }
        const userArg = args[0];
        if (!userArg) {
          return message.reply(
            `❌ Utilisation : \`${prefix}ban <@utilisateur|ID> <motif> [purge_jours 0-7]\``
          );
        }
        let purgeDays = 0;
        let reason = args.slice(1).join(' ');
        const lastArgNum = parseInt(args[args.length - 1], 10);
        if (!isNaN(lastArgNum) && lastArgNum >= 0 && lastArgNum <= 7 && args.length > 2) {
          purgeDays = lastArgNum;
          reason = args.slice(1, -1).join(' ');
        }
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeBan({
          guild: message.guild,
          targetUser,
          moderator: message.author,
          reason: reason || 'Non précisé',
          purgeDays,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'unban': {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return message.reply("❌ Tu n'as pas la permission de débannir des membres.");
        }
        const userId = args[0];
        const reason = args.slice(1).join(' ') || 'Débannissement manuel';
        if (!userId) {
          return message.reply(`❌ Utilisation : \`${prefix}unban <ID_Discord> [motif]\``);
        }
        const result = await modActions.executeUnban({
          guild: message.guild,
          userId,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'clear':
      case 'purge': {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply("❌ Tu n'as pas la permission de gérer les messages.");
        }
        const amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 50) {
          return message.reply(
            `❌ Utilisation : \`${prefix}clear <1-50> [@utilisateur optionnel]\``
          );
        }
        const filterUser = args[1] ? await getTargetUser(args[1]) : null;
        await message.delete().catch(() => null);
        const result = await modActions.executeClear({
          channel: message.channel,
          moderator: message.author,
          amount,
          filterUser,
        });
        const replyMsg = await message.channel.send(
          result.success ? result.message : `❌ ${result.error}`
        );
        setTimeout(() => replyMsg.delete().catch(() => null), 4000);
        return;
      }
      case 'lock': {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ Tu n'as pas la permission de gérer les salons.");
        }
        const reason = args.join(' ') || 'Salon verrouillé par la modération';
        const result = await modActions.executeLock({
          channel: message.channel,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'unlock': {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ Tu n'as pas la permission de gérer les salons.");
        }
        const result = await modActions.executeUnlock({
          channel: message.channel,
          moderator: message.author,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'slowmode': {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ Tu n'as pas la permission de gérer les salons.");
        }
        const secArg = args[0]?.toLowerCase();
        let seconds = 0;
        if (secArg && secArg !== 'off' && secArg !== '0') {
          seconds = parseInt(secArg, 10);
          if (isNaN(seconds)) seconds = 10;
        }
        const result = await modActions.executeSlowmode({
          channel: message.channel,
          moderator: message.author,
          seconds,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'warn': {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply("❌ Tu n'as pas la permission d'avertir des membres.");
        }
        const userArg = args[0];
        const reason = args.slice(1).join(' ');
        if (!userArg || !reason) {
          return message.reply(`❌ Utilisation : \`${prefix}warn <@utilisateur|ID> <motif>\``);
        }
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeWarn({
          guild: message.guild,
          targetUser,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'warns':
      case 'warnlist': {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply("❌ Tu n'as pas la permission de consulter les avertissements.");
        }
        const userArg = args[0] || message.author.id;
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeWarnlist({
          targetUser,
        });
        if (!result.success) return message.reply(`❌ ${result.error}`);
        return message.reply({
          embeds: [result.embed],
        });
      }
      case 'clearwarns': {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply("❌ Tu n'as pas la permission d'effacer les avertissements.");
        }
        const userArg = args[0];
        if (!userArg) {
          return message.reply(`❌ Utilisation : \`${prefix}clearwarns <@utilisateur|ID>\``);
        }
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeClearwarns({
          guild: message.guild,
          targetUser,
          moderator: message.author,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }
      case 'userinfo':
      case 'whois': {
        const userArg = args[0] || message.author.id;
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeUserinfo({
          guild: message.guild,
          targetUser,
        });
        if (!result.success) return message.reply(`❌ ${result.error}`);
        return message.reply({
          embeds: [result.embed],
        });
      }
      case 'serverinfo': {
        const result = await modActions.executeServerinfo({
          guild: message.guild,
        });
        if (!result.success) return message.reply(`❌ ${result.error}`);
        return message.reply({
          embeds: [result.embed],
        });
      }
      case 'help': {
        const result = modActions.executeHelp({
          prefix,
        });
        return message.reply({
          embeds: [result.embed],
        });
      }
      default:
        break;
    }
  } catch (error) {
    logger.error(
      {
        error,
        commandName,
      },
      'Error executing prefix command'
    );
    return message.reply("❌ Une erreur est survenue lors de l'exécution de cette commande.");
  }
}
