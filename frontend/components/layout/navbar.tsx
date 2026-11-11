"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/analyze", label: "Analyze" },
  { href: "/documents", label: "Documents" },
  { href: "/library", label: "Library" },
  { href: "/security-lab", label: "Security Lab" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/reader/") || pathname.startsWith("/newspaper/")) return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-line/70 bg-paper/85 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/70"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container-editorial flex h-[76px] items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map((link) => {
            const active =
              pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
                  active ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 -bottom-0.5 h-px bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle className="hidden sm:grid" />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/analyze">
              Analyze a page
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="grid size-10 place-items-center rounded-full border border-line bg-paper-soft text-ink lg:hidden"
          >
            <Menu className="size-[18px]" />
          </button>
        </div>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 34 }}
                  className="fixed inset-y-0 right-0 z-[80] flex w-[min(88vw,390px)] flex-col bg-paper p-6 shadow-2xl focus:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                    <Logo compact />
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Close navigation menu"
                        className="grid size-10 place-items-center rounded-full border border-line text-ink"
                      >
                        <X className="size-4" />
                      </button>
                    </Dialog.Close>
                  </div>

                  <nav className="mt-10 flex flex-col" aria-label="Mobile navigation">
                    {links.map((link, index) => (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + index * 0.04 }}
                      >
                        <Link
                          href={link.href}
                          className={cn(
                            "flex items-center justify-between border-b border-line/70 py-4 font-serif text-2xl transition-colors",
                            pathname.startsWith(link.href)
                              ? "text-accent"
                              : "text-ink hover:text-accent",
                          )}
                        >
                          {link.label}
                          <ArrowUpRight className="size-4 opacity-40" />
                        </Link>
                      </motion.div>
                    ))}
                  </nav>

                  <div className="mt-auto space-y-4 pt-8">
                    <Button asChild size="lg" className="w-full">
                      <Link href="/analyze">Analyze a page</Link>
                    </Button>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                        Reading, not scraping.
                      </p>
                      <ThemeToggle />
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </header>
  );
}
