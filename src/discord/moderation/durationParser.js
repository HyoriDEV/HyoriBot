const DURATION_REGEX =
  /^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|d|days?|w|weeks?|mo|months?)$/i;
export function parseDuration(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  const match = trimmed.match(DURATION_REGEX);
  if (!match) {
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0) {
      return {
        ms: num * 60 * 1000,
        formatted: `${num} minute(s)`,
      };
    }
    return null;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (isNaN(value) || value <= 0) {
    return null;
  }
  let ms = 0;
  let formatted = '';
  if (unit.startsWith('s')) {
    ms = value * 1000;
    formatted = `${value} seconde(s)`;
  } else if (unit.startsWith('m') && !unit.startsWith('mo')) {
    ms = value * 60 * 1000;
    formatted = `${value} minute(s)`;
  } else if (unit.startsWith('h')) {
    ms = value * 60 * 60 * 1000;
    formatted = `${value} heure(s)`;
  } else if (unit.startsWith('d')) {
    ms = value * 24 * 60 * 60 * 1000;
    formatted = `${value} jour(s)`;
  } else if (unit.startsWith('w')) {
    ms = value * 7 * 24 * 60 * 60 * 1000;
    formatted = `${value} semaine(s)`;
  } else if (unit.startsWith('mo')) {
    ms = value * 30 * 24 * 60 * 60 * 1000;
    formatted = `${value} mois`;
  }
  const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
  if (ms > MAX_TIMEOUT_MS) {
    ms = MAX_TIMEOUT_MS;
    formatted = '28 jours (maximum Discord)';
  }
  return {
    ms,
    formatted,
  };
}
