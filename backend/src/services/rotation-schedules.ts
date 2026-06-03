export type RotationScheduleMode = "once" | "monthly";

export type RotationScheduleRecord = {
  id: string;
  name: string;
  mode: RotationScheduleMode;
  once_date: string | null;
  day_of_month: number | null;
  hour: number;
  minute: number;
  cron_desc: string;
  next_run_at: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RotationScheduleView = RotationScheduleRecord & {
  locked: boolean;
  status: "enabled" | "disabled" | "expired";
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDateTime(year: number, monthIndex: number, day: number, hour: number, minute: number) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(Math.max(1, day), lastDayOfMonth(year, monthIndex));
}

function parseScheduleDateTime(value: string | null | undefined, hour: number, minute: number) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return buildDateTime(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
}

function buildMonthlyOccurrence(year: number, monthIndex: number, dayOfMonth: number, hour: number, minute: number) {
  const day = clampDay(year, monthIndex, dayOfMonth);
  return buildDateTime(year, monthIndex, day, hour, minute);
}

export function buildCronDesc(input: {
  mode: RotationScheduleMode;
  once_date: string | null;
  day_of_month: number | null;
  hour: number;
  minute: number;
}) {
  const hh = pad(input.hour);
  const mm = pad(input.minute);
  if (input.mode === "once") return `指定 ${input.once_date || "-"} ${hh}:${mm}`;
  return `每月 ${input.day_of_month || 1} 日 ${hh}:${mm}`;
}

export function computeNextRunAt(input: {
  mode: RotationScheduleMode;
  once_date: string | null;
  day_of_month: number | null;
  hour: number;
  minute: number;
}, now = new Date()) {
  if (input.mode === "once") {
    const onceAt = parseScheduleDateTime(input.once_date, input.hour, input.minute);
    return onceAt ? formatDateTime(onceAt) : "";
  }

  const day = input.day_of_month || 1;
  const current = buildMonthlyOccurrence(now.getFullYear(), now.getMonth(), day, input.hour, input.minute);
  const candidate = current.getTime() > now.getTime()
    ? current
    : buildMonthlyOccurrence(now.getFullYear(), now.getMonth() + 1, day, input.hour, input.minute);
  return formatDateTime(candidate);
}

export function isScheduleExpired(schedule: {
  mode: RotationScheduleMode;
  once_date: string | null;
  hour: number;
  minute: number;
}, now = new Date()) {
  if (schedule.mode !== "once") return false;
  const onceAt = parseScheduleDateTime(schedule.once_date, schedule.hour, schedule.minute);
  if (!onceAt) return false;
  return onceAt.getTime() <= now.getTime();
}

export function normalizeRotationSchedule(schedule: RotationScheduleRecord, now = new Date()): RotationScheduleView {
  const locked = isScheduleExpired(schedule, now);
  const next_run_at = computeNextRunAt(schedule, now);
  const enabled = locked ? false : schedule.enabled;
  return {
    ...schedule,
    next_run_at,
    enabled,
    locked,
    status: locked ? "expired" : enabled ? "enabled" : "disabled"
  };
}

export function computeDisableAfterFromSchedules(
  schedules: Array<Pick<RotationScheduleRecord, "mode" | "once_date" | "day_of_month" | "hour" | "minute" | "enabled">>,
  disableAt: Date,
  now = new Date()
) {
  const base = atStartOfDay(disableAt);
  const baseTs = base.getTime();
  let chosen: Date | null = null;
  let hasActiveSchedule = false;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    if (schedule.mode === "once") {
      if (isScheduleExpired(schedule, now)) continue;
      hasActiveSchedule = true;
      const onceAt = parseScheduleDateTime(schedule.once_date, schedule.hour, schedule.minute);
      if (!onceAt) continue;
      const onceDay = atStartOfDay(onceAt);
      if (onceDay.getTime() <= baseTs) continue;
      if (!chosen || onceDay.getTime() < chosen.getTime()) {
        chosen = onceDay;
      }
      continue;
    }

    const day = schedule.day_of_month || 1;
    hasActiveSchedule = true;
    for (let offset = 0; offset < 36; offset += 1) {
      const occurrence = buildMonthlyOccurrence(
        base.getFullYear(),
        base.getMonth() + offset,
        day,
        schedule.hour,
        schedule.minute
      );
      const occurrenceDay = atStartOfDay(occurrence);
      if (occurrenceDay.getTime() <= baseTs) continue;
      if (!chosen || occurrenceDay.getTime() < chosen.getTime()) {
        chosen = occurrenceDay;
      }
      break;
    }
  }

  if (!hasActiveSchedule) {
    return null;
  }

  if (!chosen) {
    return base;
  }

  const result = atStartOfDay(addDays(chosen, -1));
  return result.getTime() < baseTs ? base : result;
}
