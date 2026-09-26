/**
 * =============================================================================
 * HYORI RP — Configuration Discord (Serveurs, Rôles, Salons)
 * =============================================================================
 *
 * Source de vérité UNIQUE pour tous les identifiants Discord (guildes, rôles,
 * salons) utilisés par HyoriBot. Ces identifiants ne sont pas des secrets :
 * ils sont donc versionnés ici en clair plutôt que dans le `.env`.
 *
 * Pour modifier un ID (nouveau serveur, rôle recréé, salon déplacé...),
 * éditez directement la valeur correspondante ci-dessous.
 *
 * Les vraies clés secrètes (token du bot, clé API interne...) restent dans
 * le `.env`, voir `src/config/env.js`.
 */

export const discordConfig = {
  // ---------------------------------------------------------------------------
  // 1. SERVEURS DISCORD (GUILDS)
  // ---------------------------------------------------------------------------
  guilds: {
    // Serveur Communautaire (Hyori RP : accueil des joueurs, source de vérité des rôles)
    community: {
      id: '1538660424642330786',
      name: 'Hyori RP',
    },

    // Serveur Staff (Hyori Team : équipe staff, alertes tickets, pas de modération joueur ni de gatekeeping)
    staff: {
      id: '', // Non créé pour le moment
      name: 'Hyori Team',
    },

    // Les 5 Serveurs de Villages (groupes de joueurs : modération + logs uniformes + gatekeeping strict)
    villages: {
      grandeVille: {
        id: '', // Non créé pour le moment
        name: 'Grande Ville',
        class: 'NOBLE',
        habitantRoleId: '', // Rôle "Habitant" attribué à l'entrée, à renseigner
      },
      peche: {
        id: '', // Non créé pour le moment
        name: 'Village de Pêche',
        class: 'PECHEUR',
        habitantRoleId: '', // Rôle "Habitant" attribué à l'entrée, à renseigner
      },
      paysans: {
        id: '', // Non créé pour le moment
        name: 'Village des Paysans',
        class: 'PAYSAN',
        habitantRoleId: '', // Rôle "Habitant" attribué à l'entrée, à renseigner
      },
      mines: {
        id: '', // Non créé pour le moment
        name: 'Village des Mines',
        class: 'MINEUR',
        habitantRoleId: '', // Rôle "Habitant" attribué à l'entrée, à renseigner
      },
      erudits: {
        id: '', // Non créé pour le moment
        name: 'Village des Érudits',
        class: 'ERUDIT',
        habitantRoleId: '', // Rôle "Habitant" attribué à l'entrée, à renseigner
      },
    },
  },

  // ---------------------------------------------------------------------------
  // 2. RÔLES DU SERVEUR COMMUNAUTAIRE (Hyori RP)
  // ---------------------------------------------------------------------------
  roles: {
    // Statut Whitelist & Sanctionné
    whitelist: '1539772827618771026',
    sanctioned: '1545034091823636570',

    // Classes RP attribuées
    classes: {
      NOBLE: '1538660424726347857',
      PECHEUR: '1538660424667631684',
      PAYSAN: '1539775952354279534',
      MINEUR: '1538660424667631682',
      ERUDIT: '1538660424667631681',
    },

    // Rôles Staff
    staff: {
      GC: '1539770379864899684',
      COMMUNICATION: '1539770378778452029',
      RP_TRACKING: '1539770188671483935',
      EVENT: '1539770187769716746',
      DEVELOPER: '1539770187270725672',
      ADMIN: '1539770126314901635',
    },

    // Rôle mentionné pour les alertes de tickets (situé sur le serveur Staff)
    ticketMention: '1552510616869015604',
  },

  // ---------------------------------------------------------------------------
  // 3. SALONS DE JOURNALISATION & NOTIFICATIONS
  // ---------------------------------------------------------------------------
  channels: {
    // Salons de logs par défaut du serveur communautaire (si non créés dynamiquement via /config-logs)
    modLogs: '1545033853809332324',
    memberLogs: '1545033895777673297',

    // Salon des alertes de tickets (situé sur le serveur Staff)
    ticketNotifications: '1552506859670347776',
  },
};
