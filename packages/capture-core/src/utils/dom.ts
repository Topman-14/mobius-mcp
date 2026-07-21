export function shortSelector(el: Element): string {
  const id = el.id ? `#${el.id}` : "";
  const cls = el.classList.length > 0 ? `.${Array.from(el.classList).join(".")}` : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}
