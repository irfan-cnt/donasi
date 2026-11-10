"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Editor rich text (TipTap, React 19). Hanya node yang ada di whitelist sanitize-html server
// (p, h2–h4, strong/em/u, ul/ol/li, blockquote, a). Server tetap menyanitasi saat simpan.
export function RichTextEditor({
  id,
  value,
  onChange,
  invalid,
  labelledBy,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  labelledBy?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https" },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        class: "prose-tk min-h-[160px] p-4 text-sm outline-none",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL tautan (https://…). Kosongkan untuk menghapus.", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const tools = [
    { label: "Tebal", icon: Bold, active: state?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { label: "Miring", icon: Italic, active: state?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { label: "Subjudul", icon: Heading2, active: state?.h2, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Subjudul kecil", icon: Heading3, active: state?.h3, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Daftar poin", icon: List, active: state?.bullet, run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Daftar bernomor", icon: ListOrdered, active: state?.ordered, run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Kutipan", icon: Quote, active: state?.quote, run: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: "Tautan", icon: Link2, active: state?.link, run: setLink },
    { label: "Urungkan", icon: Undo2, active: false, run: () => editor?.chain().focus().undo().run() },
    { label: "Ulangi", icon: Redo2, active: false, run: () => editor?.chain().focus().redo().run() },
  ];

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-surface", invalid ? "border-danger" : "border-border")}>
      <div className="flex flex-wrap gap-0.5 border-b border-border bg-muted/60 p-1.5" role="toolbar" aria-label="Format teks">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.run}
            aria-label={t.label}
            title={t.label}
            aria-pressed={t.active ? true : undefined}
            className={cn("rounded-md p-1.5 text-ink-soft hover:bg-surface", t.active && "bg-surface text-primary")}
          >
            <t.icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} data-testid={`rte-${id}`} />
    </div>
  );
}
