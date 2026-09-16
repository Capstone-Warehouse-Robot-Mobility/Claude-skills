import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const skillsRoot = '.claude/skills';

function walkSkillFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkSkillFiles(path));
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(path);
  }
  return files;
}

function frontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? '';
}

function field(fm, name) {
  const match = fm.match(new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[a-zA-Z][\\w-]*:|$)`, 'm'));
  return (match?.[1] ?? '').replace(/\n\s+/g, ' ').trim();
}

function normalizeName(raw) {
  return raw
    .trim()
    .replace(/^(and|or)\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+skills?$/i, '')
    .replace(/^\/+/, '')
    .replace(/`/g, '');
}

function descriptionCallers(description) {
  const match = description.match(/\binvoked by\s+(.+?)(?:\s+when|\s+after|\s+before|\s+to\s+|\s+as\s+|\.\s|$)/i);
  if (!match) return [];

  return match[1]
    .split(/\s*,\s*|\s+\band\b\s+|\s+\bor\b\s+/)
    .map(normalizeName)
    .filter(Boolean)
    .filter(name => !['other mutation', 'other mutation skills'].includes(name))
    .filter(name => !name.startsWith('etc'));
}

function callerMentionsCallee(callerContent, calleeName) {
  return [
    `/${calleeName}`,
    `\`${calleeName}\``,
  ].some(token => callerContent.includes(token));
}

if (!existsSync(skillsRoot) || !statSync(skillsRoot).isDirectory()) {
  console.error(`No skills directory found at ${skillsRoot}.`);
  process.exit(1);
}

const skills = new Map();

for (const file of walkSkillFiles(skillsRoot).sort()) {
  const rel = file.slice(skillsRoot.length + 1);
  const skillDir = rel.split(sep)[0];
  const content = readFileSync(file, 'utf8');
  const fm = frontmatter(content);
  const name = field(fm, 'name') || skillDir;
  const description = field(fm, 'description');
  skills.set(name, { name, file, content, description });
}

const aliases = new Map([
  ['debug', skills.get('fix-bug')],
]);

const missing = [];

for (const callee of skills.values()) {
  for (const callerName of descriptionCallers(callee.description)) {
    const caller = aliases.get(callerName) ?? skills.get(callerName);
    if (!caller) {
      missing.push(`${callee.name} declares unknown caller "${callerName}"`);
      continue;
    }
    if (!callerMentionsCallee(caller.content, callee.name)) {
      missing.push(`${caller.name} should explicitly route ${callee.name}`);
    }
  }
}

if (missing.length > 0) {
  console.error('Skill routing drift detected:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Skill routing check passed (${skills.size} skills).`);
