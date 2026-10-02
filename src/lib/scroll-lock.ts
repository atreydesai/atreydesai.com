// Body scroll lock for modal surfaces (the bookshelf sheet, the photo
// lightbox). It pins <body> at its current offset rather than setting
// `overflow: hidden`, which iOS Safari scrolls straight through. Both calls
// are no-ops when the body is already in that state, so a reactive statement
// can call them on every change and a teardown can unlock unconditionally.
import { browser } from "$app/environment";

let lockedScrollY = 0;

export function lockScroll(): void {
    if (!browser || document.body.style.position === "fixed") return;
    lockedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
}

export function unlockScroll(): void {
    if (!browser || document.body.style.position !== "fixed") return;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    // Instant, or the site's smooth scrolling would glide down from the top.
    window.scrollTo({ top: lockedScrollY, behavior: "instant" });
}
