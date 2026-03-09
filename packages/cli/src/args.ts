const HELP_TEXT = `AI Water Usage

Usage:
  ai-water-usage [options]

Options:
  --port <number>        Preferred local port (default: 3001)
  --host <host>          Host to bind the local server to (default: 127.0.0.1)
  --codex-home <path>    Override the Codex home directory
  --no-open              Do not open the browser automatically
  --help                 Show this help text
`;

export interface CliOptions {
  codexHome: string | null;
  help: boolean;
  host: string;
  openBrowser: boolean;
  preferredPort: number;
}

export class CliArgumentError extends Error {}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new CliArgumentError(`Invalid port: ${value}`);
  }
  return parsed;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new CliArgumentError(`Missing value for ${flag}`);
  }
  return value;
}

export function getHelpText(): string {
  return HELP_TEXT;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    codexHome: null,
    help: false,
    host: "127.0.0.1",
    openBrowser: true,
    preferredPort: 3001
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--no-open") {
      options.openBrowser = false;
      continue;
    }

    if (arg === "--port") {
      options.preferredPort = parsePort(requireValue(arg, argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === "--host") {
      options.host = requireValue(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--codex-home") {
      options.codexHome = requireValue(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    throw new CliArgumentError(`Unknown argument: ${arg}`);
  }

  return options;
}
