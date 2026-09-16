import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", ".git"]);
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (item.name.endsWith(".html")) files.push(full);
  }
}
walk(root);

const errors = [];
for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  const count = (pattern) => (html.match(pattern) || []).length;
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${rel}: missing title`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) errors.push(`${rel}: missing meta description`);
  if (count(/<h1\b/g) !== 1) errors.push(`${rel}: expected one h1, found ${count(/<h1\b/g)}`);
  if (!/<main\b[^>]*id="main-content"[^>]*tabindex="-1"/.test(html) && !/<main\b[^>]*tabindex="-1"[^>]*id="main-content"/.test(html)) errors.push(`${rel}: missing focusable main landmark`);
  if (!/class="skip-link"/.test(html)) errors.push(`${rel}: missing skip link`);
}

const required = [
  "index.html", "meetingworth/index.html", "meetingworth/privacy/index.html",
  "accessibility/index.html", "404.html", "assets/styles.css", "assets/app.js",
  "assets/meetingworth-icon.png", "robots.txt", "sitemap.xml", "_headers", "_redirects"
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
for (const url of ["https://joeldoherty.com/", "https://joeldoherty.com/meetingworth/", "https://joeldoherty.com/meetingworth/privacy/", "https://joeldoherty.com/accessibility/"]) {
  if (!sitemap.includes(url)) errors.push(`sitemap missing ${url}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${files.length} HTML pages and ${required.length} required assets.`);
