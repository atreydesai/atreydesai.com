export const SITE_URL = "https://atreydesai.com";

const SITE_HOST = new URL(SITE_URL).hostname;
const SITE_HOSTS = new Set([SITE_HOST, `www.${SITE_HOST}`]);

export function absoluteSiteUrl(value: string = SITE_URL): string {
  return value.startsWith("http")
    ? value
    : `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

export function canonicalUrl(value: string = SITE_URL): string {
  const parsed = new URL(absoluteSiteUrl(value));

  if (SITE_HOSTS.has(parsed.hostname)) {
    parsed.protocol = "https:";
    parsed.hostname = SITE_HOST;
    parsed.port = "";
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";

    const lastSegment = parsed.pathname.split("/").pop() ?? "";
    if (
      parsed.pathname !== "/" &&
      !parsed.pathname.endsWith("/") &&
      !lastSegment.includes(".")
    ) {
      parsed.pathname = `${parsed.pathname}/`;
    }
  }

  return parsed.toString();
}
