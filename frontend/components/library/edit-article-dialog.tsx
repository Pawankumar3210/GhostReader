"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { useLibrary } from "@/components/providers/library-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SavedArticle } from "@/lib/library-db";

export function EditArticleDialog({
  article,
  open,
  onOpenChange,
}: {
  article: SavedArticle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { update } = useLibrary();
  const [tags, setTags] = useState(article.tags.join(", "));
  const [note, setNote] = useState(article.note);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setTags(article.tags.join(", "));
      setNote(article.note);
    }
  }, [open, article]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const parsed = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    await update(article.id, { tags: parsed, note: note.trim().slice(0, 1000) });
    setPending(false);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-paper p-6 shadow-lift focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-2xl text-ink">Annotate edition</Dialog.Title>
              <Dialog.Description className="mt-1 line-clamp-1 text-xs text-ink-muted">
                {article.result.title ?? "Untitled edition"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-8 place-items-center rounded-full border border-line text-ink-muted transition hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="article-tags" className="text-xs font-medium text-ink">
                Tags
              </label>
              <Input
                id="article-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="research, design, to reread"
                className="mt-1.5 h-11 text-sm"
              />
              <p className="mt-1 text-[10px] text-ink-muted">Separate with commas. Up to eight.</p>
            </div>
            <div>
              <label htmlFor="article-note" className="text-xs font-medium text-ink">
                Private note
              </label>
              <textarea
                id="article-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Why did you keep this?"
                className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-paper-soft px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent/60 focus:ring-4 focus:ring-accent/10"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={pending}>
                Save annotation
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
