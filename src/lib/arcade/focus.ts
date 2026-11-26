const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details > summary:first-of-type, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab cycling inside `container`. */
export function trapFocus(event: KeyboardEvent, container: Element | null) {
  const focusable = container
    ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.getClientRects().length > 0)
    : [];
  if (!focusable.length) {
    event.preventDefault();
    if (container instanceof HTMLElement) container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && container?.contains(active);
  // Programmatically focused headings can opt into the controls next to them.
  // Playfields keep the first/last-control shortcuts.
  if (inside && active instanceof HTMLElement && !focusable.includes(active)) {
    event.preventDefault();
    const boundary = event.shiftKey ? last : first;
    if (!active.hasAttribute("data-arcade-tab-anchor")) {
      boundary.focus();
      return;
    }
    const direction = event.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    const ordered = event.shiftKey ? focusable.slice().reverse() : focusable;
    const next = ordered.find((element) => (active.compareDocumentPosition(element) & direction) !== 0);
    (next ?? boundary).focus();
    return;
  }
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}
