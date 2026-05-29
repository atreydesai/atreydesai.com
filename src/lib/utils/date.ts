const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateInput(input: string): Date {
    const match = input.match(DATE_ONLY_PATTERN);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    return new Date(input);
}

function parseDateInputUtc(input: string): Date {
    const match = input.match(DATE_ONLY_PATTERN);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    return new Date(input);
}

export function formatDate(
    input: string,
    options: Intl.DateTimeFormatOptions,
    locale = "en-US",
): string {
    return new Intl.DateTimeFormat(locale, options).format(parseDateInput(input));
}

// Common presets so call sites don't repeat the same options object.
export const formatMonthYear = (input: string) =>
    formatDate(input, { month: "short", year: "numeric" });

export const formatShortDate = (input: string) =>
    formatDate(input, { month: "short", day: "numeric", year: "numeric" });

export const formatLongDate = (input: string) =>
    formatDate(input, { month: "long", day: "numeric", year: "numeric" });

export function formatUtcDate(input: string): string {
    return parseDateInputUtc(input).toUTCString();
}
