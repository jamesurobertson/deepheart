/**
 * Brings `el`'s contents in line with `html` by changing only what differs, so a panel that refreshes every tick keeps
 * its elements (and their hover, focus, scroll and running animations) instead of being rebuilt.
 */
export function morph(el: HTMLElement, html: string) {
  const next = document.createElement('template');
  next.innerHTML = html;
  syncChildren(el, next.content);
}

function syncChildren(into: Node, from: Node) {
  const want = [...from.childNodes];
  let have = into.firstChild;
  for (const node of want) {
    if (!have) {
      into.appendChild(node);
      continue;
    }
    const after: ChildNode | null = have.nextSibling;
    if (same(have, node)) {
      if (have.nodeType === Node.ELEMENT_NODE) {
        syncAttributes(have as Element, node as Element);
        syncChildren(have, node);
      } else if (have.nodeValue !== node.nodeValue) have.nodeValue = node.nodeValue;
    } else into.replaceChild(node, have);
    have = after;
  }
  while (have) {
    const after: ChildNode | null = have.nextSibling;
    into.removeChild(have);
    have = after;
  }
}

/** The same kind of node: kept and updated in place rather than replaced. */
function same(a: Node, b: Node) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== Node.ELEMENT_NODE) return true;
  // Canvases and images hold drawn pixels: a changed one is replaced whole.
  const tag = (a as Element).tagName;
  if (tag !== (b as Element).tagName) return false;
  if (tag === 'CANVAS' || tag === 'IMG') return (a as Element).outerHTML === (b as Element).outerHTML;
  return true;
}

function syncAttributes(have: Element, want: Element) {
  for (const { name } of [...have.attributes]) if (!want.hasAttribute(name)) have.removeAttribute(name);
  for (const { name, value } of [...want.attributes]) if (have.getAttribute(name) !== value) have.setAttribute(name, value);
}
