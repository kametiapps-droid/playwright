/**
 * Pull raw link/image/meta data out of the live DOM. Runs inside the page
 * context via page.evaluate, so this function must be self-contained
 * (no closures over outer scope) — it's serialized and executed in-browser.
 */
export async function extractPageData(page) {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.href)
      .filter(Boolean);

    const images = Array.from(document.querySelectorAll('img')).map((img) => {
      const alt = img.getAttribute('alt');
      return {
        src: img.currentSrc || img.src || img.getAttribute('src') || null,
        alt,
        hasAlt: alt !== null && alt.trim().length > 0,
      };
    });

    const metaDescription =
      document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
    const h1Count = document.querySelectorAll('h1').length;
    const langAttr = document.documentElement.getAttribute('lang');

    return {
      title: document.title || null,
      metaDescription,
      canonical,
      h1Count,
      lang: langAttr,
      links,
      images,
    };
  });
}

/** Classify raw href strings as internal or external relative to a base origin. */
export function classifyLinks(rawLinks, baseOrigin) {
  const internal = [];
  const external = [];
  const invalid = [];

  for (const href of rawLinks) {
    try {
      const u = new URL(href);
      if (!/^https?:$/.test(u.protocol)) continue; // skip mailto:, tel:, javascript:, etc.
      if (u.origin === baseOrigin) internal.push(u.toString());
      else external.push(u.toString());
    } catch {
      invalid.push(href);
    }
  }

  const uniq = (arr) => Array.from(new Set(arr));

  return {
    totalCount: internal.length + external.length,
    internalCount: internal.length,
    externalCount: external.length,
    invalidCount: invalid.length,
    internalUnique: uniq(internal),
    externalUnique: uniq(external),
  };
}

/** Summarize image alt-text coverage. */
export function summarizeImages(images) {
  const missingAlt = images.filter((img) => !img.hasAlt);
  return {
    totalCount: images.length,
    withAltCount: images.length - missingAlt.length,
    missingAltCount: missingAlt.length,
    missingAltSamples: missingAlt.slice(0, 25).map((img) => img.src),
  };
}
