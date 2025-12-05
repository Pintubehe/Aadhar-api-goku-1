// ==================== CONFIG =====================
const YOUR_API_KEYS = ["GOKU"]; // tumhara private key
const TARGET_API = "https://addartofamily.vercel.app/fetch"; // original Aadhaar API
const CACHE_TIME = 3600 * 1000; // 1 hour in ms
// =================================================

const cache = new Map();

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Sirf GET allow
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { aadhaar: rawAadhaar, key: rawKey } = req.query || {};

  // Param check
  if (!rawAadhaar || !rawKey) {
    return res.status(400).json({ error: "missing parameters: aadhaar or key" });
  }

  // Sanitise
  const aadhaar = String(rawAadhaar).replace(/\D/g, "");
  const key = String(rawKey).trim();

  // Key check
  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(aadhaar);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  // Upstream URL: addartofamily
  const url =
    TARGET_API +
    "?aadhaar=" +
    encodeURIComponent(aadhaar) +
    "&key=fxt";

  try {
    const upstream = await fetch(url);

    const raw = await upstream.text().catch(() => "");

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        status: upstream.status,
      });
    }

    let responseBody;

    // JSON try–catch
    try {
      const data = JSON.parse(raw);

      // Tumhari branding
      data.developer = "@gokuuuu_1";
      data.credit_by = "goku";
      data.powered_by = "goku Aadhaar API";

      responseBody = JSON.stringify(data);
    } catch {
      // Agar JSON nahi mila to raw hi pass-through
      responseBody = raw;
    }

    // Cache save
    cache.set(aadhaar, {
      timestamp: Date.now(),
      response: responseBody,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    return res.status(200).send(responseBody);
  } catch (err) {
    return res.status(502).json({
      error: "upstream request error",
      details: err.message || "unknown error",
    });
  }
};
