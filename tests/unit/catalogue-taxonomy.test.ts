import { describe, expect, it } from "vitest";
import { RAYONS, UNIVERS, rayonFor } from "@/domain/catalogue-taxonomy";

describe("arborescence du catalogue", () => {
  it("compte 9 univers et 48 rayons, chacun rattaché à un univers existant", () => {
    expect(UNIVERS).toHaveLength(9);
    expect(RAYONS).toHaveLength(48);
    const slugs = new Set(UNIVERS.map((u) => u.slug));
    for (const r of RAYONS) expect(slugs.has(r.parent)).toBe(true);
    expect(new Set([...UNIVERS, ...RAYONS].map((c) => c.slug)).size).toBe(57);
  });

  it("range un produit dans le rayon de son univers", () => {
    expect(rayonFor("riz-parfume-long-grain-dinor", "alimentation")?.slug).toBe("riz-cereales");
    expect(rayonFor("huile-de-palme-raffinee-aya", "alimentation")?.slug).toBe("huiles-alimentaires");
    expect(rayonFor("savon-de-menage-savon-le-coq", "entretien")?.slug).toBe("entretien-nettoyage");
    expect(rayonFor("savon-de-toilette-lux", "hygiene")?.slug).toBe("hygiene-personnelle");
    expect(rayonFor("ananas-coop-bonoua", "legumes")?.slug).toBe("fruits");
    expect(rayonFor("igname", "legumes")?.slug).toBe("legumes-frais");
  });

  it("laisse dans l'univers un produit sans rayon correspondant", () => {
    expect(rayonFor("produit-inconnu", "alimentation")).toBeNull();
  });
});
