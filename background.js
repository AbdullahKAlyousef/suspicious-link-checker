// background.js - Updated heuristics with rational weights + expanded keyword lists

// Create the context menu every time the service worker starts (robust)
chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);
function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "check-link-safety",
      title: "Check link safety",
      contexts: ["link"]
    });
  });
}

// ----------------- Heuristic weights (tunable) -----------------
const WEIGHTS = {
  NOT_HTTPS: 40,
  IP_HOST: 45,
  PUNYCODE: 40,
  SHORTENER: 20,
  MANY_SUBDOMAINS: 15,
  UNUSUAL_PORT: 15,
  LONG_PATH: 10,
  MANY_PARAMS: 10,
  LONG_QUERY: 8,
  LOOKS_LIKE_BRAND: 60
};

const RISK_THRESHOLDS = { HIGH: 75, MEDIUM: 40 };

// ----------------- Helper functions -----------------
function toURL(u) { try { return new URL(u); } catch { return null; } }

function isIP(host) {
  // exact IPv4 dotted-decimal
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isShortener(host) {
  // expanded popular shorteners (not exhaustive)
  const list = new Set([
    "bit.ly","t.co","tinyurl.com","tiny.cc","ow.ly","buff.ly","adf.ly","rebrand.ly",
    "rb.gy","is.gd","cutt.ly","shorte.st","soo.gd","trib.al","vcf.me","youtu.be",
    "lnkd.in","t.ly","s.id","shorturl.at","soo.gd","short.cm","mcaf.ee","urlzs.com"
  ]);
  return list.has(host);
}

function hasUnicode(host) {
  // detect non-ascii or punycode prefix
  return /[^\x00-\x7F]/.test(host) || host.startsWith("xn--");
}

function dist(a, b) {
  // Levenshtein distance (small strings only)
  const m = a.length, n = b.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + (a[j-1] === b[i-1] ? 0 : 1)
      );
    }
  }
  return dp[n][m];
}

function looksLike(target, canonicalList) {
  target = target.toLowerCase();
  for (const good of canonicalList) {
    if (target === good) return false; // exact match is fine
    // treat distance 1 or a substitution of similar characters as suspicious
    if (dist(target, good) <= 1) return true;
  }
  return false;
}

// ----------------- Expanded high-value brand list -----------------
const HIGH_VALUE_BRANDS = [
  "google.com","gmail.com","microsoft.com","outlook.com","live.com","office.com",
  "paypal.com","amazon.com","apple.com","facebook.com","instagram.com","linkedin.com",
  "netflix.com","adobe.com","bankofamerica.com","chase.com","wellsfargo.com","hsbc.com",
  "paypal.com","stripe.com","dropbox.com","slack.com","zoom.us","spotify.com","twitter.com",
  "github.com","gitlab.com","steamcommunity.com"
];

// ----------------- Scoring function -----------------
function scoreFindings(url) {
  const u = toURL(url);
  if (!u) return { url: url || "(invalid)", hostname: "(invalid)", score: 100, level: "High", reasons: ["Invalid or malformed URL"] };

  const reasons = [];
  let score = 0;

  // 1) Protocol (HTTPS)
  if (u.protocol !== "https:") {
    score += WEIGHTS.NOT_HTTPS;
    reasons.push("Not HTTPS (connection not encrypted)");
  }

  // 2) IP literal host
  if (isIP(u.hostname)) {
    score += WEIGHTS.IP_HOST;
    reasons.push("IP address used instead of domain");
  }

  // 3) Unicode / punycode homograph risk
  if (hasUnicode(u.hostname)) {
    score += WEIGHTS.PUNYCODE;
    reasons.push("Non-ASCII or punycode in domain (possible homograph)");
  }

  // 4) Known shortener services
  if (isShortener(u.hostname)) {
    score += WEIGHTS.SHORTENER;
    reasons.push("URL shortener (destination hidden)");
  }

  // 5) Subdomain depth
  const parts = u.hostname.split(".").filter(Boolean);
  const subCount = Math.max(0, parts.length - 2); // avoid negatives for short hosts
  if (subCount >= 2) {
    score += WEIGHTS.MANY_SUBDOMAINS;
    reasons.push("Many subdomains (possible cloaking)");
  }

  // 6) Unusual port (flag if not default)
  if (u.port) {
    const port = String(u.port);
    const defaultOK = (u.protocol === "https:" && port === "443") || (u.protocol === "http:" && port === "80");
    if (!defaultOK) {
      score += WEIGHTS.UNUSUAL_PORT;
      reasons.push(`Unusual port (${port})`);
    }
  }

  // 7) Long path or query (obfuscation)
  if (u.pathname && u.pathname.length > 80) {
    score += WEIGHTS.LONG_PATH;
    reasons.push("Very long path (possible obfuscation)");
  }
  const paramCount = [...u.searchParams.keys()].length;
  if (paramCount > 8) {
    score += WEIGHTS.MANY_PARAMS;
    reasons.push("Many query parameters");
  }
  if (u.searchParams.toString().length > 120) {
    score += WEIGHTS.LONG_QUERY;
    reasons.push("Very long query string");
  }

  // 8) Look-alike / typosquat checks for high value brands
  // Compare the effective second-level domain (very basic)
  const topDomain = parts.slice(-2).join(".");
  if (looksLike(topDomain, HIGH_VALUE_BRANDS)) {
    score += WEIGHTS.LOOKS_LIKE_BRAND;
    reasons.push("Domain looks like a high-value brand (possible typosquatting)");
  }

  // final clamp
  score = Math.max(0, Math.min(100, score));

  const level = score >= RISK_THRESHOLDS.HIGH ? "High" : score >= RISK_THRESHOLDS.MEDIUM ? "Medium" : "Low";
  return { url, hostname: u.hostname, score, level, reasons };
}

// -----------------------------------------------------------

// When user clicks "Check link safety"
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "check-link-safety") return;
  try {
    const result = scoreFindings(info.linkUrl);
    await chrome.storage.local.set({ lastCheck: result });
    // Open results in a tab (more reliable than openPopup)
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  } catch (e) {
    console.error("Error during check:", e);
  }
});
