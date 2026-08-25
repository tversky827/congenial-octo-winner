"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string | null;
  active: boolean;
  baseRate: number;
  phone: string | null;
  employeeId: string | null;
  employmentType: string | null;
  hireDate: string | null; // YYYY-MM-DD
  notes: string | null;
  facility: { id: string; name: string } | null;
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  PER_DIEM: "Per diem",
};

const ROLE_LABEL: Record<string, string> = {
  CORPORATE: "Corporate",
  MANAGER: "Scheduler",
  WORKER: "Staff",
};

export function PeopleManager({
  people,
  facilities,
  currentUserId,
  positions,
}: {
  people: PersonRow[];
  facilities: { id: string; name: string }[];
  currentUserId: string;
  positions: string[];
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openProfile, setOpenProfile] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {people.map((p) => {
        const isSelf = p.id === currentUserId;
        return (
          <div key={p.id} className={`card ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {p.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{p.email}</p>
                {p.position && <p className="text-xs text-slate-400">{p.position}</p>}
              </div>
              <span className="chip bg-brand-50 text-brand-700">{ROLE_LABEL[p.role] ?? p.role}</span>
            </div>

            {isSelf ? (
              <p className="mt-3 text-xs text-slate-400">
                You can&apos;t change your own access here.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Access</label>
                  <select
                    className="input py-2 text-sm"
                    value={p.role}
                    disabled={savingId === p.id}
                    onChange={(e) => patch(p.id, { role: e.target.value })}
                  >
                    <option value="WORKER">Staff</option>
                    <option value="MANAGER">Scheduler</option>
                    <option value="CORPORATE">Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Facility</label>
                  <select
                    className="input py-2 text-sm"
                    value={p.facility?.id ?? ""}
                    disabled={savingId === p.id || p.role === "CORPORATE"}
                    onChange={(e) => patch(p.id, { facilityId: e.target.value })}
                  >
                    <option value="">{p.role === "CORPORATE" ? "All facilities" : "Choose…"}</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                {p.role === "WORKER" && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Staff role</label>
                    <select
                      className="input py-2 text-sm"
                      value={p.position ?? ""}
                      disabled={savingId === p.id}
                      onChange={(e) => patch(p.id, { position: e.target.value })}
                    >
                      <option value="" disabled>Choose a role…</option>
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">Sets which shifts they can see and claim.</p>
                  </div>
                )}
                {p.role !== "CORPORATE" && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Pay rate ($/hr)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input py-2 text-sm"
                      defaultValue={p.baseRate || ""}
                      placeholder="e.g. 24.00"
                      disabled={savingId === p.id}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        const next = isNaN(val) ? 0 : val;
                        if (next !== p.baseRate) patch(p.id, { baseRate: next });
                      }}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      This is what they earn per hour — used to show their pay on each shift.
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    onClick={() => setOpenProfile((cur) => (cur === p.id ? null : p.id))}
                  >
                    {openProfile === p.id ? "Hide profile ▲" : "Employment profile ▾"}
                  </button>
                </div>

                {openProfile === p.id && (
                  <ProfileEditor person={p} saving={savingId === p.id} onSave={(body) => patch(p.id, body)} />
                )}

                <div className="col-span-2 flex justify-end">
                  <button
                    className="text-xs font-medium text-slate-400 hover:text-red-600"
                    disabled={savingId === p.id}
                    onClick={() => patch(p.id, { active: !p.active })}
                  >
                    {p.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Expandable HR profile: contact + employment details for one person.
function ProfileEditor({
  person,
  saving,
  onSave,
}: {
  person: PersonRow;
  saving: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    phone: person.phone ?? "",
    employeeId: person.employeeId ?? "",
    employmentType: person.employmentType ?? "PER_DIEM",
    hireDate: person.hireDate ?? "",
    notes: person.notes ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="col-span-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Phone</label>
          <input className="input py-2 text-sm" type="tel" value={form.phone} onChange={set("phone")} placeholder="(555) 123-4567" disabled={saving} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Employee ID</label>
          <input className="input py-2 text-sm" value={form.employeeId} onChange={set("employeeId")} placeholder="HR / payroll #" disabled={saving} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Employment type</label>
          <select className="input py-2 text-sm" value={form.employmentType} onChange={set("employmentType")} disabled={saving}>
            {Object.entries(EMPLOYMENT_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hire date</label>
          <input className="input py-2 text-sm" type="date" value={form.hireDate} onChange={set("hireDate")} disabled={saving} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Internal notes</label>
        <textarea className="input py-2 text-sm" rows={2} value={form.notes} onChange={set("notes")} placeholder="Visible to schedulers & admins only." disabled={saving} />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary py-2 text-sm"
          disabled={saving}
          onClick={() => onSave(form)}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
