"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 disabled:bg-navy-900/50 shadow-sm",
  secondary:
    "bg-white text-ink border border-line-strong hover:bg-slate-50 active:bg-slate-100 disabled:text-muted-light",
  ghost: "bg-transparent text-ink-soft hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-danger-500 text-white hover:bg-danger-600 shadow-sm",
  subtle: "bg-slate-100 text-ink hover:bg-slate-200",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = BaseProps & { href: string; "aria-label"?: string };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", icon, iconRight, className, children } = props;
  const classes = cn(
    "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} aria-label={props["aria-label"]}>
        {icon}
        {children}
        {iconRight}
      </Link>
    );
  }

  const {
    type = "button",
    variant: _variant,
    size: _size,
    icon: _icon,
    iconRight: _iconRight,
    className: _className,
    children: _children,
    ...rest
  } = props as ButtonProps;
  void _variant;
  void _size;
  void _icon;
  void _iconRight;
  void _className;
  void _children;
  return (
    <button type={type} className={classes} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
