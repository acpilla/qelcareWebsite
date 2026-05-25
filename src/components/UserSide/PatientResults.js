import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.entry";
import { API_URL, authFetch, getToken } from "../../utils/auth";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  formatDate,
  inputStyle,
} from "../Workflow/ClinicUi";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_PDF_PAGES = 5;
const ACCEPTED_FILES = ".png,.jpg,.jpeg,.webp,.pdf";

const emptyForm = {
  title: "",
  result_type: "",
  source_facility: "",
  result_date: "",
  extracted_text: "",
  summary_notes: "",
};

function fileType(file) {
  if (!file) return "";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "image";
}

function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function firstMeaningfulLine(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => compact(line))
    .find((line) => line.length >= 3 && line.length <= 90);
}

function toISODate(value) {
  const text = compact(value);
  if (!text) return "";

  const iso = text.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const slash = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})\b/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return "";
}

function inferResultType(text, fileName = "") {
  const haystack = `${text} ${fileName}`.toLowerCase();
  if (/complete blood count|\bcbc\b/.test(haystack)) return "Complete Blood Count";
  if (/urinalysis|urine/.test(haystack)) return "Urinalysis";
  if (/x[- ]?ray|radiograph/.test(haystack)) return "X-ray Result";
  if (/ultrasound|sonogram/.test(haystack)) return "Ultrasound Result";
  if (/ecg|electrocardiogram/.test(haystack)) return "ECG Result";
  if (/blood chemistry|creatinine|cholesterol|glucose|triglyceride/.test(haystack)) return "Blood Chemistry";
  if (/laboratory|lab result|reference range/.test(haystack)) return "Laboratory Result";
  return "Medical Result";
}

function inferFacility(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => compact(line)).filter(Boolean);
  return lines.find((line) => /(clinic|hospital|laboratory|diagnostic|medical center|healthcare|lab)/i.test(line) && line.length <= 120) || "";
}

function inferFields(text, file) {
  const fallbackTitle = file?.name ? file.name.replace(/\.[^.]+$/, "") : "Uploaded Medical Result";
  return {
    title: firstMeaningfulLine(text) || fallbackTitle,
    result_type: inferResultType(text, file?.name || ""),
    source_facility: inferFacility(text),
    result_date: toISODate(text),
    extracted_text: text,
  };
}

async function renderPdfPageToImage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.7 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function recognizeImage(source, onProgress) {
  const result = await Tesseract.recognize(source, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(Math.round((message.progress || 0) * 100));
      }
    },
  });
  return result?.data?.text || "";
}

function ResultCard({ item, selected, onSelect, onDelete }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1px solid ${selected ? "#163a6b" : "#e3ebf5"}`,
        background: selected ? "#f3f7ff" : "#fff",
        borderRadius: 8,
        padding: 14,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#162235", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
          <div style={{ color: "#6b778c", fontSize: 12, marginTop: 4 }}>{item.result_type || "Medical Result"} - {formatDate(item.result_date || item.created_at)}</div>
          {item.source_facility && <div style={{ color: "#42526a", fontSize: 12, marginTop: 4 }}>{item.source_facility}</div>}
        </div>
        <ActionButton
          tone="danger"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
        >
          Delete
        </ActionButton>
      </div>
    </button>
  );
}

export default function PatientResults() {
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((item) => [item.title, item.result_type, item.source_facility, item.extracted_text]
      .some((value) => String(value || "").toLowerCase().includes(q)));
  }, [results, search]);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/patient-results/me");
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Failed to load medical results.");
      const rows = payload.results || payload.data || [];
      setResults(rows);
      setSelected((current) => current ? rows.find((item) => item.result_id === current.result_id) || null : rows[0] || null);
    } catch (err) {
      setError(err.message || "Failed to load medical results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const startNew = () => {
    setSelected(null);
    setForm(emptyForm);
    setFile(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectResult = (item) => {
    setSelected(item);
    setForm({
      title: item.title || "",
      result_type: item.result_type || "",
      source_facility: item.source_facility || "",
      result_date: item.result_date ? String(item.result_date).slice(0, 10) : "",
      extracted_text: item.extracted_text || "",
      summary_notes: item.summary_notes || "",
    });
    setFile(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const runOcr = async () => {
    if (!file) {
      setError("Choose an image or PDF file first.");
      return;
    }

    setOcrBusy(true);
    setOcrProgress(0);
    setError(null);
    setMessage("OCR is reading the uploaded result. Please review the text after extraction.");

    try {
      let text = "";
      if (fileType(file) === "pdf") {
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
        const chunks = [];
        for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
          setMessage(`OCR processing PDF page ${pageNo} of ${pageCount}.`);
          const image = await renderPdfPageToImage(pdf, pageNo);
          const pageText = await recognizeImage(image, (percent) => {
            const overall = Math.round(((pageNo - 1) / pageCount) * 100 + (percent / pageCount));
            setOcrProgress(overall);
          });
          chunks.push(`Page ${pageNo}\n${pageText}`);
        }
        text = chunks.join("\n\n");
      } else {
        text = await recognizeImage(file, setOcrProgress);
      }

      const inferred = inferFields(text, file);
      setForm((current) => ({
        ...current,
        title: current.title || inferred.title,
        result_type: current.result_type || inferred.result_type,
        source_facility: current.source_facility || inferred.source_facility,
        result_date: current.result_date || inferred.result_date,
        extracted_text: inferred.extracted_text,
      }));
      setMessage("OCR complete. Review and edit the fields before saving.");
    } catch (err) {
      setError(err.message || "OCR failed. You can still type the result manually.");
    } finally {
      setOcrBusy(false);
      setOcrProgress(100);
    }
  };

  const saveResult = async () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      let response;
      if (selected) {
        response = await authFetch(`/patient-results/${selected.result_id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        const token = getToken();
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) => body.append(key, value || ""));
        if (file) body.append("resultFile", file);
        response = await fetch(`${API_URL}/patient-results`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body,
        });
      }

      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Failed to save medical result.");
      setMessage(selected ? "Medical result updated." : "Medical result saved.");
      await loadResults();
      const saved = payload.result || payload.data;
      if (saved) selectResult(saved);
    } catch (err) {
      setError(err.message || "Failed to save medical result.");
    } finally {
      setSaving(false);
    }
  };

  const deleteResult = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/patient-results/${item.result_id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Failed to delete medical result.");
      if (selected?.result_id === item.result_id) startNew();
      setMessage("Medical result deleted.");
      await loadResults();
    } catch (err) {
      setError(err.message || "Failed to delete medical result.");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#162235" }}>Medical Results Tracking</div>
            <div style={{ color: "#6b778c", fontSize: 13, marginTop: 3 }}>Upload lab or diagnostic results, run OCR, review the fields, and save them to your account.</div>
          </div>
          <ActionButton onClick={startNew}>New Result</ActionButton>
        </div>
      </Panel>

      {message && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#edf8f1", color: "#0f6b3c", fontSize: 13, fontWeight: 800 }}>{message}</div>}
      <ErrorState message={error} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 16, alignItems: "start" }}>
        <Panel style={{ padding: 14 }}>
          <Field label="Search results">
            <input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, type, facility, text" />
          </Field>
          <div style={{ height: 12 }} />
          {loading ? (
            <LoadingState label="Loading medical results..." />
          ) : filteredResults.length === 0 ? (
            <EmptyState title="No medical results" detail="Upload a result file or manually enter one." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredResults.map((item) => (
                <ResultCard
                  key={item.result_id}
                  item={item}
                  selected={selected?.result_id === item.result_id}
                  onSelect={selectResult}
                  onDelete={deleteResult}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#162235" }}>{selected ? "Edit Medical Result" : "Upload Medical Result"}</div>
              <div style={{ color: "#6b778c", fontSize: 12, marginTop: 3 }}>OCR extracts text only. Review everything before saving.</div>
            </div>
            {ocrBusy && <div style={{ color: "#163a6b", fontWeight: 900, fontSize: 13 }}>OCR {ocrProgress}%</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {!selected && (
              <Field label="Upload file">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </Field>
            )}
            {!selected && (
              <Field label="OCR option">
                <ActionButton disabled={!file || ocrBusy} onClick={runOcr}>{ocrBusy ? "Reading file..." : "Run OCR"}</ActionButton>
              </Field>
            )}
            <Field label="Title">
              <input name="title" value={form.title} onChange={setField} style={inputStyle} placeholder="CBC Result, Urinalysis, X-ray Result" />
            </Field>
            <Field label="Result type">
              <input name="result_type" value={form.result_type} onChange={setField} style={inputStyle} placeholder="Laboratory Result" />
            </Field>
            <Field label="Source facility">
              <input name="source_facility" value={form.source_facility} onChange={setField} style={inputStyle} placeholder="Clinic, hospital, or laboratory" />
            </Field>
            <Field label="Result date">
              <input name="result_date" type="date" value={form.result_date} onChange={setField} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <Field label="Extracted text">
              <textarea name="extracted_text" value={form.extracted_text} onChange={setField} rows={12} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="OCR text or manually typed result details" />
            </Field>
            <Field label="Summary notes">
              <textarea name="summary_notes" value={form.summary_notes} onChange={setField} rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="Your own notes or reminder. This is not a diagnosis." />
            </Field>
          </div>

          {selected?.file_url && (
            <div style={{ marginTop: 12, padding: 12, border: "1px solid #e3ebf5", borderRadius: 8, background: "#f8fbff" }}>
              <div style={{ color: "#6b778c", fontSize: 12, fontWeight: 900, marginBottom: 5 }}>Attached file</div>
              <a href={selected.file_url} target="_blank" rel="noreferrer" style={{ color: "#163a6b", fontWeight: 900 }}>Open uploaded result</a>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <ActionButton tone="secondary" onClick={startNew}>Clear</ActionButton>
            <ActionButton disabled={saving || ocrBusy} onClick={saveResult}>{saving ? "Saving..." : selected ? "Save Changes" : "Save Result"}</ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
