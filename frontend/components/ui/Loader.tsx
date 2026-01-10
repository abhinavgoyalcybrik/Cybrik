import React from 'react';
import { motion } from "framer-motion";

interface LoaderProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

export default function Loader({ size = "md", className = "" }: LoaderProps) {
    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-12 h-12",
        lg: "w-24 h-24",
        xl: "w-32 h-32"
    };

    return (
        <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
            {/* Outer Ring */}
            <motion.span
                className="absolute inset-0 border-4 border-[var(--cy-lime)] rounded-full border-t-transparent shadow-[0_0_15px_rgba(132,204,22,0.3)]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Inner Ring */}
            <motion.span
                className="absolute inset-2 border-4 border-[var(--cy-navy)] rounded-full border-b-transparent opacity-80"
                animate={{ rotate: -180 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />

            {/* Core Pulse */}
            <motion.div
                className="w-2 h-2 bg-[var(--cy-lime)] rounded-full shadow-[0_0_10px_var(--cy-lime)]"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                    boxShadow: [
                        "0 0 10px var(--cy-lime)",
                        "0 0 20px var(--cy-lime)",
                        "0 0 10px var(--cy-lime)"
                    ]
                }}
                transition={{ duration: 1, repeat: Infinity }}
            />
        </div>
    );
}
