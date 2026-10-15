import { app } from "./src/app.js";
import { config } from "./src/config.js";

app.listen(config.port, () => {
  console.log(`AlgebraTutor AI running on http://localhost:${config.port} (provider: ${config.provider})`);
});
