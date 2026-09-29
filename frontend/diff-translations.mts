import fs from 'node:fs/promises';
import { DefinedTranslations, getTranslationMapping } from 'shared';

const { default: baseTranslations } = await import('./src/translations.ts');
const translationFiles = fs.glob('extensions/*/src/translations.ts');

for await (const path of translationFiles) {
  const identifier = path.split('/')[1];
  const translations = await import(`./${path}`);

  if (
    typeof translations === 'object' &&
    translations &&
    'default' in translations &&
    translations.default instanceof DefinedTranslations
  ) {
    translations.default.namespace = identifier.replaceAll('_', '.');
    baseTranslations.mergeFrom(translations.default);
  } else {
    console.error('Invalid frontend translations', identifier, translations);
  }
}

const difFile = process.argv[2];
if (!difFile) {
  console.error('No diff file specified, Syntax: pnpm translations:diff <diff-file>');
  process.exit(1);
}

const isVerbose = process.argv.includes('--verbose');
const isChecking = process.argv.includes('--check');
const isFixing = process.argv.includes('--fix');
let failedCheck = false;

const extractVariables = (text) => {
  if (typeof text !== 'string') return new Set();
  const matches = text.match(/\{[^}]+\}/g) || [];
  return new Set(matches);
};

// Deletes a dotted key path from a nested translation object and prunes any
// parent objects left empty behind it.
function deleteKeyPath(obj: Record<string, unknown>, dottedKey: string): void {
  const parts = dottedKey.split('.');
  const stack: Record<string, unknown>[] = [obj];

  for (let i = 0; i < parts.length - 1; i++) {
    const next = stack[stack.length - 1][parts[i]];
    if (typeof next !== 'object' || next === null) return;
    stack.push(next as Record<string, unknown>);
  }

  delete stack[stack.length - 1][parts[parts.length - 1]];

  for (let i = stack.length - 1; i > 0; i--) {
    if (Object.keys(stack[i]).length === 0) {
      delete stack[i - 1][parts[i - 1]];
    } else {
      break;
    }
  }
}

const removedKeys: { key: string; reason: string }[] = [];

function removeKey(translationContent: Record<string, unknown>, key: string, reason: string): void {
  deleteKeyPath(translationContent, key);
  removedKeys.push({ key, reason });
  console.log(`REMOVED\t${difFile}\t${key}\t${reason}`);
}

try {
  const translationContent = JSON.parse(await fs.readFile(difFile, 'utf-8'));
  const translationMapping = getTranslationMapping(translationContent);
  const baseMapping = getTranslationMapping(baseTranslations.subTranslations);

  for (const key in baseMapping) {
    if (!(key in translationMapping)) {
      if (!isVerbose) {
        continue;
      }

      console.log(`Missing translation key: ${key}`);

      console.log('  Expected:', JSON.stringify(baseMapping[key], null, 2));
      console.log('  Found:     <missing>');
    } else {
      const baseVars = extractVariables(baseMapping[key]);
      const transVars = extractVariables(translationMapping[key]);

      const missingVars = [...baseVars].filter((v) => !transVars.has(v));
      const extraVars = [...transVars].filter((v) => !baseVars.has(v));

      if (missingVars.length > 0) {
        console.log(`Missing variable(s) in key '${key}': ${missingVars.join(', ')}`);
        if (isVerbose) {
          console.log('  Base string: ', JSON.stringify(baseMapping[key]));
          console.log('  Diff string: ', JSON.stringify(translationMapping[key]));
        }
      }

      if (extraVars.length > 0) {
        console.log(`Extra variable(s) in key '${key}': ${extraVars.join(', ')}`);
        if (isVerbose) {
          console.log('  Base string: ', JSON.stringify(baseMapping[key]));
          console.log('  Diff string: ', JSON.stringify(translationMapping[key]));
        }
      }

      if (missingVars.length > 0 || extraVars.length > 0) {
        if (isFixing) {
          removeKey(translationContent, key, 'variable mismatch');
        } else {
          failedCheck = true;
        }
      }
    }
  }

  for (const key in translationMapping) {
    if (!(key in baseMapping)) {
      console.log(`Extra translation key: ${key}`);
      if (isFixing) {
        removeKey(translationContent, key, 'extra key');
      } else {
        failedCheck = true;
      }
    }
  }

  if (isFixing && removedKeys.length > 0) {
    await fs.writeFile(difFile, `${JSON.stringify(translationContent, null, 2)}\n`, 'utf-8');
  }

  if (isChecking && failedCheck) {
    console.error('Diff failed inspection check');
    process.exit(1);
  }
} catch (error) {
  console.error('Error reading or parsing diff file:', error);
  process.exit(1);
}
