import { describe, it, expect } from "vitest";
import {
  coverageStatus,
  buildCoverageLines,
  summarizeCoverage,
} from "@/lib/coverage";

describe("coverageStatus", () => {
  it("is green when nothing is required", () => {
    expect(coverageStatus(0, 0, 0)).toBe("green");
    expect(coverageStatus(0, 3, 0)).toBe("green");
  });
  it("is red when the plan has fewer shifts than required", () => {
    expect(coverageStatus(3, 2, 2)).toBe("red");
    expect(coverageStatus(2, 0, 0)).toBe("red");
  });
  it("is amber when enough shifts exist but not all are confirmed", () => {
    expect(coverageStatus(3, 3, 2)).toBe("amber");
    expect(coverageStatus(2, 4, 1)).toBe("amber");
  });
  it("is green when every required shift is confirmed", () => {
    expect(coverageStatus(3, 3, 3)).toBe("green");
    expect(coverageStatus(2, 5, 2)).toBe("green");
  });
});

describe("buildCoverageLines", () => {
  it("computes scheduled/confirmed/open/gap per position", () => {
    const lines = buildCoverageLines(
      { CNA: 3, Nurse: 1 },
      [
        { position: "CNA", assigned: true },
        { position: "CNA", assigned: true },
        { position: "CNA", assigned: false },
        { position: "Nurse", assigned: false },
      ]
    );
    const cna = lines.find((l) => l.position === "CNA")!;
    expect(cna).toMatchObject({ required: 3, scheduled: 3, confirmed: 2, open: 1, gap: 1, status: "amber" });
    const nurse = lines.find((l) => l.position === "Nurse")!;
    expect(nurse).toMatchObject({ required: 1, scheduled: 1, confirmed: 0, open: 1, gap: 1, status: "amber" });
  });

  it("surfaces a required position with no shifts as red with the full gap", () => {
    const lines = buildCoverageLines({ Nurse: 2 }, []);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ position: "Nurse", required: 2, scheduled: 0, confirmed: 0, gap: 2, status: "red" });
  });

  it("includes extra (unrequired) shifts as green with zero gap", () => {
    const lines = buildCoverageLines({}, [{ position: "Cook", assigned: false }]);
    expect(lines[0]).toMatchObject({ position: "Cook", required: 0, scheduled: 1, confirmed: 0, gap: 0, status: "green" });
  });

  it("orders worst status first", () => {
    const lines = buildCoverageLines(
      { A: 1, B: 1, C: 1 },
      [
        { position: "A", assigned: true }, // green
        { position: "B", assigned: false }, // amber
        // C has no shift → red
      ]
    );
    expect(lines.map((l) => l.status)).toEqual(["red", "amber", "green"]);
    expect(lines.map((l) => l.position)).toEqual(["C", "B", "A"]);
  });
});

describe("summarizeCoverage", () => {
  it("sums the numbers and takes the worst status", () => {
    const lines = buildCoverageLines(
      { CNA: 2, Nurse: 1 },
      [
        { position: "CNA", assigned: true },
        { position: "CNA", assigned: true }, // CNA green
        // Nurse missing → red
      ]
    );
    const total = summarizeCoverage(lines);
    expect(total).toMatchObject({ required: 3, scheduled: 2, confirmed: 2, gap: 1, status: "red" });
  });

  it("is green only when every line is green", () => {
    const lines = buildCoverageLines(
      { CNA: 1 },
      [{ position: "CNA", assigned: true }]
    );
    expect(summarizeCoverage(lines).status).toBe("green");
  });
});
