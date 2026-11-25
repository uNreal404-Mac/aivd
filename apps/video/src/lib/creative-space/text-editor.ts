/** The graph stores Markdown so formatted text can still feed another node. */
export function canvasTextLines(text: string) {
  return text.split("\n").map(line => {
    const mark = /^(#{1,3})\s+|^(-)\s+|^(\d+)\.\s+/.exec(line);
    if (line === "---") return { kind: "hr", value: "" };
    const kind = mark?.[1] ? `h${mark[1].length}` : mark?.[2] ? "ul" : mark?.[3] ? "ol" : "p";
    return { kind, value: line.slice(mark?.[0].length ?? 0) };
  });
}

function appendInline(parent: HTMLElement, text: string) {
  let offset = 0;
  const stack: { element: HTMLElement; width: number }[] = [{ element: parent, width: 0 }];
  const current = () => stack[stack.length - 1].element;
  for (const match of text.matchAll(/\*+/g)) {
    current().append(document.createTextNode(text.slice(offset, match.index)));
    const end = match.index + match[0].length;
    let width = match[0].length;
    if (match.index > 0 && !/\s/.test(text[match.index - 1])) {
      while (stack.length > 1 && stack[stack.length - 1].width <= width) width -= stack.pop()!.width;
    }
    if (end < text.length && !/\s/.test(text[end])) {
      while (width > 0) {
        const open = width >= 2 ? 2 : 1;
        if (text.indexOf("*".repeat(open), end) < 0) break;
        const element = document.createElement(open === 2 ? "strong" : "em");
        current().append(element); stack.push({ element, width: open }); width -= open;
      }
    }
    if (width) current().append(document.createTextNode("*".repeat(width)));
    offset = end;
  }
  if (offset < text.length) current().append(document.createTextNode(text.slice(offset)));
  if (!parent.childNodes.length) parent.append(document.createElement("br"));
}

export function paintCanvasText(root: HTMLElement, text: string) {
  const content = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  for (const { kind, value } of canvasTextLines(text)) {
    if (kind === "ul" || kind === "ol") {
      if (!list || list.localName !== kind) { list = document.createElement(kind); content.append(list); }
      const item = document.createElement("li");
      appendInline(item, value); list.append(item);
    } else {
      list = null;
      const block = document.createElement(kind);
      if (kind !== "hr") appendInline(block, value);
      content.append(block);
    }
  }
  root.replaceChildren(content);
}

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\u00a0/g, " ");
  if (!(node instanceof HTMLElement)) return "";
  const tag = node.localName;
  if (tag === "br") return "\n";
  const text = Array.from(node.childNodes, inlineText).join("");
  if (!text) return "";
  if (tag === "strong" || tag === "b") return `**${text}**`;
  if (tag === "em" || tag === "i") return `*${text}*`;
  return text;
}

export function readCanvasText(root: HTMLElement): string {
  const lines: string[] = [];
  let run = "";
  const flush = () => { if (run) { lines.push(run); run = ""; } };
  for (const node of root.childNodes) {
    const tag = node instanceof HTMLElement ? node.localName : "";
    if (!["h1","h2","h3","p","div","hr","ul","ol"].includes(tag)) { run += inlineText(node); continue; }
    flush();
    if (tag === "hr") { lines.push("---"); continue; }
    if ((tag === "ul" || tag === "ol") && node instanceof HTMLElement) {
      Array.from(node.children).forEach((li,index) => lines.push((tag === "ol" ? `${index + 1}. ` : "- ") + inlineText(li).replace(/\n$/, "")));
      continue;
    }
    const text = inlineText(node).replace(/\n$/, "");
    lines.push((/^h[1-3]$/.test(tag) ? "#".repeat(Number(tag[1])) + " " : "") + text);
  }
  flush();
  return lines.join("\n");
}
