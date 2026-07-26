// Writes release lifecycle progress to colored terminal output and rotating local log files.
import { appendFile, mkdir, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";

export type ReleaseLogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type ReleaseLogger = {
  log(level: ReleaseLogLevel, message: string): Promise<void>;
  debug(message: string): Promise<void>;
  info(message: string): Promise<void>;
  warning(message: string): Promise<void>;
  error(message: string): Promise<void>;
  critical(message: string): Promise<void>;
  filename: string;
};

const LOG_COLORS: Readonly<Record<ReleaseLogLevel, string>> = Object.freeze({
  DEBUG: "\u001b[34m",
  INFO: "\u001b[32m",
  WARNING: "\u001b[33m",
  ERROR: "\u001b[31m",
  CRITICAL: "\u001b[1;37;41m",
});
const RESET_COLOR = "\u001b[0m";
const ACTIVE_LOG_NUMBER = 1;
const MAXIMUM_PREVIOUS_LOGS = 10;

async function removeIfPresent(filename: string): Promise<void> {
  try {
    await unlink(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function rotateLogs(logDirectory: string): Promise<void> {
  const oldestLogNumber = ACTIVE_LOG_NUMBER + MAXIMUM_PREVIOUS_LOGS;
  await removeIfPresent(resolve(logDirectory, `logs_${oldestLogNumber}.txt`));
  for (let logNumber = oldestLogNumber - 1; logNumber >= ACTIVE_LOG_NUMBER; logNumber -= 1) {
    const source = resolve(logDirectory, `logs_${logNumber}.txt`);
    const destination = resolve(logDirectory, `logs_${logNumber + 1}.txt`);
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function createReleaseLogger(input: {
  filesystem_root: string;
  write_terminal?: (value: string) => void;
  now?: () => Date;
}): Promise<ReleaseLogger> {
  const logDirectory = resolve(input.filesystem_root, "user/logs");
  await mkdir(logDirectory, { recursive: true });
  await rotateLogs(logDirectory);
  const filename = resolve(logDirectory, `logs_${ACTIVE_LOG_NUMBER}.txt`);
  const writeTerminal = input.write_terminal ?? ((value: string) => process.stdout.write(value));
  const now = input.now ?? (() => new Date());

  const log = async (level: ReleaseLogLevel, message: string): Promise<void> => {
    const line = `${now().toISOString()} ${level} ${message}`;
    writeTerminal(`${LOG_COLORS[level]}${line}${RESET_COLOR}\n`);
    await appendFile(filename, `${line}\n`, "utf8");
  };

  return {
    log,
    debug: (message) => log("DEBUG", message),
    info: (message) => log("INFO", message),
    warning: (message) => log("WARNING", message),
    error: (message) => log("ERROR", message),
    critical: (message) => log("CRITICAL", message),
    filename,
  };
}
