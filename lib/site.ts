/** Brand copy and URLs in one place. */
export const site = {
  name: "Punchline",
  tagline: "Jokes worth telling twice.",
  description:
    "A hand-picked library of one-liners, puns, and groan-worthy classics. Sign in to get a set picked for you in the Green Room.",
  // Vercel sets this in production; fall back to localhost for development.
  url: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000",
};
