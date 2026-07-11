import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UIcon, List, ListOrdered, Quote, Code2, Link as LinkIcon,
  Image as ImageIcon, Youtube as YoutubeIcon, Table as TableIcon, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2, Maximize2, Minimize2,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { value: string; onChange: (html: string) => void; placeholder?: string };

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      Youtube.configure({ controls: true, nocookie: true, width: 640, height: 360 }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something..." }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[320px] focus:outline-none px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className={cn("border rounded-md bg-background", fullscreen && "fixed inset-4 z-50 flex flex-col shadow-2xl")}>
      <Toolbar editor={editor} fullscreen={fullscreen} setFullscreen={setFullscreen} />
      <div className={cn("overflow-y-auto", fullscreen ? "flex-1" : "max-h-[60vh]")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function TB({ onClick, active, disabled, title, children }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "secondary" : "ghost"} className="h-7 w-7 p-0" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </Button>
  );
}

function Toolbar({ editor, fullscreen, setFullscreen }: { editor: Editor; fullscreen: boolean; setFullscreen: (v: boolean) => void }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => { const url = window.prompt("Image URL"); if (url) editor.chain().focus().setImage({ src: url }).run(); };
  const addYoutube = () => { const url = window.prompt("YouTube URL"); if (url) editor.commands.setYoutubeVideo({ src: url }); };
  const addTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const addButton = () => {
    const label = window.prompt("Button label"); if (!label) return;
    const url = window.prompt("Button URL", "https://"); if (!url) return;
    editor.chain().focus().insertContent(`<p><a href="${url}" class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground no-underline">${label}</a></p>`).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1 bg-muted/30 sticky top-0 z-10">
      <TB title="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></TB>
      <TB title="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></TB>
      <TB title="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></TB>
      <TB title="H4" active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}><Heading4 className="h-3.5 w-3.5" /></TB>
      <TB title="H5" active={editor.isActive("heading", { level: 5 })} onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}><Heading5 className="h-3.5 w-3.5" /></TB>
      <TB title="H6" active={editor.isActive("heading", { level: 6 })} onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}><Heading6 className="h-3.5 w-3.5" /></TB>
      <div className="w-px h-5 bg-border mx-1" />
      <TB title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></TB>
      <TB title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></TB>
      <TB title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UIcon className="h-3.5 w-3.5" /></TB>
      <div className="w-px h-5 bg-border mx-1" />
      <TB title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></TB>
      <TB title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></TB>
      <TB title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></TB>
      <TB title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="h-3.5 w-3.5" /></TB>
      <div className="w-px h-5 bg-border mx-1" />
      <TB title="Left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5" /></TB>
      <TB title="Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-3.5 w-3.5" /></TB>
      <TB title="Right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-3.5 w-3.5" /></TB>
      <TB title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-3.5 w-3.5" /></TB>
      <div className="w-px h-5 bg-border mx-1" />
      <TB title="Link" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="h-3.5 w-3.5" /></TB>
      <TB title="Image" onClick={addImage}><ImageIcon className="h-3.5 w-3.5" /></TB>
      <TB title="YouTube" onClick={addYoutube}><YoutubeIcon className="h-3.5 w-3.5" /></TB>
      <TB title="Table" onClick={addTable}><TableIcon className="h-3.5 w-3.5" /></TB>
      <TB title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5" /></TB>
      <TB title="Button" onClick={addButton}><span className="text-[10px] font-semibold">BTN</span></TB>
      <div className="w-px h-5 bg-border mx-1" />
      <TB title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></TB>
      <TB title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></TB>
      <div className="ml-auto" />
      <TB title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFullscreen(!fullscreen)}>
        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </TB>
    </div>
  );
}
