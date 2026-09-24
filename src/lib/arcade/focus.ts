const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab cycling inside `container`. */
export function trapFocus(event: KeyboardEvent, container: Element | null) {
  const focusable = container
    ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
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
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}
