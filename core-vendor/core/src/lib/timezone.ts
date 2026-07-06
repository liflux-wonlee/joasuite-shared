// Central timezone state for the client. Formatting helpers read from here.
// The effective timezone is: profile.timezone (personal override)
//   → tenant.settings.timezone (org default)
//   → "America/New_York" (system default).

export const DEFAULT_TIMEZONE = "America/New_York";

// Common IANA zones for the picker. Users may type-in others in the future,
// but this covers the vast majority of business locations.
export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "(GMT-05:00/-04:00) New York — Eastern" },
  { value: "America/Chicago", label: "(GMT-06:00/-05:00) Chicago — Central" },
  { value: "America/Denver", label: "(GMT-07:00/-06:00) Denver — Mountain" },
  { value: "America/Los_Angeles", label: "(GMT-08:00/-07:00) Los Angeles — Pacific" },
  { value: "America/Anchorage", label: "(GMT-09:00/-08:00) Anchorage — Alaska" },
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Honolulu — Hawaii" },
  { value: "America/Toronto", label: "(GMT-05:00/-04:00) Toronto" },
  { value: "America/Vancouver", label: "(GMT-08:00/-07:00) Vancouver" },
  { value: "America/Mexico_City", label: "(GMT-06:00) Mexico City" },
  { value: "America/Sao_Paulo", label: "(GMT-03:00) São Paulo" },
  { value: "UTC", label: "(GMT+00:00) UTC" },
  { value: "Europe/London", label: "(GMT+00:00/+01:00) London" },
  { value: "Europe/Paris", label: "(GMT+01:00/+02:00) Paris / Berlin / Madrid" },
  { value: "Europe/Athens", label: "(GMT+02:00/+03:00) Athens / Helsinki" },
  { value: "Africa/Johannesburg", label: "(GMT+02:00) Johannesburg" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Dubai" },
  { value: "Asia/Kolkata", label: "(GMT+05:30) India" },
  { value: "Asia/Bangkok", label: "(GMT+07:00) Bangkok / Jakarta / Hanoi" },
  { value: "Asia/Shanghai", label: "(GMT+08:00) Shanghai / Hong Kong / Singapore" },
  { value: "Asia/Seoul", label: "(GMT+09:00) Seoul / Tokyo" },
  { value: "Australia/Sydney", label: "(GMT+10:00/+11:00) Sydney" },
  { value: "Pacific/Auckland", label: "(GMT+12:00/+13:00) Auckland" },
];

let _currentTimezone: string = DEFAULT_TIMEZONE;
const listeners = new Set<(tz: string) => void>();

export function getDisplayTimezone(): string {
  return _currentTimezone;
}

export function setDisplayTimezone(tz: string | null | undefined) {
  const next = tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  if (next === _currentTimezone) return;
  _currentTimezone = next;
  listeners.forEach((fn) => {
    try { fn(next); } catch { /* ignore */ }
  });
}

export function subscribeTimezone(fn: (tz: string) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
