"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface DeptRow { id: string; name: string }
export interface PositionRow {
  id: string;
  name: string;
  licensed: boolean;
  requiredCredential: string | null;
  department: { id: string; name: string } | null;
}

export function PositionsEditor({
  departments,
  positions,
}: {
  departments: DeptRow[];
  positions: PositionRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dept, setDept] = useState("");
  const [pos, setPos] = useState({ name: "", departmentId: "", licensed: false, requiredCredential: "" });

  async function call(fn: () => Promise<Response>) {
    setBusy(true); setError(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Something went wrong"); return false; }
      router.refresh();
      return true;
    } catch { setError("Network error"); return false; }
    finally { setBusy(false); }
  }

  async function addDept(e: React.FormEvent) {
    e.preventDefault();
    if (await call(() => fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dept }) }))) setDept("");
  }
  async function addPos(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(() => fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pos) }));
    if (ok) setPos({ name: "", departmentId: "", licensed: false, requiredCredential: "" });
  }
  const retire = (id: string) => call(() => fetch(`/api/positions/${id}`, { method: "DELETE" }));

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Departments</h3>
        <form onSubmit={addDept} className="mb-2 flex gap-2">
          <input className="input py-2 text-sm" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="e.g. Nursing" required />
          <button className="btn-primary px-4 text-sm" disabled={busy}>Add</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {departments.length === 0 && <p className="text-sm text-slate-400">No departments yet.</p>}
          {departments.map((d) => (
            <span key={d.id} className="chip bg-slate-100 text-slate-600">{d.name}</span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Positions</h3>
        <form onSubmit={addPos} className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Name</label>
              <input className="input py-2 text-sm" value={pos.name} onChange={(e) => setPos({ ...pos, name: e.target.value })} placeholder="e.g. RN" required />
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input py-2 text-sm" value={pos.departmentId} onChange={(e) => setPos({ ...pos, departmentId: e.target.value })}>
                <option value="">— none —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={pos.licensed} onChange={(e) => setPos({ ...pos, licensed: e.target.checked })} />
            Requires a professional license (RN, LPN…)
          </label>
          <div>
            <label className="label">Required credential (optional)</label>
            <input
              className="input py-2 text-sm"
              value={pos.requiredCredential}
              onChange={(e) => setPos({ ...pos, requiredCredential: e.target.value })}
              placeholder="e.g. RN License — staff must hold a valid one"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              If set, only staff with a valid (non-expired) credential of this type can claim these shifts.
            </p>
          </div>
          <button className="btn-primary w-full" disabled={busy}>Add position</button>
        </form>

        <div className="mt-3 space-y-1">
          {positions.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              No positions yet. Add the roles your organization staffs (CNA, RN, LPN, Dietary…).
            </p>
          ) : positions.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
              <span>
                <span className="font-semibold text-slate-800">{p.name}</span>
                {p.department && <span className="text-slate-500"> · {p.department.name}</span>}
                {p.licensed && <span className="chip ml-2 bg-brand-50 text-brand-700">licensed</span>}
                {p.requiredCredential && <span className="chip ml-2 bg-amber-50 text-amber-700">needs {p.requiredCredential}</span>}
              </span>
              <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => retire(p.id)} disabled={busy}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
