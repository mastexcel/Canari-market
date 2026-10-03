import { Onboarding } from "./Onboarding";
import { illustration } from "@/infrastructure/assets";
import { platformSavings } from "@/application/savings.service";
import { prisma } from "@/infrastructure/db";

export const metadata = { title: "Bienvenue" };
// Chiffres réels de la plateforme, rafraîchis toutes les 10 minutes.
export const revalidate = 600;

async function stats() {
  try {
    const [savings, openGroupBuys, pickupPoints] = await Promise.all([
      platformSavings(),
      prisma.groupBuy.count({ where: { status: "OPEN" } }),
      prisma.pickupPoint.count({ where: { isActive: true } }),
    ]);
    return { households: savings.households, total: savings.total, openGroupBuys, pickupPoints };
  } catch {
    return null; // base indisponible (build) : la page reste utilisable sans chiffres
  }
}

export default async function WelcomePage() {
  return <Onboarding images={[1, 2, 3].map((n) => illustration("onboarding", `etape-${n}`))} stats={await stats()} />;
}
