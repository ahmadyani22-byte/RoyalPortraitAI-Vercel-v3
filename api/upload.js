module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "image is required" });

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY not configured" });

    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid base64 data URI" });

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const ext = contentType === "image/png" ? "png" : "jpeg";

    const initRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_name: "selfie." + ext, content_type: contentType }),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      return res.status(502).json({ error: "Upload initiate failed: " + initRes.status, detail: errText });
    }

    const initData = await initRes.json();

    const uploadRes = await fetch(initData.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: buffer,
    });

    if (!uploadRes.ok) {
      return res.status(502).json({ error: "File upload failed: " + uploadRes.status });
    }

    return res.status(200).json({ url: initData.file_url });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: err.message });
  }
};
