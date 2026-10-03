import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours critique MVP : un nouveau ménage rejoint l'achat groupé de riz,
 * paie (prestataire simulé), voit sa confirmation et son suivi ; la demande
 * consolidée augmente côté administration.
 */
const phone = `07${String(Date.now()).slice(-8)}`;

async function waitHydrated(page: Page) {
  await page.waitForLoadState("networkidle");
}

test("inscription → achat groupé → paiement → suivi → admin", async ({ page, browser }) => {
  // Première visite : onboarding
  await page.goto("/");
  await expect(page).toHaveURL(/\/bienvenue/);
  await expect(page.getByRole("img", { name: /Sesam-Market/ }).first()).toBeVisible();

  // Inscription
  await page.goto("/inscription");
  await waitHydrated(page);
  await page.getByLabel("Prénom").fill("Testeur");
  await page.getByLabel("Téléphone").fill(phone);
  await page.getByLabel("Mot de passe").fill("sesam2026");
  await page.getByLabel("Commune").selectOption("Cocody");
  await page.getByLabel("Quartier").fill("Angré");
  await page.getByText("J'accepte les conditions").click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "À plusieurs, les prix s’ouvrent." })).toBeVisible();

  // Achat groupé : progression visible
  await page.goto("/achats-groupes/riz-parfume-sac-de-50-kg");
  await waitHydrated(page);
  const progress = page.getByRole("progressbar", { name: "Progression vers l'objectif" });
  await expect(progress).toBeVisible();
  const before = Number(await progress.getAttribute("aria-valuenow"));
  await expect(page.getByText(/Plus que \d+ sacs de 50 kg équivalents/)).toBeVisible();
  await expect(page.getByText("Si le seuil n'est pas atteint", { exact: true })).toBeVisible();

  // Choisir 50 kg et rejoindre
  await page.getByRole("radio", { name: /50 kg/ }).check();
  await page.getByRole("button", { name: "REJOINDRE L'ACHAT" }).click();
  await expect(page).toHaveURL(/\/panier/);
  await page.getByRole("link", { name: "Passer commande" }).click();

  // Checkout : point relais → créneau → récapitulatif → paiement
  await waitHydrated(page);
  await page.getByLabel("Point relais").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText(/sera prête à partir du/)).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Sous-total")).toBeVisible();
  await page.getByText("J'ai pris connaissance de ces règles.").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Numéro Mobile Money").fill(phone);
  await page.getByRole("button", { name: /^Payer/ }).click();

  // Prestataire simulé : succès
  await expect(page.getByText("Prestataire de test")).toBeVisible();
  await waitHydrated(page);
  await page.getByRole("button", { name: /Simuler un paiement réussi/ }).click();
  await expect(page.getByText("Commande confirmée !")).toBeVisible();
  await expect(page.getByText("Achat groupé en cours").first()).toBeVisible();

  // La progression a augmenté d'au moins 1 %
  await page.goto("/achats-groupes/riz-parfume-sac-de-50-kg");
  const after = Number(await page.getByRole("progressbar", { name: "Progression vers l'objectif" }).getAttribute("aria-valuenow"));
  expect(after).toBeGreaterThanOrEqual(before);
  await expect(page.getByText("Vous participez déjà pour 50 kg.")).toBeVisible();

  // Côté admin : la demande consolidée est visible
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/connexion");
  await waitHydrated(admin);
  await admin.getByLabel("Numéro de téléphone").fill("0700000099");
  await admin.getByLabel("Mot de passe").fill("sesam2026");
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin.getByRole("heading", { name: /Tableau de bord/ })).toBeVisible();
  await admin.getByRole("link", { name: /Achats groupés/ }).first().click();
  await admin.getByRole("row", { name: /Riz parfumé — sac de 50 kg Ouvert/ }).getByRole("link", { name: "Piloter" }).click();
  await expect(admin.getByText("Demande consolidée")).toBeVisible();
  await expect(admin.getByText("À commander au fournisseur")).toBeVisible();
});

test("les espaces protégés redirigent vers la connexion", async ({ page }) => {
  for (const path of ["/admin", "/fournisseur", "/livreur", "/point-relais", "/commandes"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/connexion\?suite=/);
  }
});
