import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Werra POC API listening on http://127.0.0.1:${config.port}`);
  console.log(`CKB network: ${config.chainNetwork}`);

  if (config.usingDefaultDevSecret) {
    console.log("Using default development wallet encryption key. Set WERRA_WALLET_ENCRYPTION_KEY for shared POC environments.");
  }
});
