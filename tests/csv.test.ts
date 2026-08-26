import { describe, it, expect } from "vitest";
import { csvCell, toCsv, parseCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("Jordan")).toBe("Jordan");
    expect(csvCell(42)).toBe("42");
  });
  it("empties null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes values with commas", () => {
    expect(csvCell("Rivera, Sam")).toBe('"Rivera, Sam"');
  });
  it("escapes embedded quotes by doubling", () => {
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
  });
  it("quotes values with newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("builds a header row and escapes cells", () => {
    const rows = [
      { name: "Jordan Lee", pay: 187 },
      { name: "Rivera, Sam", pay: 226 },
    ];
    const csv = toCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Pay", value: (r) => r.pay },
    ]);
    expect(csv).toBe('Name,Pay\r\nJordan Lee,187\r\n"Rivera, Sam",226');
  });

  it("produces just a header for no rows", () => {
    expect(toCsv([], [{ header: "A", value: () => "" }])).toBe("A");
  });
});

describe("parseCsv", () => {
  it("parses headers and rows into objects", () => {
    const rows = parseCsv("Name,Rate\nJordan,22.5\nSam,40");
    expect(rows).toEqual([
      { Name: "Jordan", Rate: "22.5" },
      { Name: "Sam", Rate: "40" },
    ]);
  });

  it("handles quoted fields with commas and doubled quotes", () => {
    const rows = parseCsv('Name,Note\n"Rivera, Sam","She said ""hi"""');
    expect(rows[0]).toEqual({ Name: "Rivera, Sam", Note: 'She said "hi"' });
  });

  it("handles CRLF line endings and a trailing newline", () => {
    const rows = parseCsv("A,B\r\n1,2\r\n");
    expect(rows).toEqual([{ A: "1", B: "2" }]);
  });

  it("strips a UTF-8 BOM and trims headers", () => {
    const rows = parseCsv("﻿ First Name ,Email\nJordan,j@x.com");
    expect(rows[0]).toEqual({ "First Name": "Jordan", Email: "j@x.com" });
  });

  it("returns [] for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
