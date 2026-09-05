import { Events, EmbedBuilder } from 'discord.js';
import { sendAuditLog } from '../../utils/auditLogger.js';

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild || member.user.bot) return;

    let embed = null;

    // 1. Connexion à un salon vocal
    if (!oldState.channelId && newState.channelId) {
      embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔊 Connexion Vocale')
        .setDescription(`${member} a rejoint le salon vocal <#${newState.channelId}>`)
        .setAuthor({ name: `${member.user.tag} (${member.id})`, iconURL: member.user.displayAvatarURL() })
        .setTimestamp();
    }
    // 2. Déconnexion d'un salon vocal
    else if (oldState.channelId && !newState.channelId) {
      embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔇 Déconnexion Vocale')
        .setDescription(`${member} a quitté le salon vocal <#${oldState.channelId}>`)
        .setAuthor({ name: `${member.user.tag} (${member.id})`, iconURL: member.user.displayAvatarURL() })
        .setTimestamp();
    }
    // 3. Déplacement / Switch de salon vocal
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔀 Déplacement Vocal')
        .setDescription(`${member} a changé de salon vocal`)
        .setAuthor({ name: `${member.user.tag} (${member.id})`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: 'Ancien salon', value: `<#${oldState.channelId}>`, inline: true },
          { name: 'Nouveau salon', value: `<#${newState.channelId}>`, inline: true }
        )
        .setTimestamp();
    }
    // 4. Mute / Sourdine Micro et Casque
    else {
      const stateChanges = [];

      if (oldState.selfMute !== newState.selfMute) {
        stateChanges.push(newState.selfMute ? '🔇 A coupé son micro (Mute perso)' : '🎙️ A réactivé son micro');
      }
      if (oldState.serverMute !== newState.serverMute) {
        stateChanges.push(newState.serverMute ? '⚠️ A été rendu muet par un modérateur' : '✅ N\'est plus muet serveur');
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
        stateChanges.push(newState.selfDeaf ? '🎧 A coupé son casque (Sourdine perso)' : '🔊 A réactivé son casque');
      }
      if (oldState.serverDeaf !== newState.serverDeaf) {
        stateChanges.push(newState.serverDeaf ? '⚠️ Mis en sourdine par un modérateur' : '✅ N\'est plus en sourdine serveur');
      }
      if (oldState.streaming !== newState.streaming) {
        stateChanges.push(newState.streaming ? '📺 A lancé un partage d\'écran / stream' : '📺 A arrêté son partage d\'écran');
      }

      if (stateChanges.length > 0) {
        embed = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setTitle('🎙️ État Vocal Modifié')
          .setAuthor({ name: `${member.user.tag} (${member.id})`, iconURL: member.user.displayAvatarURL() })
          .setDescription(`Salon : <#${newState.channelId}>\n\n${stateChanges.map(s => `• ${s}`).join('\n')}`)
          .setTimestamp();
      }
    }

    if (embed) {
      await sendAuditLog(guild, 'voiceChannelId', embed);
    }
  }
};
