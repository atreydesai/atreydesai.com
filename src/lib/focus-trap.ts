const FOCUSABLE =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab cycling inside a modal `container`, wrapping from
// the last focusable element to the first and back. Every other key passes
// through untouched, so a dialog's keydown handler can call it first.
export function trapFocus(event: KeyboardEvent, container: HTMLElement | null): void {
    if (event.key !== "Tab" || !container) return;
    const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
