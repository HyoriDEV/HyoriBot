import {
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import ms from 'ms';
import { getEnv } from '../../config/env.js';
import { modActions } from '../moderation/modActions.js';
import { modLogService } from '../services/modLogService.js';
import { antiSpamService } from '../../services/antiSpamService.js';
import { PermissionService, PERMISSION_LEVELS } from '../../services/permissionService.js';
import { buildCmdsEmbed } from '../../commands/general/cmds.js';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { configStore } from '../../storage/index.js';
import { WelcomeCardService } from '../../services/welcomeCardService.js';
import { LogSetupService, LOG_TYPES } from '../../services/logSetupService.js';
import configtempbanCommand from '../../commands/admin/configtempban.js';
import tempbanCommand from '../../commands/moderation/tempban.js';
import untempbanCommand from '../../commands/moderation/untempban.js';
import rulesetupCommand from '../../commands/admin/rulesetup.js';
import permsawCommand from '../../commands/admin/permsaw.js';
import prefixtestallCommand from '../../commands/admin/prefixtestall.js';
import setupVocalCommand from '../../commands/admin/setup-vocal.js';
import { logger } from '../../logger/index.js';

const DISCORD_INVITE_REGEX =
  /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9_-]+/i;

export async function handleMessageCreate(message) {
  if (message.author.bot || !message.guild) return;

  // Détection et sanction Anti-Spam automatique
  await antiSpamService.handleMessage(message);

  const env = getEnv();
  const prefix = env.PREFIX || '!';
  const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

  // Filtre anti-invitations
  if (!isStaff && DISCORD_INVITE_REGEX.test(message.content)) {
    try {
      await message.delete();
      const warningMsg = await message.channel.send({
        content: `⚠️ **${message.author.tag}**, les liens d'invitations Discord ne sont pas autorisés ici.`,
      });
      setTimeout(() => warningMsg.delete().catch(() => null), 4000);

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
      return;
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to delete external invite message');
    }
  }

  // Vérification du préfixe textuel
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const getTargetMember = async arg => {
    if (!arg) return null;
    const cleanId = arg.replace(/[<@!&>]/g, '');
    return message.guild.members.fetch(cleanId).catch(() => null);
  };

  const getTargetUser = async arg => {
    if (!arg) return null;
    const cleanId = arg.replace(/[<@!>]/g, '');
    return message.client.users.fetch(cleanId).catch(() => null);
  };

  const getTargetRole = arg => {
    if (!arg) return null;
    const cleanId = arg.replace(/[<@&>]/g, '');
    return message.guild.roles.cache.get(cleanId) || message.guild.roles.cache.find(r => r.name.toLowerCase() === arg.toLowerCase()) || null;
  };

  // Contrôle des permissions personnalisées (RBAC / ACL)
  const permCheck = await PermissionService.canExecute(message.member, commandName);
  if (!permCheck.allowed) {
    return message.reply(`❌ **Accès Refusé :** ${permCheck.reason}`);
  }

  try {
    switch (commandName) {
      // ──────────────────────────────────────────────
      // 1. UTILITAIRES & INFORMATIONS
      // ──────────────────────────────────────────────
      case 'cmds':
      case 'commands': {
        const embed = await buildCmdsEmbed(message.member);
        return message.reply({ embeds: [embed] });
      }

      case 'help': {
        const result = modActions.executeHelp({ prefix });
        return message.reply({ embeds: [result.embed] });
      }

      case 'ping': {
        const sent = await message.reply('🏓 Calcul de la latence en cours...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const wsPing = message.client.ws.ping;
        return sent.edit(`🏓 **Pong !**\n• Latence API : **${latency}ms**\n• Latence WebSocket : **${wsPing}ms**`);
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
        return message.reply({ embeds: [result.embed] });
      }

      case 'serverinfo': {
        const result = await modActions.executeServerinfo({ guild: message.guild });
        if (!result.success) return message.reply(`❌ ${result.error}`);
        return message.reply({ embeds: [result.embed] });
      }

      // ──────────────────────────────────────────────
      // 2. PERMISSIONS DYNAMIQUES
      // ──────────────────────────────────────────────
      case 'setperm':
      case 'sp': {
        // Syntaxe : !sp <niveau:0-3> <@role|@membre>  OU  !sp <@role|@membre> <niveau:0-3>
        if (args.length < 2) {
          return message.reply(`❌ Utilisation : \`${prefix}sp <0-3> <@role|@membre>\` (ex: \`${prefix}sp 2 @Modérateur\` ou \`${prefix}sp 3 @Zack\`)`);
        }

        let level = parseInt(args[0], 10);
        let targetArg = args[1];

        if (isNaN(level)) {
          level = parseInt(args[1], 10);
          targetArg = args[0];
        }

        if (isNaN(level) || level < 0 || level > 3) {
          return message.reply('❌ Le niveau de permission doit être un entier entre 0 et 3 (0=Public, 1=Membre, 2=Modo, 3=Admin).');
        }

        const role = getTargetRole(targetArg);
        const memberTarget = await getTargetMember(targetArg);
        const lvlInfo = PERMISSION_LEVELS[level];

        if (role) {
          await PermissionService.setRoleLevel(role.id, level);
          const embed = new EmbedBuilder()
            .setColor(0xe9d15c)
            .setTitle('✅ Niveau de Rôle Mis à Jour')
            .setDescription(`Le rôle **${role.name}** (<@&${role.id}>) a désormais accès au **${lvlInfo.emoji} ${lvlInfo.name} (Niveau ${level})**.`)
            .setTimestamp();
          return message.reply({ embeds: [embed] });
        } else if (memberTarget) {
          await PermissionService.setUserLevel(memberTarget.id, level);
          const embed = new EmbedBuilder()
            .setColor(0xe9d15c)
            .setTitle('✅ Niveau de Membre Mis à Jour')
            .setDescription(`L'utilisateur <@${memberTarget.id}> dispose désormais du **${lvlInfo.emoji} ${lvlInfo.name} (Niveau ${level})**.`)
            .setTimestamp();
          return message.reply({ embeds: [embed] });
        } else {
          return message.reply('❌ Rôle ou membre introuvable. Mentionnez le rôle (ex: `@Modérateur`) ou le membre (ex: `@Joueur`).');
        }
      }

      case 'spr': {
        const targetArg = args[0]?.toLowerCase();
        if (!targetArg) {
          return message.reply(`❌ Utilisation : \`${prefix}spr <@role|@membre|tout>\``);
        }

        if (targetArg === 'tout' || targetArg === 'all') {
          await PermissionService.resetAll();
          return message.reply('🗑️ Toutes les attributions personnalisées de rôles et membres ont été réinitialisées.');
        }

        const role = getTargetRole(args[0]);
        const memberTarget = await getTargetMember(args[0]);

        if (role) {
          await PermissionService.removeRoleLevel(role.id);
          return message.reply(`✅ Rôle **${role.name}** réinitialisé.`);
        } else if (memberTarget) {
          await PermissionService.removeUserLevel(memberTarget.id);
          return message.reply(`✅ Membre **${memberTarget.user.tag}** réinitialisé.`);
        } else {
          return message.reply('❌ Cible introuvable (spécifiez un rôle, un membre ou `tout`).');
        }
      }

      case 'spl': {
        const all = await PermissionService.getAllPermissions();
        const rolesLines = Object.entries(all.roles || {}).map(([id, lvl]) => {
          const lvlInfo = PERMISSION_LEVELS[lvl] || { emoji: '❓', name: `Niveau ${lvl}` };
          return `• <@&${id}> : **${lvlInfo.emoji} ${lvlInfo.name} (Niv. ${lvl})**`;
        });
        const usersLines = Object.entries(all.users || {}).map(([id, lvl]) => {
          const lvlInfo = PERMISSION_LEVELS[lvl] || { emoji: '❓', name: `Niveau ${lvl}` };
          return `• <@${id}> : **${lvlInfo.emoji} ${lvlInfo.name} (Niv. ${lvl})**`;
        });

        const embed = new EmbedBuilder()
          .setColor(0xe9d15c)
          .setTitle('🛡️ Répertoire des Permissions Hyori Bot')
          .addFields(
            { name: '🎭 Rôles Configurés', value: rolesLines.length > 0 ? rolesLines.join('\n') : '*Aucun rôle spécifique*', inline: false },
            { name: '👤 Membres Configurés', value: usersLines.length > 0 ? usersLines.join('\n') : '*Aucun membre spécifique*', inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      case 'setperm-cmds': {
        return message.reply('💡 Pour utiliser le panneau interactif en direct avec boutons, utilisez la slash command : **/setperm-cmds**');
      }

      case 'permsaw':
      case 'prefixpermsaw': {
        return permsawCommand.execute(message, args);
      }

      case 'prefixtestall':
      case 'testall': {
        return prefixtestallCommand.execute(message, args);
      }

      // ──────────────────────────────────────────────
      // 3. DÉPLOIEMENT & LOGS
      // ──────────────────────────────────────────────
      case 'setup-logs': {
        const actionArg = args[0]?.toLowerCase();
        if (actionArg === 'create' || actionArg === 'all') {
          const sent = await message.reply('🚀 Création de la catégorie et des 12 salons de logs en cours...');
          const { category, results } = await LogSetupService.setupChannels(message.guild, null);
          return sent.edit(`✅ **Déploiement terminé !** ${results.length} salons de surveillance créés dans la catégorie **${category.name}**.`);
        }

        return message.reply(`💡 Tapez \`${prefix}setup-logs all\` pour tout générer directement, ou utilisez **/setup-logs** pour ouvrir l'assistant interactif avec boutons.`);
      }

      case 'config-logs': {
        const sub = args[0]?.toLowerCase();
        const config = await configStore.read().catch(() => ({}));
        const logs = config.logs || {};

        if (sub === 'view' || !sub) {
          const statusLines = LOG_TYPES.map(t => {
            const id = logs[t.key];
            return `${t.emoji} **${t.name}** : ${id ? `<#${id}>` : '*Non configuré*'}`;
          });
          const embed = new EmbedBuilder()
            .setColor(0xe9d15c)
            .setTitle('📑 Salons de Logs Configurés')
            .setDescription(statusLines.join('\n'))
            .setTimestamp();
          return message.reply({ embeds: [embed] });
        }

        return message.reply(`💡 Utilisez \`${prefix}config-logs view\` ou la commande slash **/config-logs**.`);
      }

      case 'config-welcome': {
        const sub = args[0]?.toLowerCase();

        if (sub === 'test') {
          const sent = await message.reply('🎨 Génération de votre carte de bienvenue en cours...');
          const cardBuffer = await WelcomeCardService.generateWelcomeCard(message.member);
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-hyori.png' });
          return sent.edit({
            content: `Bienvenue sur **Hyori RP**, <@${message.author.id}> !`,
            files: [attachment]
          });
        }

        if (sub === 'channel' && args[1]) {
          const cleanId = args[1].replace(/[<#>]/g, '');
          const channel = message.guild.channels.cache.get(cleanId);
          if (!channel) return message.reply('❌ Salon introuvable.');

          await configStore.update(data => {
            data.welcome = data.welcome || {};
            data.welcome.channelId = channel.id;
            data.welcome.enabled = true;
            return data;
          });
          return message.reply(`✅ Salon de bienvenue configuré sur <#${channel.id}>.`);
        }

        return message.reply(`💡 Commandes : \`${prefix}config-welcome test\` ou \`${prefix}config-welcome channel #salon\`.`);
      }

      case 'configtempban':
      case 'config-tempban': {
        return configtempbanCommand.execute(message, args);
      }

      case 'rulesetup': {
        return rulesetupCommand.execute(message, args);
      }

      case 'setup-vocal':
      case 'setupvocal':
      case 'config-vocal':
      case 'jointocreate': {
        return setupVocalCommand.execute(message, args);
      }

      // ──────────────────────────────────────────────
      // 4. GESTION DES SALONS & CHAT
      // ──────────────────────────────────────────────
      case 'clear':
      case 'purge': {
        let amount = 10;
        let filterUserArg = null;
        if (args[0]) {
          const parsed = parseInt(args[0], 10);
          if (!isNaN(parsed)) {
            amount = Math.min(Math.max(parsed, 1), 100);
            filterUserArg = args[1];
          } else {
            filterUserArg = args[0];
          }
        }
        const filterUser = filterUserArg ? await getTargetUser(filterUserArg) : null;
        await message.delete().catch(() => null);

        const result = await modActions.executeClear({
          channel: message.channel,
          moderator: message.author,
          amount,
          filterUser,
          commandName,
        });

        const replyMsg = await message.channel.send(result.success ? result.message : `❌ ${result.error}`);
        setTimeout(() => replyMsg.delete().catch(() => null), 4000);
        return;
      }

      case 'lock': {
        const reason = args.join(' ') || 'Salon verrouillé par la modération';
        const result = await modActions.executeLock({
          channel: message.channel,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }

      case 'unlock': {
        const result = await modActions.executeUnlock({
          channel: message.channel,
          moderator: message.author,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }

      case 'slowmode': {
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

      // ──────────────────────────────────────────────
      // 5. MODÉRATION & SANCTIONS
      // ──────────────────────────────────────────────
      case 'timeout': {
        const memberArg = args[0];
        const durationArg = args[1];
        const reason = args.slice(2).join(' ') || 'Non précisé';

        if (!memberArg || !durationArg) {
          return message.reply(`❌ Utilisation : \`${prefix}timeout <@membre|ID> <durée> [motif]\` (ex: \`${prefix}timeout @joueur 1h Spam\`)`);
        }

        const durationMs = ms(durationArg);
        if (!durationMs || durationMs < 1000) {
          return message.reply('❌ Format de durée invalide. Exemples : `10m`, `1h`, `1d`.');
        }

        const targetMember = await getTargetMember(memberArg);
        if (!targetMember) return message.reply('❌ Membre introuvable.');

        await timeoutScheduler.applyTimeout({
          guild: message.guild,
          member: targetMember,
          moderator: message.author,
          durationMs,
          reason,
        });

        const sentTimeout = await message.reply(`⏳ **${targetMember.user.tag}** a été mis en timeout pour **${durationArg}**.\n> **Motif :** ${reason}`);
        setTimeout(() => {
          sentTimeout.delete().catch(() => {});
          message.delete().catch(() => {});
        }, 2000);
        return;
      }

      case 'untimeout': {
        const memberArg = args[0];
        const reason = args.slice(1).join(' ') || 'Levée manuelle';
        if (!memberArg) return message.reply(`❌ Utilisation : \`${prefix}untimeout <@membre|ID> [motif]\``);

        const targetMember = await getTargetMember(memberArg);
        if (!targetMember) return message.reply('❌ Membre introuvable.');

        await timeoutScheduler.removeTimeout(message.guild, targetMember.id, `Levé par ${message.author.tag} (${reason})`);
        return message.reply(`🔊 Le timeout de **${targetMember.user.tag}** a été levé avec succès.`);
      }

      case 'tempban':
      case 'to':
      case 'tb': {
        return tempbanCommand.execute(message, args);
      }

      case 'untempban':
      case 'unto':
      case 'untb': {
        return untempbanCommand.execute(message, args);
      }

      case 'mute': {
        const memberArg = args[0];
        const durationArg = args[1];
        const reason = args.slice(2).join(' ') || 'Non précisé';
        if (!memberArg || !durationArg) {
          return message.reply(`❌ Utilisation : \`${prefix}mute <@membre|ID> <durée> [motif]\``);
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
        const memberArg = args[0];
        const reason = args.slice(1).join(' ') || 'Levée manuelle';
        if (!memberArg) return message.reply(`❌ Utilisation : \`${prefix}unmute <@membre|ID> [motif]\``);
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
        const memberArg = args[0];
        const reason = args.slice(1).join(' ') || 'Non précisé';
        if (!memberArg) return message.reply(`❌ Utilisation : \`${prefix}kick <@membre|ID> [motif]\``);
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
        const userArg = args[0];
        if (!userArg) return message.reply(`❌ Utilisation : \`${prefix}ban <@utilisateur|ID> <motif> [purge_jours]\``);
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
        const userId = args[0];
        const reason = args.slice(1).join(' ') || 'Débannissement manuel';
        if (!userId) return message.reply(`❌ Utilisation : \`${prefix}unban <ID_Discord> [motif]\``);
        const result = await modActions.executeUnban({
          guild: message.guild,
          userId,
          moderator: message.author,
          reason,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }

      case 'warn': {
        const userArg = args[0];
        const reason = args.slice(1).join(' ');
        if (!userArg || !reason) return message.reply(`❌ Utilisation : \`${prefix}warn <@utilisateur|ID> <motif>\``);
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
        const userArg = args[0] || message.author.id;
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeWarnlist({ targetUser });
        if (!result.success) return message.reply(`❌ ${result.error}`);
        return message.reply({ embeds: [result.embed] });
      }

      case 'clearwarns': {
        const userArg = args[0];
        if (!userArg) return message.reply(`❌ Utilisation : \`${prefix}clearwarns <@utilisateur|ID>\``);
        const targetUser = await getTargetUser(userArg);
        const result = await modActions.executeClearwarns({
          guild: message.guild,
          targetUser,
          moderator: message.author,
        });
        return message.reply(result.success ? result.message : `❌ ${result.error}`);
      }

      default:
        break;
    }
  } catch (error) {
    logger.error({ error, commandName }, 'Error executing prefix command');
    return message.reply("❌ Une erreur est survenue lors de l'exécution de cette commande.");
  }
}
