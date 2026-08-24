import { describe, it, expect } from "vitest";

import { isProfileCompleteForApplying } from "@/lib/utils/profile-complete";

describe("isProfileCompleteForApplying", () => {
  it("requiere los tres campos a la vez: nombre, teléfono y CV", () => {
    expect(
      isProfileCompleteForApplying({ fullName: "Ana", phone: "3001234567", cvUrl: "path/cv.pdf" })
    ).toBe(true);
  });

  it("falla si falta el CV, aunque el resto esté completo", () => {
    expect(
      isProfileCompleteForApplying({ fullName: "Ana", phone: "3001234567", cvUrl: null })
    ).toBe(false);
  });

  it("falla si falta el teléfono", () => {
    expect(
      isProfileCompleteForApplying({ fullName: "Ana", phone: null, cvUrl: "path/cv.pdf" })
    ).toBe(false);
  });

  it("falla si falta el nombre", () => {
    expect(
      isProfileCompleteForApplying({ fullName: null, phone: "3001234567", cvUrl: "path/cv.pdf" })
    ).toBe(false);
  });

  it("trata espacios en blanco como campo vacío", () => {
    expect(
      isProfileCompleteForApplying({ fullName: "   ", phone: "3001234567", cvUrl: "path/cv.pdf" })
    ).toBe(false);
    expect(
      isProfileCompleteForApplying({ fullName: "Ana", phone: "  ", cvUrl: "path/cv.pdf" })
    ).toBe(false);
  });

  it("no exige ningún otro campo del perfil (educación, experiencia, disponibilidad...)", () => {
    // Ningún dato "profesional" entra en esta función: es deliberadamente
    // el único criterio de negocio, no un checklist de 6 campos como antes.
    expect(
      isProfileCompleteForApplying({ fullName: "Ana", phone: "3001234567", cvUrl: "path/cv.pdf" })
    ).toBe(true);
  });

  it("falla si los tres campos están vacíos", () => {
    expect(isProfileCompleteForApplying({ fullName: null, phone: null, cvUrl: null })).toBe(false);
  });
});
