import { LegalFooter } from "@/ui/LegalFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenu" className="mx-auto min-h-dvh max-w-md px-4 py-6">
      {children}
      <LegalFooter className="mt-8" />
    </main>
  );
}
