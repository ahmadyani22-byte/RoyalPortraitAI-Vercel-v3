module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image } = req.body;  // base64 data URI

    if (!image) {
      return res.status(400).json({ error: "image is required" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ error: "FAL_KEY not configured" });
    }

    // Step 1: Extract binary from base64 data URI
    // Format: "data:image/jpeg;base64,/9j/4AAQ..."
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid base64 data URI format" });
    }

    const contentType = matches[1];  // e.g. "image/jpeg"
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const ext = contentType === "image/png" ? "png" : "jpeg";

    // Step 2: Initiate upload to fal.ai CDN
    const initRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: "selfie." + ext,
        content_type: contentType,
      }),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      console.error("Upload initiate error:", initRes.status, errText);
      return res.status(502).json({ error: "Upload initiate failed: " + initRes.status, detail: errText });
    }

    const initData = await initRes.json();
    // initData has: { file_url, upload_url }

    // Step 3: Upload file binary to the presigned URL
    const uploadRes = await fetch(initData.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Upload PUT error:", uploadRes.status, errText);
      return res.status(502).json({ error: "File upload failed: " + uploadRes.status });
    }

    // Step 4: Return the CDN URL
    return res.status(200).json({
      url: initData.file_url,
    });

  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: err.message });
  }
};
