import { createCanvas, loadImage } from '@napi-rs/canvas';
import { logger } from '../logger/index.js';

export class WelcomeCardService {
  /**
   * Helper pour dessiner un rectangle à coins arrondis
   */
  static roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Dessine la trame géométrique sobre et architecturale (lignes dorées fines à 45°)
   * exactement selon la DA de référence (media_1788610087800)
   */
  static drawGeometricBackground(ctx, width, height) {
    ctx.save();
    
    // Grille de losanges dorés fins (#d4af35)
    const spacing = 75;
    ctx.lineWidth = 1.5;

    // Diagonales principales (45°)
    ctx.strokeStyle = 'rgba(212, 175, 53, 0.16)';
    for (let x = -height; x < width + height; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }

    // Diagonales croisées (135°)
    ctx.strokeStyle = 'rgba(212, 175, 53, 0.10)';
    for (let x = -height; x < width + height; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + height, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Génère la carte de bienvenue avec le fond géométrique & sobre de la marque Hyori
   * @param {import('discord.js').GuildMember} member
   * @returns {Promise<Buffer>}
   */
  static async generateWelcomeCard(member) {
    const width = 850;
    const height = 280;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const user = member.user;
    const tag = user.discriminator && user.discriminator !== '0'
      ? `${user.username}#${user.discriminator}`
      : `${user.username}`;
    const memberCount = member.guild?.memberCount || 1;

    // 1. Découpage du conteneur à coins arrondis
    ctx.save();
    this.roundRect(ctx, 0, 0, width, height, 16);
    ctx.clip();

    // 2. Fond noir obsidienne mat profond (#0e0e0e vers #151515)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f0f0f');
    bgGrad.addColorStop(0.5, '#131313');
    bgGrad.addColorStop(1, '#171717');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Trame géométrique exacte de la DA
    this.drawGeometricBackground(ctx, width, height);

    // Vignette douce sur les bords
    const vignette = ctx.createRadialGradient(width / 2, height / 2, 120, width / 2, height / 2, width * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // 4. Barre supérieure dorée pleine et éclatante (exactement comme le header de référence)
    const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
    topBarGrad.addColorStop(0, '#a38334');
    topBarGrad.addColorStop(0.15, '#e9d15c');
    topBarGrad.addColorStop(0.5, '#f4e79b');
    topBarGrad.addColorStop(0.85, '#d4af35');
    topBarGrad.addColorStop(1, '#a38334');
    ctx.fillStyle = topBarGrad;
    ctx.fillRect(0, 0, width, 6);

    // Liseré inférieur très discret
    ctx.fillStyle = 'rgba(212, 175, 53, 0.25)';
    ctx.fillRect(0, height - 2, width, 2);

    ctx.restore();

    // 5. Bordure extérieure fine or
    ctx.save();
    this.roundRect(ctx, 1, 1, width - 2, height - 2, 16);
    ctx.strokeStyle = 'rgba(212, 175, 53, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 6. Avatar du membre (sur la gauche)
    const avatarCenterX = 130;
    const avatarCenterY = height / 2 + 2;
    const avatarRadius = 78;

    // Halo doux sous l'avatar
    const haloGrad = ctx.createRadialGradient(avatarCenterX, avatarCenterY, 50, avatarCenterX, avatarCenterY, 105);
    haloGrad.addColorStop(0, 'rgba(233, 209, 92, 0.18)');
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, 105, 0, Math.PI * 2);
    ctx.fill();

    let avatarImg = null;
    try {
      const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });
      avatarImg = await loadImage(avatarUrl);
    } catch (err) {
      logger.warn({ error: err.message }, 'Erreur chargement avatar');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImg) {
      ctx.drawImage(
        avatarImg,
        avatarCenterX - avatarRadius,
        avatarCenterY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
    } else {
      ctx.fillStyle = '#202020';
      ctx.fill();
      ctx.fillStyle = '#e9d15c';
      ctx.font = 'bold 50px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(user.username.charAt(0).toUpperCase(), avatarCenterX, avatarCenterY);
    }
    ctx.restore();

    // Contour soigné de l'avatar en or Hyori (#e9d15c)
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#e9d15c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 7. Textes (Disposition exacte selon la demande)
    const textStartX = 250;

    // Ligne 1 : "Bienvenue sur Hyori RP,"
    ctx.font = '27px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#f8f5e8'; // Blanc cassé / ivoire chaud
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Bienvenue sur Hyori RP,', textStartX, 88);

    // Ligne 2 : "Pseudo#0000!"
    ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff'; // Blanc éclatant
    let displayedTag = tag.length > 24 ? tag.slice(0, 22) + '...' : tag;
    ctx.fillText(`${displayedTag}!`, textStartX, 144);

    // Ligne 3 : "MemberCount: 9"
    ctx.font = '25px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#d4af35'; // Or Hyori pour le compteur
    ctx.fillText(`MemberCount: ${memberCount.toLocaleString('fr-FR')}`, textStartX, 198);

    return canvas.toBuffer('image/png');
  }
}
