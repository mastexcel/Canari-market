/** Journalisation structurée minimale (JSON sur stdout, compatible avec tout collecteur). */
type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...ctx });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
};
