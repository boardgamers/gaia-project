export function isShortcutLabel(html: string): boolean {
  return /<u>[^<>]+<\/u>/.test(html) && !/<[^>]*>/.test(html.replace(/<\/?u>/g, ""));
}

export function translateShortcutLabel(html: string, translate: (text: string) => string): string {
  if (!isShortcutLabel(html)) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  const shortcut = template.content.querySelector("u")!.textContent!;
  const prefix = /^<u>[^<>]+<\/u>:\s*/.exec(html);
  if (prefix) template.innerHTML = html.slice(prefix[0].length);
  const text = translate(template.content.textContent!);
  const escape = (value: string) => {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  };
  // Keep the actual binding; translations may move its letter or not contain it.
  const index = prefix ? -1 : text.toLowerCase().indexOf(shortcut.toLowerCase());
  return index < 0
    ? `<u>${escape(shortcut)}</u>: ${escape(text)}`
    : `${escape(text.slice(0, index))}<u>${escape(text.slice(index, index + shortcut.length))}</u>${escape(text.slice(index + shortcut.length))}`;
}
