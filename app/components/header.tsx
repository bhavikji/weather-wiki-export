"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  NAV,
  KEY_TO_ITEM,
  getActiveKey,
  INPUT_HINT,
} from "@/app/components/nav.config";
import { NavItem } from "./nav.config";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavLinkProps = {
  href: string;
  active: boolean;
  title?: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
};

function NavLink({
  href,
  active,
  title,
  className,
  children,
  onClick,
}: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      aria-current={active ? "page" : undefined}
      className={cn(
        className,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 focus-visible:ring-offset-2"
      )}
    >
      {children}
    </Link>
  );
}

export default function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);
  const activeItem = KEY_TO_ITEM[activeKey];

  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white">
              <span className="text-sm font-semibold">WX</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-5">
                Weather → Sheets
              </div>
              <div className="truncate text-xs text-zinc-500">
                Fast pipelines, stable templates, clean exports
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {NAV.map((item: NavItem) => {
              const active = item.key === activeKey;
              return (
                <NavLink
                  key={item.key}
                  href={item.href}
                  active={active}
                  title={item.description}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        active
                          ? "bg-white/15 text-white"
                          : "bg-zinc-200 text-zinc-700"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 focus-visible:ring-offset-2 md:hidden"
            aria-label="Open menu"
          >
            Menu
          </button>
        </div>

        {/* Context bar */}
        <div className="border-t border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-900">
                {activeItem.label}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {activeItem.description}
              </div>
            </div>

            <div className="hidden shrink-0 text-xs text-zinc-500 sm:block">
              <span>{INPUT_HINT[activeKey]}</span>
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="px-2 pb-2 pt-1 text-xs font-semibold text-zinc-500">
              Navigation
            </div>
            <div className="flex flex-col gap-1" aria-label="Sidebar">
              {NAV.map((item: NavItem) => {
                const active = item.key === activeKey;
                return (
                  <NavLink
                    key={item.key}
                    href={item.href}
                    active={active}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.label}</div>
                      <div
                        className={cn(
                          "truncate text-xs",
                          active ? "text-white/75" : "text-zinc-500"
                        )}
                      >
                        {item.description}
                      </div>
                    </div>
                    {item.badge ? (
                      <span
                        className={cn(
                          "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-zinc-200 text-zinc-700"
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            {props.children}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 focus-visible:ring-offset-2"
              >
                Close
              </button>
            </div>

            <div className="p-2" aria-label="Mobile navigation">
              {NAV.map((item: NavItem) => {
                const active = item.key === activeKey;
                return (
                  <NavLink
                    key={item.key}
                    href={item.href}
                    active={active}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "mb-1 block rounded-xl px-3 py-2 transition",
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-800 hover:bg-zinc-100"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{item.label}</div>
                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            active
                              ? "bg-white/15 text-white"
                              : "bg-zinc-200 text-zinc-700"
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs",
                        active ? "text-white/75" : "text-zinc-500"
                      )}
                    >
                      {item.description}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
