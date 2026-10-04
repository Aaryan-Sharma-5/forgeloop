import { createForgeServer } from "./server.js";

const port = Number(process.env.PORT) || 3000;
const server = createForgeServer();

server
  .listen(port)
  .then((actualPort) => {
    console.log(`====================================================`);
    console.log(`🚀 ForgeLoop Server running on http://localhost:${actualPort}`);
    console.log(`📡 Health Check: http://localhost:${actualPort}/health`);
    console.log(
      `🤖 AI Mode: ${
        process.env.GROQ_API_KEY
          ? "ONLINE (Live Groq Llama 3.3 70B)"
          : "OFFLINE (Deterministic Built-in Models)"
      }`
    );
    console.log(`====================================================`);
  })
  .catch((err) => {
    console.error("Failed to start ForgeLoop server:", err);
    process.exit(1);
  });
