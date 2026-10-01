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
const htmlByRoute = new Map();
const routeForFile = (file) => {
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -10)}`;
  return `/${rel}`;
};
for (const file of files) htmlByRoute.set(routeForFile(file), fs.readFileSync(file, "utf8"));

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  const count = (pattern) => (html.match(pattern) || []).length;
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${rel}: missing title`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) errors.push(`${rel}: missing meta description`);
  if (count(/<h1\b/g) !== 1) errors.push(`${rel}: expected one h1, found ${count(/<h1\b/g)}`);
  if (!/<main\b[^>]*id="main-content"[^>]*tabindex="-1"/.test(html) && !/<main\b[^>]*tabindex="-1"[^>]*id="main-content"/.test(html)) errors.push(`${rel}: missing focusable main landmark`);
  if (!/class="skip-link"/.test(html)) errors.push(`${rel}: missing skip link`);

  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
    try { JSON.parse(match[1]); }
    catch (error) { errors.push(`${rel}: invalid JSON-LD (${error.message})`); }
  }

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIDs = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIDs.length) errors.push(`${rel}: duplicate ids ${[...new Set(duplicateIDs)].join(", ")}`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/.test(ref) || ref === "") continue;
    const [rawPath, fragment] = ref.split("#", 2);
    const cleanPath = rawPath.split("?", 1)[0];
    const currentRoute = routeForFile(file);
    let targetRoute = currentRoute;
    if (cleanPath) {
      targetRoute = cleanPath.startsWith("/")
        ? cleanPath
        : path.posix.resolve(path.posix.dirname(currentRoute), cleanPath);
    }
    if (targetRoute.endsWith("/")) {
      if (!htmlByRoute.has(targetRoute)) errors.push(`${rel}: broken route ${ref}`);
      else if (fragment && !new RegExp(`\\bid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(htmlByRoute.get(targetRoute))) errors.push(`${rel}: missing fragment ${ref}`);
    } else {
      const localFile = path.join(root, targetRoute.replace(/^\//, ""));
      if (!fs.existsSync(localFile)) errors.push(`${rel}: missing local asset ${ref}`);
    }
  }
}

const required = [
  "index.html", "meetingworth/index.html", "meetingworth/guide/index.html",
  "meetingworth/privacy/index.html", "accessibility/index.html", "404.html",
  "assets/styles.css", "assets/app.js", "assets/meetingworth-icon.png",
  "assets/meetingworth-icon-192.webp", "assets/meetingworth-icon-384.webp",
  "robots.txt", "sitemap.xml", "_headers", "_redirects"
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
for (const url of [
  "https://joeldoherty.com/", "https://joeldoherty.com/meetingworth/",
  "https://joeldoherty.com/meetingworth/guide/",
  "https://joeldoherty.com/meetingworth/privacy/", "https://joeldoherty.com/accessibility/"
]) {
  if (!sitemap.includes(url)) errors.push(`sitemap missing ${url}`);
}

const landing = fs.readFileSync(path.join(root, "meetingworth/index.html"), "utf8");
const guide = fs.readFileSync(path.join(root, "meetingworth/guide/index.html"), "utf8");
const appJS = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
const guideSections = [
  ["Build your first Estimate", "Choose attendees, set the meeting length and recurrence, then review the estimate before the meeting earns a place on the calendar.", "Use role presets or generic attendees. MeetingWorth Pro also unlocks named people and custom roles.", "Optional prep and follow-up time is included in the per-meeting estimate.", "Try Explore Savings to compare practical alternatives without changing your saved meeting."],
  ["Understand the numbers", "MeetingWorth multiplies each attendee’s loaded hourly cost by their meeting time, then totals the group.", "Loaded hourly cost estimates pay plus taxes, benefits, and overhead using the selected multiplier and annual work hours.", "Per-meeting cost includes scheduled time and any prep or follow-up time.", "Annual cost applies the meeting’s recurrence to the same per-meeting assumptions."],
  ["Keep saved meetings useful", "Saved meetings automatically use current Team rates for linked people and role presets, so reusable estimates stay useful as compensation changes.", "Links use the exact saved Team identity and attendee type; names are never used to guess a match.", "Manual generic rates are unchanged. If a Team source is deleted or an older entry has no link, the attendee keeps its last saved rate.", "Open a saved meeting to edit its details, duplicate it, or run it as a Live Timer."],
  ["Use the Live Timer", "Load an estimate or saved meeting into Live Timer to watch its estimated cost accumulate during a session.", "Pause and resume without losing elapsed time.", "A timer loaded from a saved meeting uses the current linked rates at launch and keeps those rates for that run.", "Save a timer result to keep the elapsed session duration as a saved meeting."],
  ["Share the useful part", "Shared summaries focus on aggregate meeting impact rather than individual compensation.", "Team Cost Cards show the meeting name, attendee count, duration, and aggregate cost.", "Individual names, salaries, and rates are not included as individual compensation details."]
];
const faqs = [
  ["Are these actual expenses or guaranteed savings?", "No. MeetingWorth produces planning estimates from the assumptions you enter. Savings ideas are comparisons, not guaranteed cash savings."],
  ["What is included in Free and Pro?", "Free includes unlimited estimates and timers, seeded roles and generic attendees, annual cost, one savings idea, one saved meeting, and basic sharing. MeetingWorth Pro is a one-time purchase that adds the complete savings plan, Team Cost Cards, additional saved meetings, named people, custom roles, and custom assumptions."],
  ["How do I restore MeetingWorth Pro?", "Open Settings, choose Unlock Pro, then tap Restore Purchases. Apple verifies the lifetime purchase for the Apple Account currently using the App Store."],
  ["Where is my data stored?", "People, compensation assumptions, meetings, and settings are stored only on this device. MeetingWorth has no account or cloud database. Data may be included in a device backup according to your iPhone backup settings, but MeetingWorth does not provide its own sync, export, or recovery service. Deleting the app or losing the device without a usable device backup can permanently remove the data."],
  ["Which rates does a saved meeting use?", "Linked people and role presets automatically use their current Team rates everywhere the saved meeting appears. Manual generic rates stay as entered. Deleted sources and unlinked older entries keep their last known saved rate instead of becoming zero or being removed."]
];
for (const text of [...guideSections.flat(), ...faqs.flat()]) {
  if (!guide.includes(text)) errors.push(`guide parity: missing approved text: ${text}`);
}
for (const id of ["quick-start", "estimate", "numbers", "saved", "timer", "share", "faq"]) {
  const source = id === "quick-start" ? landing : guide;
  if (!source.includes(`id="${id}"`)) errors.push(`missing stable anchor #${id}`);
}
if (!landing.includes('href="/meetingworth/guide/"')) errors.push("landing missing Guide & FAQ navigation");
if (!landing.includes("US$14.99") || !guide.includes("US$14.99")) errors.push("pricing must state US$14.99");
if (!landing.includes("estimated annual cost")) errors.push("Team Cost Card illustration missing annual cost");
if (!landing.includes("keeps that rate snapshot for the run")) errors.push("landing missing timer snapshot behavior");
if (!appJS.includes('const APP_STORE_URL = "";')) errors.push("App Store URL must remain unset before submission");
if (/apps\.apple\.com|itunes\.apple\.com/.test(`${landing}\n${guide}\n${appJS}`)) errors.push("premature App Store link found");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${files.length} HTML pages, ${required.length} required assets, internal links, JSON-LD, and Build 5 guide parity (5 sections, 5 FAQs).`);
