"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FadeInCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function FadeInCard({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: FadeInCardProps) {
  const directionVariants = {
    up: { y: 20, x: 0 },
    down: { y: -20, x: 0 },
    left: { y: 0, x: 20 },
    right: { y: 0, x: -20 },
    none: { y: 0, x: 0 },
  };

  const initial = {
    opacity: 0,
    ...directionVariants[direction],
  };

  const animate = {
    opacity: 1,
    y: 0,
    x: 0,
  };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.2, 0.65, 0.3, 0.9],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered container for lists
interface StaggeredListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggeredList({
  children,
  className = "",
  staggerDelay = 0.05,
}: StaggeredListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered item for lists
interface StaggeredItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggeredItem({ children, className = "" }: StaggeredItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Hover scale wrapper
interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverScale({
  children,
  className = "",
  scale = 1.02,
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Terminal-style animated border
interface TerminalBorderProps {
  children: ReactNode;
  className?: string;
}

export function TerminalBorder({ children, className = "" }: TerminalBorderProps) {
  return (
    <motion.div
      initial={{ borderColor: "var(--terminal-green)", opacity: 0.5 }}
      animate={{
        borderColor: [
          "rgb(var(--terminal-green))",
          "rgb(var(--terminal-green) / 0.3)",
          "rgb(var(--terminal-green))",
        ],
        opacity: [1, 0.7, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`border rounded-lg ${className}`}
    >
      {children}
    </motion.div>
  );
}