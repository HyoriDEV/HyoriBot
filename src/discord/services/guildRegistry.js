import { discordConfig } from '../../config/discordConfig.js';

/**
 * Service centralisant la cartographie des 7 serveurs Discord du projet Hyori RP.
 */
export class GuildRegistry {
  /**
   * Retourne l'identifiant du serveur communautaire (Hyori RP).
   */
  static getCommunityGuildId() {
    return discordConfig.guilds.community.id;
  }

  /**
   * Retourne l'identifiant du serveur staff (Hyori Team).
   */
  static getStaffGuildId() {
    return discordConfig.guilds.staff.id || null;
  }

  /**
   * Retourne la définition de tous les villages avec leur ID, classe et rôles requis.
   */
  static getVillages() {
    return Object.values(discordConfig.guilds.villages).filter(v => Boolean(v.id));
  }

  /**
   * Détermine si le serveur est le serveur communautaire Hyori RP.
   */
  static isCommunityGuild(guildId) {
    if (!guildId) return false;
    return guildId === this.getCommunityGuildId();
  }

  /**
   * Détermine si le serveur est le serveur staff Hyori Team.
   */
  static isStaffGuild(guildId) {
    if (!guildId) return false;
    const staffId = this.getStaffGuildId();
    return Boolean(staffId && guildId === staffId);
  }

  /**
   * Détermine si le serveur est l'un des 5 serveurs de villages.
   */
  static isVillageGuild(guildId) {
    if (!guildId) return false;
    return this.getVillages().some(v => v.id === guildId);
  }

  /**
   * Détermine si le serveur est un serveur accueillant des joueurs
   * (soit Hyori RP, soit l'un des 5 villages).
   * Sur ces 6 serveurs, toutes les fonctionnalités de modération et de logging sont actives.
   */
  static isPlayerGuild(guildId) {
    if (!guildId) return false;
    return this.isCommunityGuild(guildId) || this.isVillageGuild(guildId);
  }

  /**
   * Récupère la configuration de village pour un guildId donné.
   */
  static getVillageConfig(guildId) {
    if (!guildId) return null;
    return this.getVillages().find(v => v.id === guildId) || null;
  }

  /**
   * Retourne la liste de tous les IDs des serveurs joueurs (Hyori RP + villages configurés).
   */
  static getPlayerGuildIds() {
    const list = [];
    const communityId = this.getCommunityGuildId();
    if (communityId) list.push(communityId);

    for (const v of this.getVillages()) {
      if (v.id && !list.includes(v.id)) {
        list.push(v.id);
      }
    }
    return list;
  }
}
