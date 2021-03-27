const path = require("path");
const fs = require("fs");
const assert = require("assert");

const msg = fs
  .readFileSync(path.join(__dirname, "../.git/COMMIT_EDITMSG"))
  .toString("utf-8")
  .replace(/^fixup! /, "");

const gitmojis = [
  "🎨",
  "⚡️",
  "🔥",
  "🐛",
  "🚑",
  "✨",
  "📝",
  "🚀",
  "💄",
  "🎉",
  "✅",
  "🔒",
  "🔖",
  "🚨",
  "🚧",
  "💚",
  "⬇️",
  "⬆️",
  "📌",
  "👷",
  "📈",
  "♻️",
  "➕",
  "➖",
  "🔧",
  "🔨",
  "🌐",
  "✏️",
  "💩",
  "⏪",
  "🔀",
  "📦",
  "👽",
  "🚚",
  "📄",
  "💥",
  "🍱",
  "♿️",
  "💡",
  "🍻",
  "💬",
  "🗃",
  "🔊",
  "🔇",
  "👥",
  "🚸",
  "🏗",
  "📱",
  "🤡",
  "🥚",
  "🙈",
  "📸",
  "⚗",
  "🔍",
  "🏷️",
  "🌱",
  "🚩",
  "🥅",
  "💫",
  "🗑",
  "🛂",
  "🩹",
  "🧐",
  "⚰️",
];

try {
  const gitmoji = gitmojis.find((gm) => msg.startsWith(gm));
  assert(gitmoji, "Commit message should start with gitmoji");
  assert(msg[gitmoji.length] === " ", "Space should follow gitmoji");
  assert(/^[^ ]* \((all|viewer|engine)\)/.test(msg), "Commit scope should be 'all', 'engine' or 'viewer'");
  assert(
    /^[^ ]* \((all|viewer|engine)\) [A-Z]/.test(msg),
    "Commit subject should start with a space and an uppercase letter"
  );
} catch (err) {
  console.error("Expected commit format: <gitmoji> (all|viewer|engine) Subject");
  console.error(err.message);
  process.exit(1);
}
