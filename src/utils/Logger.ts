// src/utils/Logger.ts

// ─── ANSI COLOR CODES ────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[97m",
  gray:    "\x1b[90m",
} as const;

// ─── SEVERITY CONFIG ─────────────────────────────────
const SEVERITY_CONFIG = {
  INFO:  { color: C.green,   icon: "✅", label: "INFORMATION" },
  WARN:  { color: C.yellow,  icon: "⚠️ ", label: "WARNING"     },
  ERROR: { color: C.red,     icon: "❌", label: "ERROR"       },
  DEBUG: { color: C.cyan,    icon: "🔍", label: "DEBUGGING"   },
  TRACE: { color: C.magenta, icon: "🔎", label: "TRACE"       },
  GUIDE: { color: C.blue,    icon: "📘", label: "GUIDE-LINES" },
  FATAL: { color: C.red,     icon: "💀", label: "FATAL"       },
} as const;

type Severity = keyof typeof SEVERITY_CONFIG;

// ─── CLOCK ───────────────────────────────────────────
export function CLOCK(): string {
  const t = new Date();
  const date = `${t.getDate().toString().padStart(2,"0")}/${
    (t.getMonth()+1).toString().padStart(2,"0")}/${
    t.getFullYear()}`;
  const time = `${t.getHours().toString().padStart(2,"0")}:${
    t.getMinutes().toString().padStart(2,"0")}:${
    t.getSeconds().toString().padStart(2,"0")}.${
    t.getMilliseconds().toString().padStart(3,"0")}`;
  return `${date} ${time}`;
}

// ─── CORE LOGGER ─────────────────────────────────────
function _log(
  severity: Severity,
  source: string,
  message: string | Error,
  event: string
): void {
  const cfg  = SEVERITY_CONFIG[severity];
  const col  = cfg.color;
  const msg  = message instanceof Error ? message.message : message;
  const div  = `${col}${"─".repeat(63)}${C.reset}`;
  const bar  = `${col}||${C.reset}`;

  console.log(`
${col}${C.bold}        ${CLOCK()}${C.reset}
${div}
${col}${C.bold}        ${cfg.icon}  ${cfg.label}${C.reset}
        Source : ${C.white}${C.bold}${source}${C.reset}
${col}        ${"─".repeat(30)}${bar}${"─".repeat(30)}${C.reset}
        ${C.cyan}${event}${C.reset} EVENT
                                ${col}──────────────${C.reset}
        MESSAGE: ${C.white}${msg}${C.reset}
${div}
        ${C.gray}SOURCE is at ${source} function${C.reset}
`);
}

// ─── PUBLIC API ───────────────────────────────────────
export const Log = {
  info:  (source: string, message: string, event: string) =>
    _log("INFO",  source, message, event),

  warn:  (source: string, message: string | Error, event: string) =>
    _log("WARN",  source, message, event),

  error: (source: string, message: string | Error, event: string) =>
    _log("ERROR", source, message, event),

  debug: (source: string, message: string | Error, event: string) =>
    _log("DEBUG", source, message, event),

  trace: (source: string, message: string, event: string) =>
    _log("TRACE", source, message, event),

  guide: (source: string, message: string, event: string) =>
    _log("GUIDE", source, message, event),

  fatal: (source: string, message: string | Error, event: string) => {
    _log("FATAL", source, message, event);
    process.exit(1);
  },
};