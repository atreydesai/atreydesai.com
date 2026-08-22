import { negotiateHtmlResponse } from "./lib/server/content-negotiation.js";

export const handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    preload: ({ type }) => type === "font" || type === "js" || type === "css",
  });

  return negotiateHtmlResponse(event.request, response, event.url);
};
