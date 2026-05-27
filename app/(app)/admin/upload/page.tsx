import { UploadForm } from "./UploadForm";

export default function UploadPage() {
  return (
    <section className="max-w-3xl mx-auto w-full px-6 py-12">
      <div className="t-overline mb-4">— Admin · Subir entregable</div>
      <h1 className="t-h1 mb-3">
        Sube un <span className="accent-word">entregable</span>.
      </h1>
      <p className="t-lead mb-10">
        Sube un <code className="font-mono text-primary">.html</code>{" "}
        autocontenido (CSS y JS pueden ir inline o en el mismo archivo). Se
        sanitiza al subir y se renderiza dentro de un iframe aislado.
      </p>

      <div className="bg-bg rounded-2xl border border-border-card shadow-md p-6 sm:p-8">
        <UploadForm />
      </div>
    </section>
  );
}
