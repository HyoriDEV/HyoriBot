import { EmbedBuilder } from 'discord.js';
import { configStore } from '../storage/index.js';
import { sendModLog } from '../utils/modLogger.js';
import { logger } from '../logger/index.js';

class AntiRaidService {
  constructor() {
    this.guildJoins = new Map(); // guildId -> Array<timestamp>
    this.raidActive = new Map(); // guildId -> boolean
  }

  /**
   * Surveille l'arrivée massive de nouveaux membres.
   * @param {import('discord.js').GuildMember} member
   */
  async handleMemberJoin(member) {
    const guild = member.guild;
    const config = await configStore.read();
    const antiRaidConfig = config.moderation?.antiRaid;
    if (!antiRaidConfig?.enabled) return;

    const threshold = antiRaidConfig.joinThreshold || 10;
    const intervalMs = (antiRaidConfig.intervalSeconds || 10) * 1000;
    const now = Date.now();

    let joins = this.guildJoins.get(guild.id) || [];
    joins = joins.filter(t => now - t <= intervalMs);
    joins.push(now);
    this.guildJoins.set(guild.id, joins);

    if (joins.length >= threshold && !this.raidActive.get(guild.id)) {
      this.raidActive.set(guild.id, true);

      logger.warn(
        { guildId: guild.id, joinsCount: joins.length },
        'Alerte Raid déclenchée ! Détection d\'arrivées massives'
      );

      const alertEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚨 ALERTE ANTI-RAID DÉCLENCHÉE')
        .setDescription(
          `**Détection d'arrivées massives anormales :** \`${joins.length}\` membres ont rejoint le serveur en moins de ${intervalMs / 1000} secondes !`
        )
        .addFields(
          { name: 'Dernier membre entré', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: 'Mesure recommandée', value: 'Vérifiez les invitations ou activez le mode lent / pause des invitations.', inline: false }
        )
        .setTimestamp();

      await sendModLog(guild, alertEmbed);

      // Réinitialisation de l'état d'alerte après 1 minute de calme
      setTimeout(() => {
        this.raidActive.set(guild.id, false);
      }, 60000);
    }
  }
}

export const antiRaidService = new AntiRaidService();
