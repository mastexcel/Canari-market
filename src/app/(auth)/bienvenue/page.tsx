import { Onboarding } from "./Onboarding";
import { illustration } from "@/infrastructure/assets";

export const metadata = { title: "Bienvenue" };

export default function WelcomePage() {
  return <Onboarding images={[1, 2, 3].map((n) => illustration("onboarding", `etape-${n}`))} />;
}
