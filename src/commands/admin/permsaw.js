import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../logger/index.js';

/**
 * Commande préfixe ?prefixpermsaw / ?permsaw
 * Permet de visualiser l'ensemble des permissions de chaque rôle dans tous les salons du serveur.
 */
export const permsawCommand = {
  name: 'permsaw',
  aliases: ['prefixpermsaw', 'permsall', 'permwatch'],
  description: 'Afficher les permissions de chaque rôle dans tous les salons du serveur',

  async executePrefix(message, args = []) {
    return this.execute(message, args);
  },

  async execute(message, args = []) {
    const guild = message.guild;
    if (!guild) return message.reply('❌ Cette commande doit être exécutée sur un serveur Discord.');

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Cette commande d'audit nécessite les permissions d'administrateur.");
    }

    const waitMsg = await message.reply('🔍 **Audit des permissions en cours...** Analyse de tous les rôles et salons du serveur.');

    try {
      // 1. Récupération des salons et rôles
      const channels = await guild.channels.fetch();
      const roles = await guild.roles.fetch();

      // Filtrer les salons pertinents (texte, vocal, annonce, forum, stage)
      const validChannels = channels
        .filter(c => c && !c.isThread?.() && c.type !== ChannelType.GuildCategory)
        .sort((a, b) => {
          const catA = a.parentId || '';
          const catB = b.parentId || '';
          if (catA !== catB) return catA.localeCompare(catB);
          return a.rawPosition - b.rawPosition;
        });

      // Rôles triés par position (du plus haut au plus bas), en excluant les bots/intégrations
      let targetRoles = roles
        .filter(r => !r.managed)
        .sort((a, b) => b.position - a.position);

      // Si un rôle spécifique est passé en argument (ex: ?permsaw @Modo ou ?prefixpermsaw Citoyen)
      if (args[0]) {
        const query = args.join(' ').toLowerCase().replace(/[<@&>]/g, '');
        const specificRole = targetRoles.find(r => r.id === query || r.name.toLowerCase().includes(query));
        if (specificRole) {
          targetRoles = new Map([[specificRole.id, specificRole]]);
        }
      }

      // 2. Construction du rapport complet
      const reportLines = [];
      reportLines.push(`# 🛡️ AUDIT DES PERMISSIONS PAR RÔLE & SALON — ${guild.name.toUpperCase()}`);
      reportLines.push(`> 📊 **${targetRoles.size} rôle(s)** audité(s) sur **${validChannels.size} salon(s)**.\n`);

      for (const [, role] of targetRoles) {
        const isEveryone = role.id === guild.id;
        const roleHeader = isEveryone ? '🌐 **@everyone** (Rôle de base)' : `🎭 **${role.name}** (<@&${role.id}>)`;
        reportLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        reportLines.push(`${roleHeader}`);

        if (role.permissions.has(PermissionFlagsBits.Administrator)) {
          reportLines.push(`👑 **ADMINISTRATEUR GLOBAL** : Accès universel total à l'ensemble des salons du serveur.\n`);
          continue;
        }

        const canSeeAndWrite = [];
        const canSeeOnly = [];
        const cannotSee = [];

        for (const [, ch] of validChannels) {
          const perms = ch.permissionsFor(role);
          if (!perms) continue;

          const canView = perms.has(PermissionFlagsBits.ViewChannel);
          const canSend = ch.isVoiceBased?.()
            ? perms.has(PermissionFlagsBits.Connect) && perms.has(PermissionFlagsBits.Speak)
            : perms.has(PermissionFlagsBits.SendMessages);

          if (!canView) {
            cannotSee.push(`<#${ch.id}>`);
          } else if (canSend) {
            canSeeAndWrite.push(`<#${ch.id}>`);
          } else {
            canSeeOnly.push(`<#${ch.id}>`);
          }
        }

        // Synthèse pour ce rôle
        if (canSeeAndWrite.length > 0) {
          reportLines.push(`🟢 **Accès complet (Voir + Écrire / Parler) [${canSeeAndWrite.length}] :**\n↳ ${canSeeAndWrite.join(', ')}`);
        }
        if (canSeeOnly.length > 0) {
          reportLines.push(`👁️ **Lecture seule (Voir sans écrire) [${canSeeOnly.length}] :**\n↳ ${canSeeOnly.join(', ')}`);
        }
        if (cannotSee.length > 0) {
          reportLines.push(`🔴 **Salons masqués / Interdits [${cannotSee.length}] :**\n↳ ${cannotSee.join(', ')}`);
        }
        reportLines.push('');
      }

      const fullText = reportLines.join('\n');

      // 3. Découpage intelligent (< 1850 caractères) pour envoi multi-messages sans embed
      const chunks = [];
      const lines = fullText.split('\n');
      let current = '';

      for (const line of lines) {
        if ((current + '\n' + line).length > 1850 && current.length > 0) {
          chunks.push(current);
          current = line;
        } else {
          current = current ? `${current}\n${line}` : line;
        }
      }
      if (current.trim().length > 0) chunks.push(current);

      await waitMsg.edit(`✅ **Audit terminé !** Envoi des résultats (${chunks.length} message(s))...`);

      // 4. Envoi séquentiel des messages
      for (const chunk of chunks) {
        await message.channel.send({ content: chunk });
        await new Promise(res => setTimeout(res, 350));
      }
    } catch (err) {
      logger.error({ err }, 'Erreur commande permsaw');
      return message.reply(`❌ Une erreur est survenue lors de l'audit des permissions : ${err.message}`);
    }
  }
};

export default permsawCommand;
