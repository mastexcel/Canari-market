import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Espaces privés (comptes, back-office, API) exclus de l'indexation. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/fournisseur", "/livreur", "/point-relais", "/compte", "/panier", "/checkout", "/commandes", "/paiement", "/notifications"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
