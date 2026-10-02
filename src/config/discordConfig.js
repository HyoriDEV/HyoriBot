export const discordConfig = {
  guilds: {
    community: {
      id: '1538660424642330786',
      name: 'Hyori RP',
    },

    staff: {
      id: '1532392552660074526',
      name: 'Hyori Team',
    },

    villages: {
      grandeVille: {
        id: '1544406842682114058',
        name: 'Grande Ville',
        class: 'NOBLE',
        habitantRoleId: '1553412385941749831',
        inviteUrl: 'https://discord.gg/Y6KgkWxa9h',
      },
      peche: {
        id: '1544406589174194266',
        name: 'Village de Pêche',
        class: 'PECHEUR',
        habitantRoleId: '1544406589174194270',
        inviteUrl: 'https://discord.gg/vegcyMnbyZ',
      },
      paysans: {
        id: '1544405948049653810',
        name: 'Village des Paysans',
        class: 'PAYSAN',
        habitantRoleId: '1544405948049653814',
        inviteUrl: 'https://discord.gg/mccHxc5cxS',
      },
      mines: {
        id: '1544406205156556954',
        name: 'Village des Mines',
        class: 'MINEUR',
        habitantRoleId: '1544406205156556958',
        inviteUrl: 'https://discord.gg/s5269BqXqF',
      },
      erudits: {
        id: '1544405695523196978',
        name: 'Village des Érudits',
        class: 'ERUDIT',
        habitantRoleId: '1544405695523196982',
        inviteUrl: 'https://discord.gg/TRJ9XP3mg9',
      },
    },
  },

  roles: {
    whitelist: '1539772827618771026',
    sanctioned: '1545034091823636570',

    classes: {
      NOBLE: '1538660424726347857',
      PECHEUR: '1538660424667631684',
      PAYSAN: '1539775952354279534',
      MINEUR: '1538660424667631682',
      ERUDIT: '1538660424667631681',
    },

    staff: {
      GC: '1539770379864899684',
      COMMUNICATION: '1539770378778452029',
      RP_TRACKING: '1539770188671483935',
      EVENT: '1539770187769716746',
      DEVELOPER: '1539770187270725672',
      ADMIN: '1539770126314901635',
    },

    ticketMention: null,
    rpStaffMention: null,
  },

  channels: {
    modLogs: '1545033853809332324',
    memberLogs: '1545033895777673297',
    ticketNotifications: '1552506859670347776',
    ticketRpNotifications: '1555399133529903154',
  },
};

/**
 * Récupère la configuration d'un village à partir d'un identifiant ou libellé de classe RP.
 * @param {string} className
 * @returns {object|null}
 */
export function getVillageByClass(className) {
  if (!className) return null;
  const normalized = String(className)
    .toUpperCase()
    .replace(/^ROLE_/, '');
  return (
    Object.values(discordConfig.guilds.villages).find(v => v.class.toUpperCase() === normalized) ||
    null
  );
}

/**
 * Récupère la configuration d'un village à partir de l'identifiant du serveur (guildId).
 * @param {string} guildId
 * @returns {object|null}
 */
export function getVillageByGuildId(guildId) {
  if (!guildId) return null;
  return Object.values(discordConfig.guilds.villages).find(v => v.id === guildId) || null;
}
