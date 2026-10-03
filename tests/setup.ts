// Les tests d'intégration utilisent TEST_DATABASE_URL (base dédiée, vidée à chaque fichier).
import { config } from "dotenv";
config({ quiet: true });
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
(process.env as Record<string, string>).NODE_ENV = "test";
