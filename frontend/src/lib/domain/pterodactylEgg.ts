import { z } from 'zod';

interface ExportedEggReplacement {
  match: string;
  if_value: string | null;
  replace_with: unknown;
}

interface ExportedEggFile {
  create_new: boolean;
  parser: string;
  replace: ExportedEggReplacement[];
}

interface ExportedEggVariable {
  name: string;
  description: string | null;
  env_variable: string;
  default_value: string | null;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string[];
}

interface ExportedEgg {
  name: string;
  description: string | null;
  author: string;
  config: {
    files: Record<string, ExportedEggFile>;
    startup: { done: string[]; strip_ansi: boolean };
    stop: { type: string; value: string | null };
  };
  scripts: {
    installation: { container: string; entrypoint: string; content: string };
  };
  startup_commands: Record<string, string>;
  features: string[];
  docker_images: Record<string, string>;
  file_denylist: string[];
  variables: ExportedEggVariable[];
}

const UPSTREAM_SIGNALS = ['SIGABRT', 'SIGINT', 'SIGTERM', 'SIGKILL'];

function toScalarReplacement(value: unknown): unknown {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
}

function toFind(replacements: ExportedEggReplacement[]): Record<string, unknown> {
  const unconditional = new Map<string, unknown>();
  const conditional = new Map<string, Record<string, unknown>>();

  for (const replacement of replacements) {
    if (replacement.if_value) {
      const values = conditional.get(replacement.match) ?? {};
      values[replacement.if_value] = toScalarReplacement(replacement.replace_with);
      conditional.set(replacement.match, values);
    } else {
      unconditional.set(replacement.match, toScalarReplacement(replacement.replace_with));
    }
  }

  const find: Record<string, unknown> = {};
  for (const replacement of replacements) {
    if (replacement.match in find) continue;

    find[replacement.match] = unconditional.has(replacement.match)
      ? unconditional.get(replacement.match)
      : conditional.get(replacement.match);
  }

  return find;
}

function toStop(stop: ExportedEgg['config']['stop'] | undefined): string {
  switch (stop?.type) {
    case 'signal':
      if (stop.value === 'SIGINT') return '^C';
      return `^${stop.value && UPSTREAM_SIGNALS.includes(stop.value) ? stop.value : 'SIGTERM'}`;
    case 'docker':
      return '^SIGTERM';
    default:
      return stop?.value ?? '';
  }
}

function toAuthor(author: string): string {
  if (z.email().safeParse(author).success) return author;

  const embedded = author.match(/[^\s<>()]+@[^\s<>()]+/)?.[0];
  if (embedded && z.email().safeParse(embedded).success) return embedded;

  return 'unknown@example.com';
}

export function toPterodactylEgg(exported: object): object {
  const egg = exported as ExportedEgg;

  const files: Record<string, unknown> = {};
  for (const [filename, file] of Object.entries(egg.config?.files ?? {})) {
    files[filename] = {
      parser: file.parser,
      create_file: file.create_new ?? true,
      find: toFind(file.replace ?? []),
    };
  }

  const startup = egg.startup_commands?.Default ?? Object.values(egg.startup_commands ?? {})[0] ?? '';

  return {
    _comment: 'DO NOT EDIT: FILE GENERATED AUTOMATICALLY BY CALAGOPUS PANEL',
    meta: {
      version: 'PTDL_v2',
      update_url: null,
    },
    exported_at: new Date().toISOString(),
    name: egg.name,
    author: toAuthor(egg.author ?? ''),
    description: egg.description,
    features: egg.features ?? [],
    docker_images: egg.docker_images ?? {},
    file_denylist: egg.file_denylist ?? [],
    startup,
    config: {
      files: JSON.stringify(files),
      startup: JSON.stringify({
        done: egg.config?.startup?.done ?? [],
        strip_ansi: egg.config?.startup?.strip_ansi ?? false,
      }),
      logs: '{}',
      stop: toStop(egg.config?.stop),
    },
    scripts: {
      installation: {
        script: egg.scripts?.installation?.content ?? '',
        container: egg.scripts?.installation?.container ?? '',
        entrypoint: egg.scripts?.installation?.entrypoint ?? '',
      },
    },
    variables: (egg.variables ?? []).map((variable) => ({
      name: variable.name,
      description: variable.description ?? '',
      env_variable: variable.env_variable,
      default_value: variable.default_value ?? '',
      user_viewable: variable.user_viewable,
      user_editable: variable.user_editable,
      rules: variable.rules?.length ? variable.rules.join('|') : 'nullable',
      field_type: 'text',
    })),
  };
}
