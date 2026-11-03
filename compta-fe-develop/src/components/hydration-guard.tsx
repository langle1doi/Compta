import Script from "next/script";

/**
 * Early bootstrap in the root layout via next/script beforeInteractive.
 * Raw <script> in a React tree triggers a React 19 / Next 16 console error
 * (client render never executes those tags).
 */
const stripInjectedAttributes = `
(function () {
  function strip(node) {
    if (!node || !node.removeAttribute) return;
    if (node.hasAttribute("bis_skin_checked")) node.removeAttribute("bis_skin_checked");
    if (node.hasAttribute("bis_register")) node.removeAttribute("bis_register");
    Array.prototype.forEach.call(node.attributes || [], function (attr) {
      if (attr && attr.name && attr.name.indexOf("__processed_") === 0) {
        node.removeAttribute(attr.name);
      }
    });
  }
  function walk(root) {
    if (!root) return;
    strip(root);
    var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < all.length; i += 1) strip(all[i]);
  }
  walk(document.documentElement);
  // Keep localStorage sidebar preference mirrored to a cookie for the next SSR paint.
  try {
    var key = "compte.sidebar.desktopOpen";
    var value = window.localStorage.getItem(key);
    if (value === "0" || value === "1") {
      var cookie = document.cookie || "";
      if (cookie.indexOf(key + "=" + value) === -1) {
        document.cookie = key + "=" + value + ";path=/;max-age=31536000;SameSite=Lax";
      }
    }
  } catch (e) {}
  if (typeof MutationObserver === "undefined") return;
  var observer = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i += 1) {
      var target = records[i].target;
      if (target && target.nodeType === 1) strip(target);
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j += 1) {
        if (added[j].nodeType === 1) walk(added[j]);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["bis_skin_checked", "bis_register"],
  });
})();
`;

export function HydrationGuard() {
  return (
    <Script id="compte-hydration-guard" strategy="beforeInteractive">
      {stripInjectedAttributes}
    </Script>
  );
}
