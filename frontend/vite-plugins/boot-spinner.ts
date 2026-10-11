import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const SPINNER_CSS = path.resolve(import.meta.dirname, '../src/elements/feedback/spinner.css');

export function bootSpinner(): Plugin {
  return {
    name: 'boot-spinner',

    transformIndexHtml(html) {
      const css = fs.readFileSync(SPINNER_CSS, 'utf8');

      return {
        html: html.replace(
          '<div id="root"></div>',
          '<div id="root"><div style="display:flex;align-items:center;justify-content:center;padding:1.5rem 0"><span class="spinner" aria-label="Loading Spinner"></span></div></div>',
        ),
        tags: [
          {
            tag: 'style',
            children: `:where(html){background-color:var(--mantine-color-body,#242424)}\n${css}`,
            injectTo: 'head',
          },
        ],
      };
    },
  };
}
