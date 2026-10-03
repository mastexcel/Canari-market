import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(24, "SESSION_SECRET doit faire au moins 24 caractères"),
  PAYMENT_PROVIDER: z.string().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(12),
  CRON_SECRET: z.string().min(12),
  REDIS_URL: z.string().optional(),
  /** Phase 2 : ouvre les catégories périssables (frais, fruits & légumes). */
  PERISHABLES_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Variables d'environnement validées (échec explicite au démarrage si mal configuré). */
/** Configuration d'assortiment (lue à chaque appel : modifiable sans redéploiement de code). */
export function assortment() {
  return { perishablesEnabled: process.env.PERISHABLES_ENABLED === "true" };
}

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}
