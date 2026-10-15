import { afterEach, describe, expect, it, vi } from "vitest";
import { readImageDimensions } from "../lib/files";

class FailingImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  set src(_value: string) {
    this.onerror?.(new Event("error"));
  }
}

describe("lettura delle dimensioni delle immagini", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rifiuta le immagini non decodificabili e revoca l'URL temporaneo", async () => {
    vi.stubGlobal("Image", FailingImage as unknown as typeof Image);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:immagine");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    const file = new File(["non un'immagine"], "foto.jpg", { type: "image/jpeg" });

    await expect(readImageDimensions(file)).rejects.toThrow("Immagine non leggibile.");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:immagine");
  });

  it("accetta HEIC senza dimensioni né tentare la decodifica", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    const file = new File(["heic"], "foto.heic", { type: "image/heic" });

    await expect(readImageDimensions(file)).resolves.toEqual({});
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
