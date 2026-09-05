import { EmbedBuilder } from 'discord.js';
import { timeoutsStore, warnsStore } from '../storage/index.js';
import { MuteRoleService } from './muteRoleService.js';
import { TempbanService } from './tempbanService.js';
import { sendModLog } from '../utils/modLogger.js';
import { logger } from '../logger/index.js';

export class TimeoutScheduler {
  constructor(intervalMs = 15000) {
    this.intervalMs = intervalMs;
    this.timer = null;
    this.isRunning = false;
    this.isChecking = false;
  }

  /**
   * Démarre la surveillance périodique des timeouts.
   * @param {import('discord.js').Client} client
   */
  start(client) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.client = client;

    logger.info(
      { intervalMs: this.intervalMs },
      'Démarrage du vérificateur persistant de sanctions (timeouts.json)'
    );

    // Vérification immédiate au démarrage
    this.checkExpiredTimeouts().catch(err => {
      logger.error({ err }, 'Erreur lors du premier contrôle des timeouts expirés');
    });

    this.timer = setInterval(() => {
      this.checkExpiredTimeouts().catch(err => {
        logger.error({ err }, 'Erreur lors de la vérification périodique des timeouts');
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('Vérificateur de timeouts stoppé');
  }

  /**
   * Applique un timeout customisé persistant avec rôle restrictif.
   */
  async addTimeout(guild, member, durationMs, reason, moderatorUser) {
    const role = await MuteRoleService.getOrCreateMutedRole(guild);
    await member.roles.add(role, reason);

    const now = Date.now();
    const expiresAt = now + durationMs;
    const timeoutId = `to_${now}_${Math.random().toString(36).slice(2, 7)}`;

    // Enregistrement persistant dans timeouts.json
    await timeoutsStore.update(data => {
      data.activeTimeouts = data.activeTimeouts || [];
      // Marquer comme complétés les précédents timeouts actifs du même utilisateur
      for (const t of data.activeTimeouts) {
        if (t.guildId === guild.id && t.userId === member.id && !t.completed) {
          t.completed = true;
        }
      }
      data.activeTimeouts.push({
        id: timeoutId,
        guildId: guild.id,
        userId: member.id,
        roleId: role.id,
        moderatorId: moderatorUser.id,
        reason,
        startsAt: now,
        expiresAt,
        completed: false
      });
      return data;
    });

    // Ajout dans l'historique warns.json
    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      data.sanctions.push({
        id: `sanction_${now}_${Math.random().toString(36).slice(2, 7)}`,
        guildId: guild.id,
        userId: member.id,
        moderatorId: moderatorUser.id,
        type: 'TIMEOUT',
        durationMs,
        reason,
        timestamp: now
      });
      return data;
    });

    return { timeoutId, expiresAt, role };
  }

  /**
   * Applique un tempban persistant avec rôle d'isolement (configuré via /configtempban).
   * Retire tous les rôles du membre, sauvegarde sa liste de rôles pour rerank automatique.
   */
  async addTempban(guild, member, durationMs, reason, moderatorUser) {
    const role = await TempbanService.getOrCreateTempbanRole(guild);

    // 1. Sauvegarde et retrait des rôles actuels (sauf @everyone et rôles d'intégrations de bot)
    const rolesToRemove = member.roles.cache.filter(r =>
      r.id !== guild.id &&
      !r.managed &&
      r.id !== role.id
    );
    const savedRoleIds = rolesToRemove.map(r => r.id);

    if (savedRoleIds.length > 0) {
      try {
        await member.roles.remove(
          savedRoleIds,
          `Tempban appliqué par ${moderatorUser.tag || 'Staff'} - Sauvegarde pour rerank`
        );
      } catch (err) {
        logger.warn({ memberId: member.id, err: err.message }, 'Erreur lors du retrait des rôles pour le tempban');
      }
    }

    // 2. Attribution du rôle d'isolement tempban
    await member.roles.add(role, reason);

    const now = Date.now();
    const expiresAt = now + durationMs;
    const sanctionId = `tb_${now}_${Math.random().toString(36).slice(2, 7)}`;

    await timeoutsStore.update(data => {
      data.activeTimeouts = data.activeTimeouts || [];
      for (const t of data.activeTimeouts) {
        if (t.guildId === guild.id && t.userId === member.id && !t.completed) {
          t.completed = true;
        }
      }
      data.activeTimeouts.push({
        id: sanctionId,
        type: 'TEMPBAN',
        guildId: guild.id,
        userId: member.id,
        roleId: role.id,
        savedRoleIds, // Sauvegarde pour rerank ultérieur
        moderatorId: moderatorUser.id,
        reason,
        startsAt: now,
        expiresAt,
        completed: false
      });
      return data;
    });

    await warnsStore.update(data => {
      data.sanctions = data.sanctions || [];
      data.sanctions.push({
        id: `sanction_${now}_${Math.random().toString(36).slice(2, 7)}`,
        guildId: guild.id,
        userId: member.id,
        moderatorId: moderatorUser.id,
        type: 'TEMPBAN',
        durationMs,
        reason,
        timestamp: now
      });
      return data;
    });

    return { sanctionId, expiresAt, role, savedRoleIds };
  }

  /**
   * Retire manuellement un timeout avant son terme.
   */
  async removeTimeout(guild, member, reason, moderatorUser) {
    const role = await MuteRoleService.getOrCreateMutedRole(guild);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, reason);
    }

    await timeoutsStore.update(data => {
      data.activeTimeouts = data.activeTimeouts || [];
      for (const t of data.activeTimeouts) {
        if (t.guildId === guild.id && t.userId === member.id && !t.completed) {
          t.completed = true;
          t.unmutedAt = Date.now();
          t.unmuteReason = reason;
          t.unmutedBy = moderatorUser?.id || 'SYSTEM';
        }
      }
      return data;
    });
  }

  /**
   * Retire manuellement un tempban avant son terme et rerank le membre avec ses anciens rôles.
   */
  async removeTempban(guild, member, reason, moderatorUser) {
    const role = await TempbanService.getOrCreateTempbanRole(guild);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, reason);
    }

    let rolesToRestore = [];

    await timeoutsStore.update(data => {
      data.activeTimeouts = data.activeTimeouts || [];
      for (const t of data.activeTimeouts) {
        if (t.guildId === guild.id && t.userId === member.id && !t.completed && t.type === 'TEMPBAN') {
          t.completed = true;
          t.unbannedAt = Date.now();
          t.unbanReason = reason;
          t.unbannedBy = moderatorUser?.id || 'SYSTEM';
          if (Array.isArray(t.savedRoleIds) && t.savedRoleIds.length > 0) {
            rolesToRestore = t.savedRoleIds;
          }
        }
      }
      return data;
    });

    // Rerank du joueur avec ses anciens rôles
    let restoredCount = 0;
    if (rolesToRestore.length > 0) {
      const validRoles = rolesToRestore.filter(id => guild.roles.cache.has(id));
      if (validRoles.length > 0) {
        try {
          await member.roles.add(validRoles, 'Rerank post-tempban');
          restoredCount = validRoles.length;
        } catch (err) {
          logger.warn({ memberId: member.id, err: err.message }, 'Erreur lors du rerank manuel post-tempban');
        }
      }
    }

    return { restoredCount };
  }

  /**
   * Parcourt timeouts.json et libère automatiquement les membres dont la durée est échue.
   */
  async checkExpiredTimeouts() {
    if (this.isChecking || !this.client) return;
    this.isChecking = true;

    try {
      const now = Date.now();
      const storeData = await timeoutsStore.read();
      const activeList = storeData.activeTimeouts || [];
      const expired = activeList.filter(t => !t.completed && now >= t.expiresAt);

      if (expired.length === 0) return;

      logger.info({ count: expired.length }, 'Sanctions (timeout/tempban) arrivées à expiration');

      for (const item of expired) {
        try {
          const guild = this.client.guilds.cache.get(item.guildId) ||
                        await this.client.guilds.fetch(item.guildId).catch(() => null);
          if (!guild) {
            item.completed = true;
            continue;
          }

          const member = guild.members.cache.get(item.userId) ||
                         await guild.members.fetch(item.userId).catch(() => null);

          if (member) {
            const role = guild.roles.cache.get(item.roleId) ||
                         await guild.roles.fetch(item.roleId).catch(() => null);
            const isTempban = item.type === 'TEMPBAN';
            const actionLabel = isTempban ? 'Tempban' : 'Timeout';

            if (role && member.roles.cache.has(role.id)) {
              await member.roles.remove(role, `Expiration automatique du ${actionLabel}`);
            }

            // Rerank automatique des rôles si c'est un Tempban
            let restoredCount = 0;
            if (isTempban && Array.isArray(item.savedRoleIds) && item.savedRoleIds.length > 0) {
              const validRoles = item.savedRoleIds.filter(id => guild.roles.cache.has(id));
              if (validRoles.length > 0) {
                try {
                  await member.roles.add(validRoles, 'Rerank automatique après fin du tempban');
                  restoredCount = validRoles.length;
                } catch (err) {
                  logger.warn({ memberId: member.id, err: err.message }, 'Erreur lors du rerank automatique');
                }
              }
            }

            // Log d'audit automatique dans le salon de logs
            const embed = new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle(`🔓 Fin de ${actionLabel} Automatique`)
              .setDescription(
                `Le rôle ${isTempban ? "d'isolement (Tempban)" : "restrictif (Timeout)"} a été retiré à <@${item.userId}>.` +
                (isTempban && restoredCount > 0 ? `\n✨ **Rerank :** ${restoredCount} rôle(s) restitué(s) avec succès.` : '')
              )
              .addFields(
                { name: 'Utilisateur', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                { name: 'Motif initial', value: item.reason || 'Aucun motif', inline: true },
                { name: 'Durée purgée', value: `<t:${Math.floor(item.startsAt / 1000)}:R> ➔ <t:${Math.floor(now / 1000)}:R>`, inline: false }
              )
              .setTimestamp();

            await sendModLog(guild, embed);
          }

          item.completed = true;
          item.autoExpiredAt = now;
        } catch (itemErr) {
          logger.error({ itemErr, item }, 'Erreur lors du retrait automatique du timeout');
          item.completed = true; // Évite une boucle infinie d'erreurs
        }
      }

      await timeoutsStore.write(storeData);
    } catch (error) {
      logger.error({ error }, 'Erreur dans la boucle checkExpiredTimeouts');
    } finally {
      this.isChecking = false;
    }
  }
}

export const timeoutScheduler = new TimeoutScheduler();
