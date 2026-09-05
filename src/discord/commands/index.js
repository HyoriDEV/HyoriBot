import { muteCommand } from './mute.js';
import { unmuteCommand } from './unmute.js';
import { kickCommand } from './kick.js';
import { banCommand } from './ban.js';
import { unbanCommand } from './unban.js';
import { clearCommand } from './clear.js';
import { purgeCommand } from './purge.js';
import { lockCommand } from './lock.js';
import { unlockCommand } from './unlock.js';
import { slowmodeCommand } from './slowmode.js';
import { warnCommand } from './warn.js';
import { warnlistCommand } from './warnlist.js';
import { clearwarnsCommand } from './clearwarns.js';
import { userinfoCommand } from './userinfo.js';
import { serverinfoCommand } from './serverinfo.js';
import { helpCommand } from './help.js';

import timeoutCommand from '../../commands/moderation/timeout.js';
import untimeoutCommand from '../../commands/moderation/untimeout.js';
import tempbanCommand, { toCommand } from '../../commands/moderation/tempban.js';
import untempbanCommand, { untoCommand } from '../../commands/moderation/untempban.js';
import configLogsCommand from '../../commands/admin/config-logs.js';
import setupLogsCommand from '../../commands/admin/setup-logs.js';
import configWelcomeCommand from '../../commands/admin/config-welcome.js';
import configtempbanCommand from '../../commands/admin/configtempban.js';
import setupVocalCommand from '../../commands/admin/setup-vocal.js';
import cmdsCommand from '../../commands/general/cmds.js';
import { setpermCommand, spCommand } from '../../commands/admin/setperm.js';
import sprCommand from '../../commands/admin/spr.js';
import splCommand from '../../commands/admin/spl.js';
import setpermCmdsCommand from '../../commands/admin/setperm-cmds.js';

export const allSlashCommands = [
  muteCommand,
  unmuteCommand,
  kickCommand,
  banCommand,
  unbanCommand,
  clearCommand,
  purgeCommand,
  lockCommand,
  unlockCommand,
  slowmodeCommand,
  warnCommand,
  warnlistCommand,
  clearwarnsCommand,
  userinfoCommand,
  serverinfoCommand,
  helpCommand,
  // Modération modulaire
  timeoutCommand,
  untimeoutCommand,
  tempbanCommand,
  untempbanCommand,
  toCommand,
  untoCommand,
  // Permissions dynamiques & Raccourcis
  setpermCommand,
  spCommand,
  sprCommand,
  splCommand,
  setpermCmdsCommand,
  // Configuration et déploiement
  setupLogsCommand,
  configLogsCommand,
  configWelcomeCommand,
  configtempbanCommand,
  setupVocalCommand,
  cmdsCommand,
];

export const slashCommandsMap = new Map();
allSlashCommands.forEach(cmd => {
  slashCommandsMap.set(cmd.data.name, cmd);
});
