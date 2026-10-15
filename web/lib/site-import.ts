import { isIP } from "node:net";
import { load } from "cheerio";

export type SiteLink = { label: string; href: string };
export type SiteChrome = {
  sourceUrl: string;
  siteName: string | null;
  logoUrl: string | null;
  nav: SiteLink[];
  footer: {
    links: SiteLink[];
    socials: SiteLink[];
    emails: string[];
    phones: string[];
    lines: string[];
  };
};

type SocialLabel =
  | "Instagram"
  | "Facebook"
  | "TikTok"
  | "YouTube"
  | "LinkedIn"
  | "X"
  | "Pinterest"
  | "TripAdvisor";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveUrl(value: string, pageUrl: string): string | null {
  try {
    return new URL(value, pageUrl).href;
  } catch {
    return null;
  }
}

function labelFor($: ReturnType<typeof load>, element: Parameters<ReturnType<typeof load>>[0]): string {
  const anchor = $(element);
  return (
    collapseWhitespace(anchor.text()) ||
    collapseWhitespace(anchor.attr("aria-label") ?? "") ||
    collapseWhitespace(anchor.attr("title") ?? "")
  );
}

function linkFor(
  $: ReturnType<typeof load>,
  element: Parameters<ReturnType<typeof load>>[0],
  pageUrl: string,
): SiteLink | null {
  const label = labelFor($, element);
  const href = $(element).attr("href")?.trim();

  if (
    !label ||
    !href ||
    href === "#" ||
    /^(?:javascript|mailto|tel):/i.test(href)
  ) {
    return null;
  }

  const absoluteHref = resolveUrl(href, pageUrl);
  if (!absoluteHref || !/^https?:/i.test(absoluteHref)) return null;

  return { label, href: absoluteHref };
}

function addUniqueLink(
  links: SiteLink[],
  seenLabels: Set<string>,
  link: SiteLink | null,
  limit: number,
): void {
  if (!link || links.length >= limit) return;

  const key = link.label.toLowerCase();
  if (seenLabels.has(key)) return;

  seenLabels.add(key);
  links.push(link);
}

function decodeURIComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function socialLabel(hostname: string): SocialLabel | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
  if (host === "facebook.com" || host.endsWith(".facebook.com")) return "Facebook";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    return "YouTube";
  }
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "LinkedIn";
  if (
    host === "x.com" ||
    host.endsWith(".x.com") ||
    host === "twitter.com" ||
    host.endsWith(".twitter.com")
  ) {
    return "X";
  }
  if (/^(?:[\w-]+\.)*pinterest\.[a-z.]+$/.test(host)) return "Pinterest";
  if (/^(?:[\w-]+\.)*tripadvisor\.[a-z.]+$/.test(host)) return "TripAdvisor";

  return null;
}

function ipv4IsPrivate(address: string): boolean {
  if (isIP(address) !== 4) return false;

  const octets = address.split(".").map(Number);
  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function ipv6Groups(address: string): number[] | null {
  if (isIP(address) !== 6) return null;

  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;

  const expand = (part: string): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];

    for (const token of part.split(":")) {
      if (token.includes(".")) {
        const octets = token.split(".").map(Number);
        if (octets.length !== 4 || octets.some((octet) => octet < 0 || octet > 255)) {
          return null;
        }
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[\da-f]{1,4}$/i.test(token)) return null;
        groups.push(Number.parseInt(token, 16));
      }
    }

    return groups;
  };

  const left = expand(halves[0]);
  const right = expand(halves.length === 2 ? halves[1] : "");
  if (!left || !right) return null;

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const zeroGroups = 8 - left.length - right.length;
  if (zeroGroups < 1) return null;

  return [...left, ...Array<number>(zeroGroups).fill(0), ...right];
}

export function isPrivateAddress(ip: string): boolean {
  const address = ip.trim().split("%")[0];

  if (ipv4IsPrivate(address)) return true;
  if (isIP(address) !== 6) return false;

  const groups = ipv6Groups(address);
  if (!groups) return false;

  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;

  if (isIpv4Mapped) {
    const first = groups[6] >> 8;
    const second = groups[6] & 0xff;
    const third = groups[7] >> 8;
    const fourth = groups[7] & 0xff;
    return ipv4IsPrivate(`${first}.${second}.${third}.${fourth}`);
  }

  const isUnspecified = groups.every((group) => group === 0);
  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80;

  return isUnspecified || isLoopback || isUniqueLocal || isLinkLocal;
}

export function parseSiteChrome(html: string, pageUrl: string): SiteChrome {
  const $ = load(html);
  let headerRoot = $("header").first();

  if (!headerRoot.length) headerRoot = $('[role="banner"]').first();
  if (!headerRoot.length) headerRoot = $("body").first();

  const headerImages = headerRoot.find("img");
  const logoImage =
    headerImages
      .filter((_, image) =>
        ["id", "class", "alt", "src"].some((attribute) =>
          /logo/i.test($(image).attr(attribute) ?? ""),
        ),
      )
      .first() ?? headerImages.first();
  const selectedLogo = logoImage.length ? logoImage : headerImages.first();
  const logoUrl = selectedLogo.length
    ? resolveUrl(selectedLogo.attr("src") || selectedLogo.attr("data-src") || "", pageUrl)
    : null;
  const logoAlt = selectedLogo.length
    ? collapseWhitespace(selectedLogo.attr("alt") ?? "")
    : "";
  const siteName =
    collapseWhitespace($('meta[property="og:site_name"]').attr("content") ?? "") ||
    logoAlt ||
    collapseWhitespace($("title").first().text()).split(/\s+\|\s+|\s+–\s+|\s+-\s+/)[0] ||
    null;

  let navAnchors = $("header nav a");
  if (!navAnchors.length) navAnchors = $("nav").first().find("a");
  if (!navAnchors.length) navAnchors = headerRoot.find("a");

  const nav: SiteLink[] = [];
  const seenNavLabels = new Set<string>();
  navAnchors.each((_, anchor) => {
    addUniqueLink(nav, seenNavLabels, linkFor($, anchor, pageUrl), 8);
  });

  let footerRoot = $("footer").last();
  if (!footerRoot.length) footerRoot = $('[role="contentinfo"]').first();
  if (!footerRoot.length) footerRoot = $(".footer").first();

  const footer = {
    links: [] as SiteLink[],
    socials: [] as SiteLink[],
    emails: [] as string[],
    phones: [] as string[],
    lines: [] as string[],
  };

  if (footerRoot.length) {
    const seenFooterLinkLabels = new Set<string>();
    const seenSocialLabels = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const footerLinkLabels = new Set<string>();
    const footerAnchors = footerRoot.find("a");

    footerAnchors.each((_, anchor) => {
      const rawHref = $(anchor).attr("href")?.trim() ?? "";
      const lowerHref = rawHref.toLowerCase();
      const label = labelFor($, anchor);

      if (label) footerLinkLabels.add(label.toLowerCase());

      if (lowerHref.startsWith("mailto:")) {
        const addresses = decodeURIComponentSafely(rawHref.slice(7).split("?")[0])
          .split(/[;,]/)
          .map(collapseWhitespace)
          .filter(Boolean);

        for (const email of addresses) {
          const key = email.toLowerCase();
          if (!seenEmails.has(key)) {
            seenEmails.add(key);
            footer.emails.push(email);
          }
        }
        return;
      }

      if (lowerHref.startsWith("tel:")) {
        const phone = collapseWhitespace(
          decodeURIComponentSafely(rawHref.slice(4).split("?")[0]),
        );
        const key = phone.toLowerCase();
        if (phone && !seenPhones.has(key)) {
          seenPhones.add(key);
          footer.phones.push(phone);
        }
        return;
      }

      if (rawHref && rawHref !== "#") {
        const absoluteHref = resolveUrl(rawHref, pageUrl);
        if (absoluteHref && /^https?:/i.test(absoluteHref)) {
          const labelForSocial = socialLabel(new URL(absoluteHref).hostname);
          if (labelForSocial) {
            if (!seenSocialLabels.has(labelForSocial)) {
              seenSocialLabels.add(labelForSocial);
              footer.socials.push({ label: labelForSocial, href: absoluteHref });
            }
            return;
          }
        }
      }

      const link = linkFor($, anchor, pageUrl);
      if (!link) return;
      addUniqueLink(footer.links, seenFooterLinkLabels, link, 12);
    });

    const lines: string[] = [];
    footerRoot.find("p, address, small").each((_, element) => {
      const line = collapseWhitespace($(element).text());
      if (line) lines.push(line);
    });
    footerRoot.find("*").add(footerRoot).each((_, element) => {
      const ownText = collapseWhitespace(
        $(element)
          .contents()
          .filter((_, child) => child.type === "text")
          .text(),
      );
      if (ownText && /©|P\.?\s?IVA|VAT/i.test(ownText)) lines.push(ownText);
    });

    const seenLines = new Set<string>();
    for (const value of lines) {
      const line = collapseWhitespace(value);
      const key = line.toLowerCase();
      if (
        line.length < 3 ||
        line.length > 160 ||
        footerLinkLabels.has(key) ||
        seenLines.has(key)
      ) {
        continue;
      }

      seenLines.add(key);
      footer.lines.push(line);
      if (footer.lines.length === 6) break;
    }
  }

  return {
    sourceUrl: pageUrl,
    siteName,
    logoUrl,
    nav,
    footer,
  };
}
