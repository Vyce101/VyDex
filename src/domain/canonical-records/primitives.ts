// Defines branded identifiers, dates, versions, and source URLs for canonical records.
import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/;
const METHODOLOGY_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function isRealCalendarDate(value: string): boolean {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isRealUtcTimestamp(value: string): boolean {
  if (!RFC3339_UTC_PATTERN.test(value)) {
    return false;
  }

  const [date, timeWithZone] = value.split("T");
  if (!date || !timeWithZone || !isRealCalendarDate(date)) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const [time] = timeWithZone.split("Z");
  const [hourText, minuteText, secondsWithFraction] = time!.split(":");
  const secondText = secondsWithFraction!.split(".")[0]!;
  const parsed = new Date(timestamp);
  return (
    parsed.getUTCHours() === Number(hourText) &&
    parsed.getUTCMinutes() === Number(minuteText) &&
    parsed.getUTCSeconds() === Number(secondText)
  );
}

const trimmedStringSchema = z.string().transform((value) => value.trim());

export const uuidV7Schema = z.uuidv7({ error: "Must be a valid UUIDv7." }).brand<"UUIDv7">();
export type UUIDv7 = z.infer<typeof uuidV7Schema>;

export const slugSchema = trimmedStringSchema
  .pipe(z.string().regex(SLUG_PATTERN, { error: "Must use lowercase kebab-case." }))
  .brand<"Slug">();
export type Slug = z.infer<typeof slugSchema>;

export const calendarDateSchema = trimmedStringSchema
  .pipe(
    z
      .string()
      .regex(CALENDAR_DATE_PATTERN, { error: "Must use YYYY-MM-DD format." })
      .refine(isRealCalendarDate, { error: "Must be a real calendar date." }),
  )
  .brand<"CalendarDate">();
export type CalendarDate = z.infer<typeof calendarDateSchema>;

export const rfc3339UtcTimestampSchema = trimmedStringSchema
  .pipe(
    z
      .string()
      .regex(RFC3339_UTC_PATTERN, { error: "Must be an RFC 3339 UTC timestamp using Z." })
      .refine(isRealUtcTimestamp, { error: "Must contain a real UTC date and time." }),
  )
  .brand<"Rfc3339UtcTimestamp">();
export type Rfc3339UtcTimestamp = z.infer<typeof rfc3339UtcTimestampSchema>;

export const methodologyVersionSchema = trimmedStringSchema
  .pipe(z.string().regex(METHODOLOGY_VERSION_PATTERN, { error: "Must use strict MAJOR.MINOR.PATCH format." }))
  .brand<"MethodologyVersion">();
export type MethodologyVersion = z.infer<typeof methodologyVersionSchema>;

export const sourceUrlSchema = trimmedStringSchema.pipe(
  z.url({ protocol: /^https?$/, error: "Must be an absolute HTTP or HTTPS URL." }),
);
