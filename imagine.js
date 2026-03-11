import fetch from 'node-fetch';

async function imgReq(prompt) {
  const response = await fetch("https://api.arcangelo.net/imagine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const initData = await response.json();
  const taskId = initData.taskId;
  console.log(`Imagine Task Started: ${taskId}`);

  while (true) {
    await new Promise(r => setTimeout(r, 6000));

    try {
      const checkResponse = await fetch("https://api.arcangelo.net/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId }),
      });

      const text = await checkResponse.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
          console.log("[Imagine] No JSON found in response, skipping...");
          continue;
      }

      const data = JSON.parse(jsonMatch[0]);

      if (data.status === "completed") {
        console.log(`[Imagine] Success! URL: ${data.response}`);
        return data.response;
      }

      if (data.status === "error") {
        console.error(`[Imagine] SERVER ERROR: ${data.message}`);
        return "error_failed";
      }

      console.log(`[Imagine] Status: ${data.status}...`);

    } catch (e) {
      console.log("[Imagine] Polling glitch, retrying...", e.message);
    }
  }
}

export default imgReq;
