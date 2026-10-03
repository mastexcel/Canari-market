// Exécute les tâches planifiées une fois (cron local). Usage : npm run jobs
import { runScheduledJobs } from "../src/application/jobs.service";
import { prisma } from "../src/infrastructure/db";

runScheduledJobs()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .finally(() => prisma.$disconnect());
