// ==================== CONFIG =====================
const YOUR_API_KEYS = ["GOKU"]; // tumhara private key
const TARGET_API_BASE = "https://suryansh.site/adhaar-info/api.php"; // new Aadhaar API
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
    return res.status(400).json({ 
      error: "missing parameters: aadhaar or key",
      usage: "?aadhaar=YOUR_AADHAAR_NUMBER&key=GOKU"
    });
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
      details: "Aadhaar number must be exactly 12 digits"
    });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(aadhaar);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  // Upstream URL: suryansh.site Aadhaar API
  const url = TARGET_API_BASE + 
    "?key=suryansh&aadhaar=" + 
    encodeURIComponent(aadhaar);

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://suryansh.site/'
      },
      timeout: 15000
    });

    const raw = await upstream.text().catch(() => "");

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        status: upstream.status,
        statusText: upstream.statusText,
        aadhaar_query: aadhaar
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
      data.cached = false; // This is a fresh response

      responseBody = JSON.stringify(data);
    } catch (e) {
      // Agar JSON nahi mila to raw hi pass-through with enhancement
      const enhancedData = {
        raw_response: raw,
        developer: "@gokuuuu_1",
        credit_by: "goku",
        powered_by: "goku Aadhaar API",
        query_aadhaar: aadhaar,
        timestamp: new Date().toISOString(),
        note: "Original response was not valid JSON"
      };
      responseBody = JSON.stringify(enhancedData);
    }

    // Cache save
    cache.set(aadhaar, {
      timestamp: Date.now(),
      response: responseBody,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    res.setHeader("X-Aadhaar-API-Source", "suryansh.site");
    return res.status(200).send(responseBody);
  } catch (err) {
    console.error("Aadhaar API Error:", err.message);
    return res.status(502).json({
      error: "upstream request error",
      details: err.message || "unknown error",
      aadhaar: aadhaar,
      developer: "@gokuuuu_1",
      timestamp: new Date().toISOString()
    });
  }
};
