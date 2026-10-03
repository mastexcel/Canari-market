/** URL publique du site (APP_URL, sinon l'URL fournie par Render, sinon local). */
export function siteUrl(): string {
  return (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
