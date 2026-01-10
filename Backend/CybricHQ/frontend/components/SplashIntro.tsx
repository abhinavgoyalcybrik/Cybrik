'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface SplashIntroProps {
  onEnter: () => void;
}

export default function SplashIntro({ onEnter }: SplashIntroProps) {
  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-white"
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
      }}
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F8FAFC] to-[#E8F5DC]/30" />
        
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="3" fill="#6FB63A"/>
              <path d="M50 0 L50 47 M100 50 L53 50" stroke="#6FB63A" strokeWidth="1" fill="none"/>
              <circle cx="10" cy="10" r="2" fill="#0B1F3A"/>
              <path d="M10 10 L10 30 M10 10 L30 10" stroke="#0B1F3A" strokeWidth="0.5" fill="none"/>
              <circle cx="90" cy="90" r="2" fill="#0B1F3A"/>
              <path d="M90 90 L90 70 M90 90 L70 90" stroke="#0B1F3A" strokeWidth="0.5" fill="none"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit)"/>
        </svg>

        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(111,182,58,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(11,31,58,0.05) 0%, transparent 70%)' }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col items-center"
        >
          <motion.div 
            className="mb-6 flex items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.div
              className="flex items-center gap-1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-2 h-2 rounded-full bg-[#6FB63A]" />
              <div className="w-8 h-[2px] bg-[#6FB63A]" />
              <div className="w-1.5 h-1.5 rounded-full border border-[#6FB63A]" />
            </motion.div>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B6A7F]">
              Education Consultancy
            </span>
            <motion.div
              className="flex items-center gap-1"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-1.5 h-1.5 rounded-full border border-[#6FB63A]" />
              <div className="w-8 h-[2px] bg-[#6FB63A]" />
              <div className="w-2 h-2 rounded-full bg-[#6FB63A]" />
            </motion.div>
          </motion.div>

          <motion.h1 
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-4"
            style={{ letterSpacing: '-0.03em', lineHeight: 1 }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="text-[#0B1F3A]">CYBRIK</span>
          </motion.h1>

          <motion.div
            className="flex items-center gap-3 mb-8"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <div className="w-12 sm:w-16 h-[2px] bg-gradient-to-r from-transparent to-[#6FB63A]" />
            <span className="text-lg sm:text-xl md:text-2xl font-semibold tracking-[0.15em] text-[#6FB63A]">
              SOLUTIONS
            </span>
            <div className="w-12 sm:w-16 h-[2px] bg-gradient-to-l from-transparent to-[#6FB63A]" />
          </motion.div>

          <motion.p 
            className="text-base sm:text-lg text-[#5B6A7F] mb-3 font-normal max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            Your trusted partner for global education opportunities
          </motion.p>

          <motion.div 
            className="flex flex-wrap justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#8494A7] mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A]" />USA
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A]" />UK
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A]" />Canada
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A]" />Australia
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A]" />Germany
            </span>
          </motion.div>
        </motion.div>

        <motion.button
          onClick={onEnter}
          className="group relative px-8 sm:px-10 py-3 sm:py-4 text-sm font-semibold tracking-wide bg-[#6FB63A] text-white rounded-lg overflow-hidden shadow-lg shadow-[#6FB63A]/25"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          whileHover={{ scale: 1.03, boxShadow: '0 12px 30px rgba(111,182,58,0.35)' }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            className="absolute inset-0 bg-[#5FA030]"
            initial={{ x: "-100%" }}
            whileHover={{ x: 0 }}
            transition={{ duration: 0.3 }}
          />
          <span className="relative z-10 flex items-center gap-2">
            Enter Platform
            <svg 
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </motion.button>

        <motion.div
          className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          {[
            { value: '15K+', label: 'Students' },
            { value: '500+', label: 'Universities' },
            { value: '98%', label: 'Success' },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#0B1F3A]">{stat.value}</div>
              <div className="text-xs text-[#8494A7] uppercase tracking-wider mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <motion.div 
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-xs text-[#8494A7] uppercase tracking-wider">Scroll</span>
          <svg className="w-5 h-5 text-[#6FB63A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
