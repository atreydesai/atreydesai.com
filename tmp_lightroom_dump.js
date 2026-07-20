const se = Application("System Events");
const proc = se.processes.byName("Adobe Lightroom");
proc.frontmost = true;
delay(0.2);

function read(fn) {
  try {
    return fn();
  } catch (_error) {
    return null;
  }
}

function formatPair(value) {
  if (!value || value.length < 2) return "";
  return `${value[0]},${value[1]}`;
}

function dump(element, depth, maxDepth) {
  if (depth > maxDepth) return "";
  const indent = "  ".repeat(depth);
  const parts = [];
  const role = read(() => element.role());
  const subrole = read(() => element.subrole());
  const name = read(() => element.name());
  const description = read(() => element.description());
  const position = read(() => element.position());
  const size = read(() => element.size());
  if (role) parts.push(role);
  if (subrole) parts.push(`subrole=${subrole}`);
  if (name) parts.push(`name=${name}`);
  if (description) parts.push(`desc=${description}`);
  if (position && size) parts.push(`pos=${formatPair(position)} size=${formatPair(size)}`);

  let output = `${indent}${parts.join(" | ")}\n`;
  const children = read(() => element.uiElements()) || [];
  for (const child of children) {
    output += dump(child, depth + 1, maxDepth);
  }
  return output;
}

const windows = proc.windows();
if (!windows.length) {
  "No Lightroom windows found";
} else {
  dump(windows[0], 0, 5);
}
