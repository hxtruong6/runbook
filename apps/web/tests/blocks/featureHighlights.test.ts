import { describe, it, expect } from "vitest";
import { featureHighlightsGetDef, featureHighlightsDismissDef } from "../../src/blocks/featureHighlights";
import { captureOutputs } from "../../src/blocks/capture";

describe("featureHighlights", () => {
  it("GET builds /v1/aligner/dentist/feature-highlights and captures showChairsideInstallBanner", () => {
    const req = featureHighlightsGetDef.build({});
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/feature-highlights$/);

    const captured = captureOutputs({ showChairsideInstallBanner: true }, featureHighlightsGetDef.outputs);
    expect(captured.showChairsideInstallBanner).toBe(true);
  });

  it("PUT sends { showChairsideInstallBanner: false }", () => {
    const req = featureHighlightsDismissDef.build({});
    expect(req.method).toBe("PUT");
    expect(req.body).toEqual({ showChairsideInstallBanner: false });
  });
});
