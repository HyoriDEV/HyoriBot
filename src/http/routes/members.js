import { authenticateBearer } from '../middleware/auth.js';
import { discordBot } from '../../discord/client.js';
import { roleBackupRepository } from '../../persistence/roleBackupRepository.js';
import { getEnv } from '../../config/env.js';
export async function memberRoutes(fastify) {
  fastify.addHook('preHandler', authenticateBearer);
  fastify.get('/members/:discordId', async (request, reply) => {
    const { discordId } = request.params;
    const env = getEnv();
    try {
      const guild = await discordBot.fetchGuild();
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        return reply.status(404).send({
          success: false,
          statusCode: 404,
          error: 'Not Found',
          message: `Member with Discord ID ${discordId} not found in guild`,
        });
      }
      const activeBackup = await roleBackupRepository.getActiveBackup(discordId);
      const staffRoleIds = [
        env.ROLE_GC_ID,
        env.ROLE_COMMUNICATION_ID,
        env.ROLE_RP_TRACKING_ID,
        env.ROLE_EVENT_ID,
        env.ROLE_DEVELOPER_ID,
        env.ROLE_ADMIN_ID,
      ];
      const classRoleIds = [
        env.ROLE_NOBLE_ID,
        env.ROLE_PAYSAN_ID,
        env.ROLE_PECHEUR_ID,
        env.ROLE_MINEUR_ID,
        env.ROLE_ERUDIT_ID,
      ];
      const roles = member.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        isWhitelist: role.id === env.ROLE_WHITELIST_ID,
        isSanctioned: role.id === env.ROLE_SANCTIONED_ID,
        isStaff: staffRoleIds.includes(role.id),
        isClass: classRoleIds.includes(role.id),
      }));
      return reply.status(200).send({
        success: true,
        member: {
          discordId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          nickname: member.nickname,
          avatarUrl: member.user.displayAvatarURL(),
          joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
          isSanctioned: member.roles.cache.has(env.ROLE_SANCTIONED_ID),
          isWhitelisted: member.roles.cache.has(env.ROLE_WHITELIST_ID),
          roles,
          activeBackup,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
        message: error?.message || 'Failed to fetch member details',
      });
    }
  });
}
