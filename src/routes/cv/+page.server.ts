import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => {
  const cvLastUpdated = new Date(__CV_DATE__).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { cvLastUpdated };
};
