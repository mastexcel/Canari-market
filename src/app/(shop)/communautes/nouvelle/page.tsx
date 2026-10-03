import { requireUser } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { COMMUNES } from "@/application/schemas";
import { PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { CreateCommunityForm } from "./CreateCommunityForm";

export const metadata = { title: "Créer une communauté" };

export default async function NewCommunityPage() {
  const user = await requireUser("/communautes/nouvelle");
  const points = await prisma.pickupPoint.findMany({ where: { isActive: true }, select: { id: true, name: true, commune: true }, orderBy: { commune: "asc" } });
  return (
    <div>
      <PageHeader title="Créer une communauté" subtitle="Rassemblez votre quartier, résidence, entreprise ou association." back={<BackLink href="/communautes" />} />
      <CreateCommunityForm communes={[...COMMUNES]} points={points} defaultCommune={user.commune ?? "Cocody"} />
    </div>
  );
}
