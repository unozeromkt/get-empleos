import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractDocumentText, DocumentExtractionError } from "@/lib/documents/extract-text";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "documents");
const read = (name: string) => readFileSync(join(FIXTURES, name));

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Casos de extracción de la spec §43. */
describe("extractDocumentText", () => {
  it("extrae el texto de un PDF con capa de texto (§43.1)", async () => {
    const result = await extractDocumentText(read("oferta-con-texto.pdf"), PDF);

    expect(result.text).toContain("Analista de Logistica");
    expect(result.text).toContain("Medellin");
    expect(result.needsOcr).toBe(false);
    expect(result.textHash).toHaveLength(64);
  });

  it("extrae el texto de un DOCX (§43.2)", async () => {
    const result = await extractDocumentText(read("oferta.docx"), DOCX);

    expect(result.text).toContain("Analista de Logistica");
    expect(result.text).toContain("Ingenieria Industrial");
    expect(result.needsOcr).toBe(false);
  });

  it("no inventa el salario cuando el documento no lo trae (§43.3)", async () => {
    const result = await extractDocumentText(read("oferta-sin-salario.pdf"), PDF);

    expect(result.text).toContain("Analista de Logistica");
    expect(result.text).not.toContain("4.500.000");
  });

  it("rechaza un documento vacío (§43.9)", async () => {
    await expect(extractDocumentText(read("vacio.pdf"), PDF)).rejects.toMatchObject({
      code: "EMPTY_DOCUMENT",
    });
  });

  it("rechaza un documento corrupto sin tumbar el worker (§43.10)", async () => {
    await expect(extractDocumentText(read("corrupto.pdf"), PDF)).rejects.toBeInstanceOf(
      DocumentExtractionError
    );
  });

  it("rechaza tipos MIME no soportados", async () => {
    await expect(
      extractDocumentText(Buffer.from("texto plano"), "text/plain")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MIME_TYPE" });
  });

  it("produce el mismo hash para el mismo contenido (idempotencia, spec §34)", async () => {
    const a = await extractDocumentText(read("oferta-con-texto.pdf"), PDF);
    const b = await extractDocumentText(read("oferta-con-texto.pdf"), PDF);

    expect(a.textHash).toBe(b.textHash);
  });
});
