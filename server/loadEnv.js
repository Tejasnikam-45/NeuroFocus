import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));
// override: true → values in server/.env win over stale Windows/user env vars (fixes wrong redirect_uri)
dotenv.config({ path: join(dir, ".env"), override: true });
