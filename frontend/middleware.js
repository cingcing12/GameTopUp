export default function middleware(request) {
  // If a POST request hits a static page (e.g. from Cloudflare challenge verification form),
  // redirect to GET with 303 See Other so the page loads cleanly without HTTP 405 error.
  if (request.method === 'POST') {
    const url = new URL(request.url);
    return Response.redirect(url, 303);
  }
}
