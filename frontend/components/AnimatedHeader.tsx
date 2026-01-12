'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AnimatedHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
        }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <motion.div
            className="text-3xl"
            animate={{ rotate: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ✈️
          </motion.div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {[
            { href: '/', label: 'Home' },
            { href: '#features', label: 'Features' },
            { href: '#about', label: 'About' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`text-sm font-medium transition-colors ${scrolled
                  ? 'text-gray-600 hover:text-[var(--cy-navy)]'
                  : 'text-white/80 hover:text-white'
                }`}
            >
              {item.label}
            </Link>
          ))}

          <Link href="/crm/login">
            <motion.button
              className="px-5 py-2 bg-gradient-to-r from-[#6FB63A] to-[#A6DA7A] text-white text-sm font-semibold rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              CRM Login
            </motion.button>
          </Link>
        </nav>

        <button className="md:hidden">
          <svg
            className={`w-6 h-6 ${scrolled ? 'text-[var(--cy-navy)]' : 'text-white'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </motion.header>
  );
}
