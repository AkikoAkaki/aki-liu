'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontMatter, reconstructFrontMatter } = require('./microblog-server');

const ROOT = path.join(__dirname, '..');
const CONTENT_ROOT = path.join(ROOT, 'content');

const counts = {
  files: 0,
  yaml: 0,
  toml: 0,
  none: 0,
};

const failures = [];

function toRepoPath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visitor);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      visitor(fullPath);
    }
  }
}

walk(CONTENT_ROOT, filePath => {
  counts.files += 1;

  const original = fs.readFileSync(filePath);
  const parsed = parseFrontMatter(original.toString('utf8'));
  const reconstructed = Buffer.from(reconstructFrontMatter(parsed), 'utf8');

  if (parsed.delimiter === 'yaml') counts.yaml += 1;
  else if (parsed.delimiter === 'toml') counts.toml += 1;
  else counts.none += 1;

  if (!original.equals(reconstructed)) {
    failures.push(toRepoPath(filePath));
  }
});

if (failures.length) {
  console.error('Content frontmatter round-trip check failed:');
  failures.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log(
  `Content frontmatter round-trip OK: ${counts.files} files ` +
  `(${counts.yaml} YAML, ${counts.toml} TOML, ${counts.none} without frontmatter).`
);
