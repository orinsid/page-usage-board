// Navigate magpie's frame to the board service.
//
// Prefer window.magpie.service: magpie web proxies the service on its own address, so the
// page stays under magpie's origin and magpie's own key/auth is the gate. A desktop window
// has no service; fall back to loopback.
//
// Do not probe the service: the page's CSP is connect-src 'none', so fetch/XHR is refused.
// The meta refresh in index.html (3 s) is the fallback if this script never runs.
(async () => {
  const FALLBACK = "http://127.0.0.1:3455/";
  let service = "";
  try {
    await window.magpie?.ready;
    const s = window.magpie?.service;
    if (typeof s === "string" && /^https?:\/\//.test(s)) service = s;
  } catch {
    // No bridge (old magpie) or it did not answer: loopback is the only option.
  }
  const target = service || FALLBACK;
  const go = document.getElementById("go");
  if (go) go.setAttribute("content", "0;url=" + target);
  try {
    location.replace(target);
  } catch {
    // The meta refresh above still navigates.
  }
})();