#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const cmd = input?.tool_input?.command ?? '';

const FORBIDDEN = [
  { pattern: /\bnpm\s+(install|i|add|ci|update|up)\b/, manager: 'npm' },
  { pattern: /\byarn\s+(install|add|upgrade)\b/, manager: 'yarn' },
  { pattern: /\bbun\s+(install|add|i)\b/, manager: 'bun' },
];

for (const { pattern, manager } of FORBIDDEN) {
  if (pattern.test(cmd)) {
    console.error(
      `[guard-pnpm] blocked: ${manager} install/add detected. This project uses pnpm + a catalog ` +
      `for shared versions; running ${manager} will corrupt pnpm-lock.yaml. Use pnpm instead.`
    );
    process.exit(2);
  }
}

process.exit(0);
