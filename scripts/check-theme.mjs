import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const errors = [];
let count = 0;
for (const directory of directories) {
  for (const filename of fs.readdirSync(path.join(root, directory))) {
    if (!/\.(js|json|liquid)$/.test(filename)) continue;
    const relative = path.join(directory, filename);
    const content = fs.readFileSync(path.join(root, relative), 'utf8');
    count++;
    try {
      if (filename.endsWith('.json')) {
        const json = JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
        for (const section of Object.values(json.sections || {})) {
          if (section.type && section.type !== '@app' && !fs.existsSync(path.join(root, 'sections', section.type + '.liquid'))) errors.push(relative + ': missing section ' + section.type);
        }
      }
      if (filename.endsWith('.js')) new vm.Script(content, { filename: relative });
      if (filename.endsWith('.liquid')) {
        if (/asset_url\s*\|\s*image_tag/.test(content)) errors.push(relative + ': asset_url cannot be passed to image_tag');
        for (const match of content.matchAll(/{%\s*javascript\s*%}([\s\S]*?){%\s*endjavascript\s*%}/g)) new vm.Script(match[1], { filename: relative });
        for (const match of content.matchAll(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g)) JSON.parse(match[1]);
        for (const match of content.matchAll(/['"]([^'"]+)['"]\s*\|\s*asset_url/g)) {
          if (!fs.existsSync(path.join(root, 'assets', match[1]))) errors.push(relative + ': missing asset ' + match[1]);
        }
        for (const match of content.matchAll(/{%[-]?\s*render\s+['"]([^'"]+)['"]/g)) {
          if (!fs.existsSync(path.join(root, 'snippets', match[1] + '.liquid'))) errors.push(relative + ': missing snippet ' + match[1]);
        }
      }
    } catch (error) { errors.push(relative + ': ' + error.message); }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Theme structure verified: ' + count + ' files; valid JavaScript, JSON, schemas, assets and snippet references.');
