"use client";

import { CheckCircle2, Copy, Loader2, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { FieldError, FieldLabel, fieldClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { renderEmailLayout, type EmailOrganization } from "@/lib/notifications/email-layout";
import {
  MAX_BODY,
  renderSubject,
  renderTemplate,
  SAMPLE_VARS,
  TEMPLATE_VARIABLE_LABELS,
  TEMPLATE_VARIABLES,
  validateTemplateFields,
} from "@/lib/notifications/template";
import { cn } from "@/lib/utils";
import {
  activateTemplateAction,
  duplicateTemplateAction,
  saveTemplateAction,
  sendTestNotificationAction,
} from "@/server/actions/admin-notification-actions";

// Editor template (F-20). Pratinjau memakai renderer yang SAMA dengan pengiriman (renderTemplate →
// renderEmailLayout: nilai & teks di-escape) di dalam iframe `sandbox` tanpa allow-scripts.
// Validasi whitelist di sini hanya untuk UX — server memvalidasi ulang saat simpan & kirim.

export interface TemplateDto {
  id: string;
  event: string;
  channel: "email" | "whatsapp";
  name: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  version: number;
  updatedLabel: string;
}

type Msg = { ok: boolean; text: string } | null;

export function TemplateEditor({ template, org, adminEmail }: { template: TemplateDto; org: EmailOrganization; adminEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [testMsg, setTestMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isEmail = template.channel === "email";
  const dirty = name !== template.name || body !== template.body || (isEmail && subject !== (template.subject ?? ""));

  const validation = useMemo(
    () => validateTemplateFields({ channel: template.channel, subject: isEmail ? subject : null, body }),
    [template.channel, isEmail, subject, body],
  );
  const vars = useMemo(() => ({ ...SAMPLE_VARS, payment_url: `${org.siteUrl}/transaksi/${SAMPLE_VARS.transaction_id}/menunggu` }), [org.siteUrl]);
  const preview = useMemo(() => {
    if (!isEmail) return { text: renderTemplate(body, vars) };
    const s = renderSubject(subject, vars);
    return { html: renderEmailLayout({ subject: s, body: renderTemplate(body, vars), org }).html, subject: s };
  }, [isEmail, body, subject, vars, org]);

  const insert = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = body.slice(0, a) + token + body.slice(b);
    if (next.length > MAX_BODY) return;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveTemplateAction(template.id, { name, subject: isEmail ? subject : null, body, version: template.version });
      if (r.ok) {
        setErrors({});
        setMsg({ ok: true, text: `Tersimpan sebagai versi ${r.version}.` });
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMsg({ ok: false, text: r.error });
      }
    });
  const activate = () =>
    start(async () => {
      const r = await activateTemplateAction(template.id);
      setMsg(r.ok ? { ok: true, text: "Template diaktifkan; template lain untuk event & kanal ini dinonaktifkan." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const duplicate = () =>
    start(async () => {
      const r = await duplicateTemplateAction(template.id);
      if (r.ok) router.push(`/admin/template-notifikasi?kanal=${template.channel}&id=${r.id}`);
      else setMsg({ ok: false, text: r.error });
    });
  const sendTest = () =>
    start(async () => {
      setTestMsg(null);
      const r = await sendTestNotificationAction(template.id);
      setTestMsg(r.ok ? { ok: r.status !== "failed", text: r.message } : { ok: false, text: r.error });
    });

  const bodyError = errors.body ?? validation.body.join("; ");
  const subjectError = errors.subject ?? validation.subject.join("; ");

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Editor template">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold break-words">{template.name}</h2>
            <p className="font-mono text-xs break-all text-ink-faint">
              {template.event} · {isEmail ? "Email" : "WhatsApp"} · v{template.version} · {template.updatedLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.isActive ? (
              <span className="inline-flex h-8 items-center gap-1 rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary-ink" data-testid="template-active">
                <CheckCircle2 className="size-4" aria-hidden />
                Aktif
              </span>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={pending || dirty} onClick={activate} title={dirty ? "Simpan perubahan dulu" : undefined}>
                Aktifkan
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={duplicate}>
              <Copy aria-hidden />
              Duplikat
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <FieldLabel htmlFor="tpl-name">Nama template</FieldLabel>
            <input id="tpl-name" className={fieldClass} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            <FieldError>{errors.name}</FieldError>
          </div>
          {isEmail ? (
            <div>
              <FieldLabel htmlFor="tpl-subject">Subjek</FieldLabel>
              <input
                id="tpl-subject"
                className={fieldClass}
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value.replace(/[\r\n]+/g, " "))}
                aria-invalid={!!subjectError}
                aria-describedby="tpl-subject-err"
              />
              <FieldError id="tpl-subject-err">{subjectError}</FieldError>
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="tpl-body">Isi pesan</FieldLabel>
            <textarea
              id="tpl-body"
              ref={bodyRef}
              rows={14}
              value={body}
              maxLength={MAX_BODY}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={!!bodyError}
              aria-describedby="tpl-body-help tpl-body-err"
              className={cn(fieldClass, "h-auto py-2 font-mono text-xs leading-relaxed")}
            />
            <p id="tpl-body-help" className="mt-1 text-xs text-ink-faint">
              Teks biasa (HTML tidak dirender). Baris kosong = paragraf baru; tautan ke situs sendiri otomatis aktif. {body.length}/{MAX_BODY}
            </p>
            <FieldError id="tpl-body-err">{bodyError}</FieldError>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-faint">Variabel tersedia — klik untuk menyisipkan di posisi kursor</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insert(v)}
                  title={TEMPLATE_VARIABLE_LABELS[v]}
                  className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-ink-soft hover:bg-primary-soft hover:text-primary-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="button" disabled={pending || !dirty || !validation.ok} onClick={save}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Simpan versi baru
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !dirty}
            onClick={() => {
              setName(template.name);
              setSubject(template.subject ?? "");
              setBody(template.body);
              setErrors({});
            }}
          >
            Batal
          </Button>
          <p className={cn("text-sm", msg?.ok === false ? "text-danger" : "text-primary-ink")} role="status" aria-live="polite">
            {msg?.text}
          </p>
        </div>
      </section>

      <div className="grid min-w-0 content-start gap-5 lg:grid-cols-2 2xl:grid-cols-1">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Pratinjau">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">Pratinjau</p>
            <p className="text-xs text-ink-faint">Dengan data contoh{isEmail ? " · layout email asli" : ""}</p>
          </div>
          {"html" in preview ? (
            <iframe
              title="Pratinjau email"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview.html}
              className="block h-[560px] w-full bg-[#F3F1EB]"
              data-testid="email-preview"
            />
          ) : (
            <div className="bg-[#E7DED3] p-4" data-testid="wa-preview">
              <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-[#DCF7C5] p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-[#111B21] shadow-sm">
                {preview.text}
              </div>
            </div>
          )}
        </section>
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-5" aria-label="Kirim tes">
          <p className="text-sm font-semibold">Kirim tes</p>
          <p className="text-xs text-ink-faint">Hanya ke {isEmail ? "email" : "nomor WhatsApp"} admin yang sedang login, memakai versi tersimpan & data contoh.</p>
          <input className={cn(fieldClass, "mt-3")} readOnly value={isEmail ? adminEmail : "Nomor WhatsApp admin belum terdaftar"} aria-label="Tujuan kirim tes" />
          <Button type="button" variant="secondary" className="mt-3 w-full" disabled={pending || !isEmail} onClick={sendTest}>
            <Send aria-hidden />
            Kirim tes
          </Button>
          {!isEmail ? <p className="mt-2 text-xs text-ink-faint">Kirim tes WhatsApp belum tersedia karena akun admin tidak menyimpan nomor WhatsApp. Gunakan pratinjau.</p> : null}
          <p className={cn("mt-2 text-xs", testMsg?.ok === false ? "text-danger" : "text-ink-soft")} role="status" aria-live="polite">
            {testMsg?.text}
          </p>
        </section>
      </div>
    </div>
  );
}
