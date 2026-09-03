import { muteCommand } from './mute.js';
import { unmuteCommand } from './unmute.js';
import { kickCommand } from './kick.js';
import { banCommand } from './ban.js';
import { unbanCommand } from './unban.js';
import { clearCommand } from './clear.js';
import { lockCommand } from './lock.js';
import { unlockCommand } from './unlock.js';
import { slowmodeCommand } from './slowmode.js';
import { warnCommand } from './warn.js';
import { warnlistCommand } from './warnlist.js';
import { clearwarnsCommand } from './clearwarns.js';
import { userinfoCommand } from './userinfo.js';
import { serverinfoCommand } from './serverinfo.js';
import { helpCommand } from './help.js';
export const allSlashCommands = [
  muteCommand,
  unmuteCommand,
  kickCommand,
  banCommand,
  unbanCommand,
  clearCommand,
  lockCommand,
  unlockCommand,
  slowmodeCommand,
  warnCommand,
  warnlistCommand,
  clearwarnsCommand,
  userinfoCommand,
  serverinfoCommand,
  helpCommand,
];
export const slashCommandsMap = new Map();
allSlashCommands.forEach(cmd => {
  slashCommandsMap.set(cmd.data.name, cmd);
});
