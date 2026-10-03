"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui", padding: 24, textAlign: "center" }}>
        <h1>Une erreur est survenue</h1>
        <p>Vos données sont en sécurité. Réessayez dans un instant.</p>
        <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 12, background: "#0e5f36", color: "#fff", border: 0 }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
