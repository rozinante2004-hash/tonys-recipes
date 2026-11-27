// v40.21 — a sent recipe's own page, on this copy's address: /r/<id> (and its pictures). Cloudflare Pages runs this
// for every address under /r/ and serves the rest of the site as it always did. The work is in share/recipe-page.mjs.
import { handleShare } from '../../share/recipe-page.mjs';

export async function onRequest(context) {
  return handleShare(context.request, context.env);
}
