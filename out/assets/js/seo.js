/**
 * Canonical + Open Graph + Twitter + JSON-LD.
 * Canonical always points at the production origin so preview hosts
 * do not mint a second indexable URL.
 */
(function () {
  var ORIGIN = "https://dreamutopia-clone.pages.dev";
  var path = location.pathname.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
  if (!path) path = "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  var url = ORIGIN + path;
  var title = document.title || "DreamUtopia";
  var descEl = document.querySelector('meta[name="description"]');
  var desc = (descEl && descEl.getAttribute("content")) || title;
  var image = ORIGIN + "/assets/images/feature-image-to-video.webp";
  var noindex = document.querySelector('meta[name="robots"][content*="noindex"]');

  function link(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function meta(attr, key, content, keepExisting) {
    var sel = "meta[" + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    } else if (keepExisting && el.getAttribute("content")) {
      return;
    }
    el.setAttribute("content", content);
  }

  function ld(payload) {
    if (document.querySelector('script[type="application/ld+json"]')) return;
    var el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(payload);
    document.head.appendChild(el);
  }

  if (!noindex) link("canonical", url);
  meta("property", "og:type", path === "/pricing" ? "product" : "website");
  meta("property", "og:site_name", "DreamUtopia");
  meta("property", "og:title", title, true);
  meta("property", "og:description", desc);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", title, true);
  meta("name", "twitter:description", desc);
  meta("name", "twitter:image", image);

  var org = {
    "@type": "Organization",
    "@id": ORIGIN + "/#org",
    name: "DreamUtopia",
    url: ORIGIN + "/",
    logo: ORIGIN + "/assets/images/logo.webp",
  };
  var website = {
    "@type": "WebSite",
    "@id": ORIGIN + "/#website",
    name: "DreamUtopia",
    url: ORIGIN + "/",
    description: "AI image and video tools. Public generation is not open yet.",
    publisher: { "@id": ORIGIN + "/#org" },
  };

  if (path === "/") {
    ld({ "@context": "https://schema.org", "@graph": [org, website] });
  } else if (path === "/pricing") {
    ld({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "DreamUtopia",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web",
          url: ORIGIN + "/",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            description: "Free to start. Paid checkout is not live.",
          },
        },
        {
          "@type": "Product",
          name: "DreamUtopia credit packs",
          description: "One-time credit packs for AI video and image generation. Payments coming soon.",
          brand: { "@type": "Brand", name: "DreamUtopia" },
          url: url,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/PreOrder",
            url: url,
          },
        },
      ],
    });
  } else if (!noindex) {
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description: desc,
      url: url,
      isPartOf: { "@id": ORIGIN + "/#website" },
    });
  }
})();
