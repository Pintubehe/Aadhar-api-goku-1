// ==================== CONFIG =====================
const YOUR_API_KEYS = ["GOKU"]; // tumhara private key
const TARGET_API_BASE = "https://niloy-api.vercel.app/api"; // new Aadhaar API
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

  // Aadhaar validation (12 digits)
  if (!/^\d{12}$/.test(aadhaar)) {
    return res.status(400).json({ 
      error: "invalid aadhaar format",
      details: "Aadhaar number must be 12 digits"
    });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(aadhaar);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  // Upstream URL: niloy-api
  const url = TARGET_API_BASE + 
    "?key=Niloy&aadhaar=" + 
    encodeURIComponent(aadhaar);

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const raw = await upstream.text().catch(() => "");

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        status: upstream.status,
        aadhaar: aadhaar
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
      data.query_aadhaar = aadhaar;
      data.timestamp = new Date().toISOString();

      responseBody = JSON.stringify(data);
    } catch {
      // Agar JSON nahi mila to raw hi pass-through
      const enhancedData = {
        raw_data: raw,
        developer: "@gokuuuu_1",
        credit_by: "goku",
        powered_by: "goku Aadhaar API",
        query_aadhaar: aadhaar,
        timestamp: new Date().toISOString()
      };
      responseBody = JSON.stringify(enhancedData);
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
      aadhaar: aadhaar,
      developer: "@gokuuuu_1"
    });
  }
};
