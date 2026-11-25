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
  // Focus on something inside that Tab itself never stops on (a game's
  // playfield, focused by the game): the next Tab goes to the first control,
  // Shift+Tab to the last, never out of the game.
  if (inside && active instanceof HTMLElement && !focusable.includes(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
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
