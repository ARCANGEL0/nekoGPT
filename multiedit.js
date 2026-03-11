import fetch from 'node-fetch';

async function multiReq(prompt, arrays) {
  const response = await fetch("https://api.arcangelo.net/multiEdit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image: arrays }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const initData = await response.json();
  const taskId = initData.taskId;
  console.log(`[multiEdit] Task ID: ${taskId} - Started.`);

  while (true) {
    await new Promise(r => setTimeout(r, 7000));

    try {
      const checkResponse = await fetch("https://api.arcangelo.net/multiEdit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId }),
      });

      const text = await checkResponse.text();
      console.log(`\n\n\n\n-------${text}\n--------\n\n\n`)
      console.log(`[DEBUG] Raw Response for ${taskId}: ${text}`);

      if (!text.startsWith('{')) {
          console.log("[multiEdit] Received non-JSON response (Cloudflare/HTML), skipping...");
          continue;
      }

      const data = JSON.parse(text);

      if (data.status == "completed") {
        console.log(`[multiEdit] rsp detected! URL: ${data.response}`);
        return data.response;
      }


      else if (data.status === "error") {
        console.error(`[multiEdit] SERVER ERROR: ${data.message}`);

        if (data.message.includes("not found")) {
            console.log("[multiEdit]no existing task");
            return "error_failed";
        }
        return "error_failed";
      }

      console.log(`[multiEdit] working... Status: ${data.status}`);

    } catch (e) {
      console.log(`[multiEdit] Error: ${e.message}. Retrying...`);
    }
  }
}

export default multiReq;
