import { Events, EmbedBuilder } from 'discord.js';
import { antiRaidService } from '../../services/antiRaidService.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // 1. Contrôle Anti-Raid
    await antiRaidService.handleMemberJoin(member);

    // 2. Calcul précis de l'âge du compte Discord
    const createdTimestamp = member.user.createdTimestamp;
    const now = Date.now();
    const ageMs = now - createdTimestamp;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const isSuspicious = ageDays < 7; // Seuil d'alerte pour double-compte ou bot

    const embed = new EmbedBuilder()
      .setColor(isSuspicious ? 0xED4245 : 0x57F287)
      .setTitle(isSuspicious ? '⚠️ Arrivée d\'un Membre [COMPTE RÉCENT]' : '📥 Arrivée d\'un Membre')
      .setAuthor({
        name: `${member.user.tag} (${member.id})`,
        iconURL: member.user.displayAvatarURL()
      })
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Création du compte', value: `<t:${Math.floor(createdTimestamp / 1000)}:F> (<t:${Math.floor(createdTimestamp / 1000)}:R>)`, inline: false },
        { name: 'Âge exact du compte', value: `\`${ageDays} jour(s) et ${ageHours} heure(s)\``, inline: true },
        { name: 'Compte suspect / Double-compte ?', value: isSuspicious ? '🚨 **OUI (Créé il y a moins de 7 jours)**' : '✅ Non (Compte ancien)', inline: true },
        { name: 'Membres totaux', value: `\`${member.guild.memberCount}\``, inline: true }
      )
      .setTimestamp();

    await sendAuditLog(member.guild, 'membersChannelId', embed);
  }
};
