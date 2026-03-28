module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, negative_prompt, image_url, id_weight, image_size } = req.body;

    if (!prompt || !image_url) {
      return res.status(400).json({ error: "prompt and image_url are required" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ error: "FAL_KEY not configured. Set it in Vercel Environment Variables." });
    }

    const response = await fetch("https://queue.fal.run/fal-ai/flux-pulid", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: negative_prompt || "bad quality, worst quality, text, watermark, extra limbs, deformed, ugly, blurry, disfigured",
        reference_image_url: image_url,
        image_size: image_size || "portrait_4_3",
        num_inference_steps: 20,
        guidance_scale: 4,
        id_weight: id_weight || 1,
        enable_safety_checker: true,
        max_sequence_length: "128",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("fal.ai submit error:", response.status, errText);
      return res.status(502).json({ error: "fal.ai error: " + response.status, detail: errText });
    }

    const data = await response.json();

    return res.status(200).json({
      request_id: data.request_id,
      status_url: data.status_url,
      response_url: data.response_url,
    });
  } catch (err) {
    console.error("submit error:", err);
    return res.status(500).json({ error: err.message });
  }
};
