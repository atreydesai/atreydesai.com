export const handle = async ({ event, resolve }) => {
  if (
    event.url.pathname === "/blog" ||
    event.url.pathname === "/blog/" ||
    event.url.pathname.startsWith("/blog/")
  ) {
    return new Response(null, {
      status: 307,
      headers: {
        location: "/",
      },
    });
  }

  return resolve(event, {
    preload: ({ type }) => type === "font" || type === "js" || type === "css",
  });
};
