// @ts-nocheck
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import Papa from "papaparse";
import { Upload, Download, X, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  societyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Row {
  tower_name: string;
  unit_number: string;
  floor: string;
  unit_type: string;
  area_sqft?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  resident_type?: string;
  parking_slots?: string;
  _valid?: boolean;
  _errors?: string[];
}

const UNIT_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK", "Studio", "Penthouse"];
const RESIDENT_TYPES = ["owner", "tenant"];

function validate(row: Row): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.tower_name?.trim()) errors.push("tower_name required");
  if (!row.unit_number?.trim()) errors.push("unit_number required");
  if (!row.floor?.trim() || isNaN(Number(row.floor))) errors.push("floor must be integer");
  if (!row.unit_type?.trim() || !UNIT_TYPES.includes(row.unit_type.trim()))
    errors.push(`unit_type must be one of: ${UNIT_TYPES.join(", ")}`);
  if (row.area_sqft?.trim() && isNaN(Number(row.area_sqft)))
    errors.push("area_sqft must be integer");
  if (row.owner_phone?.trim() && !/^\+?\d{10,15}$/.test(row.owner_phone.trim()))
    errors.push("owner_phone invalid (use E.164 format e.g. +919876543210)");
  if (row.resident_type?.trim() && !RESIDENT_TYPES.includes(row.resident_type.trim()))
    errors.push("resident_type must be owner or tenant");
  return { valid: errors.length === 0, errors };
}

const CSV_TEMPLATE = [
  "tower_name,unit_number,floor,unit_type,area_sqft,owner_name,owner_phone,owner_email,resident_type,parking_slots",
  "Tower A,A-101,1,2BHK,1050,Ravi Kumar,+919876543210,ravi@example.com,owner,\"P-01, P-02\"",
  "Tower A,A-102,1,1BHK,750,,,,,P-03",
  "Tower B,B-201,2,3BHK,1450,,,,tenant,",
].join("\n");

export default function BulkUnitUpload({ societyId, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]   = useState<Row[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    a.download = "nestlink_units_template.csv";
    a.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: Row[] = (results.data as Row[]).map((r) => {
          const { valid, errors } = validate(r);
          return { ...r, _valid: valid, _errors: errors };
        });
        setRows(parsed);
        setResult(null);
      },
    });
    e.target.value = "";
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = rows.filter((r) => r._valid);
      if (validRows.length === 0) throw new Error("No valid rows to import");

      const payload = validRows.map((r) => ({
        tower_name:    r.tower_name.trim(),
        unit_number:   r.unit_number.trim(),
        floor:         Number(r.floor),
        unit_type:     r.unit_type.trim(),
        area_sqft:     r.area_sqft?.trim() ? Number(r.area_sqft) : null,
        owner_name:    r.owner_name?.trim() || null,
        owner_phone:   r.owner_phone?.trim() || null,
        owner_email:   r.owner_email?.trim() || null,
        resident_type: r.resident_type?.trim() || "owner",
        parking_slots: r.parking_slots?.trim() || null,
      }));

      const { data, error } = await supabase.rpc("bulk_upload_units", {
        p_society_id: societyId,
        p_rows:       payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setResult(data);
      toast.success(`Imported ${data.inserted} unit(s)`);
      if (data.inserted > 0) onSuccess();
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const validCount   = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-violet-900/40 bg-[#181825] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-violet-900/20">
          <div>
            <h2 className="text-base font-bold text-white">Bulk Unit Upload</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload a CSV to create towers, flats, and parking slots in bulk</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" /> Download Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              <Upload className="h-4 w-4" /> Select CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {/* Column reference */}
          {rows.length === 0 && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-5">
              <p className="text-xs font-semibold text-slate-400 mb-3">CSV columns reference</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-slate-500">
                {[
                  ["tower_name *", "e.g. Tower A, Block B"],
                  ["unit_number *", "e.g. A-101, 201 — unique per tower"],
                  ["floor *", "Integer e.g. 1, 2, 3"],
                  ["unit_type *", "1BHK / 2BHK / 3BHK / 4BHK / Studio / Penthouse"],
                  ["area_sqft", "Integer (optional)"],
                  ["owner_name", "Creates invitation (optional)"],
                  ["owner_phone", "E.164 format e.g. +919876543210"],
                  ["owner_email", "Optional"],
                  ["resident_type", "owner (default) or tenant"],
                  ["parking_slots", "Comma-separated e.g. P-01, P-02"],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-2">
                    <span className="font-mono text-slate-300 min-w-28">{col}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />{validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="h-4 w-4" />{invalidCount} with errors
                  </span>
                )}
                <span className="text-slate-500">{rows.length} total rows</span>
              </div>

              <div className="rounded-xl border border-violet-900/20 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#181825]">
                      <tr className="border-b border-violet-900/20">
                        {["", "Tower", "Unit #", "Floor", "Type", "sqft", "Owner", "Phone", "Parking", "Status"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={`border-b border-slate-800/40 ${r._valid ? "" : "bg-rose-500/5"}`}>
                          <td className="px-3 py-2">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-300">{r.tower_name}</td>
                          <td className="px-3 py-2 text-slate-300 font-mono">{r.unit_number}</td>
                          <td className="px-3 py-2 text-slate-400">{r.floor}</td>
                          <td className="px-3 py-2 text-slate-400">{r.unit_type}</td>
                          <td className="px-3 py-2 text-slate-500">{r.area_sqft || "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{r.owner_name || "—"}</td>
                          <td className="px-3 py-2 text-slate-400 font-mono">{r.owner_phone || "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{r.parking_slots || "—"}</td>
                          <td className="px-3 py-2">
                            {r._valid
                              ? <span className="text-emerald-400 font-semibold">✓</span>
                              : (
                                <span title={r._errors?.join("; ")} className="text-rose-400 cursor-help font-semibold">
                                  ✗ {r._errors?.[0]}
                                </span>
                              )
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="font-semibold text-emerald-300">Import complete</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.inserted}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Inserted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">{result.skipped}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rose-400">{result.errors?.length ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Errors</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.errors.map((err: string, i: number) => (
                    <p key={i} className="text-xs text-rose-400">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-violet-900/20">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm transition-colors">
            {result ? "Close" : "Cancel"}
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={() => importMutation.mutate()}
              disabled={validCount === 0 || importMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              {importMutation.isPending ? "Importing…" : `Import ${validCount} unit${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
