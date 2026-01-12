'use client';
import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ScrollProgress,
  AppleStyleShowcase,
  FloatingElements,
  FadeInSection
} from '@/components/landing/ScrollAnimations';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'AI Voice Agent',
    description: 'Powered by Cybrik, our voice AI handles customer calls 24/7 with human-like conversations'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Personalized Conversations',
    description: 'AI understands each customer\'s needs, goals, and preferences to provide tailored guidance'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: 'Automatic Documentation',
    description: 'Every conversation is transcribed, summarized, and logged automatically in your dashboard'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Instant Lead Qualification',
    description: 'AI qualifies leads in real-time based on preset criteria during the call'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Real-Time Dashboard',
    description: 'Monitor all AI interactions, customer statuses, and pipeline progress from a single view'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Zero Wait Time',
    description: 'Leads get immediate responses any time of day - no hold queues, no missed calls'
  },
];

const stats = [
  { value: '10K+', label: 'Calls Handled Monthly' },
  { value: '<3s', label: 'Average Response Time' },
  { value: '94%', label: 'Customer Satisfaction' },
  { value: '24/7', label: 'Always Available' },
];

const howItWorks = [
  {
    step: '01',
    title: 'Instant Communication',
    description: 'Initiate conversation with your leads anytime, enabling real-time interaction around the clock.'
  },
  {
    step: '02',
    title: 'AI Handles Everything',
    description: 'Our voice agent answers, understands their needs, and provides personalized guidance.'
  },
  {
    step: '03',
    title: 'Data Flows to CRM',
    description: 'Conversation details, lead info, and action items sync automatically to your dashboard.'
  },
  {
    step: '04',
    title: 'Your Team Takes Over',
    description: 'Counselors see qualified leads with full context, ready to close the deal.'
  },
];

const testimonials = [
  {
    quote: "The AI voice agent handles 80% of our initial inquiries. Our team now focuses only on qualified, ready-to-close leads.",
    author: "Sarah Chen",
    role: "Director, Global Education Partners",
  },
  {
    quote: "We used to miss calls after hours. Now customers get instant help 24/7, and we wake up to qualified leads in our dashboard.",
    author: "Michael Okonkwo",
    role: "CEO, StudyAbroad Connect",
  },
  {
    quote: "The AI understands context better than I expected. It remembers customer preferences and provides genuinely helpful advice.",
    author: "Priya Sharma",
    role: "Operations Head, EduPath International",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Scroll Progress Bar */}
      <ScrollProgress />
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E6ECF4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2">
              <Image
                src="/cybrik-logo.png"
                alt="Cybrik Solutions"
                width={180}
                height={50}
                className="h-8 sm:h-10 w-auto"
                priority
              />
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">How It Works</a>
              <a href="#features" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">Features</a>
              <a href="#testimonials" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">Testimonials</a>
              <a href="#pricing" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/crm/login">
                <button className="hidden sm:block px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:text-[#6FB63A] transition-colors">
                  Sign In
                </button>
              </Link>
              <Link href="/get-started">
                <button className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg hover:bg-[#5FA030] transition-colors shadow-md">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="relative pt-28 sm:pt-32 lg:pt-40 pb-16 sm:pb-20 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F8FAFC] to-[#E8F5DC]/30" />
        {/* Floating Background Elements */}
        <FloatingElements />
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="heroGrid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="#6FB63A" />
                <path d="M30 0 L30 28 M60 30 L32 30" stroke="#6FB63A" strokeWidth="0.5" fill="none" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#heroGrid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="mb-4 sm:mb-6">
              <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A] animate-pulse" />
                Powered by Cybrik AI
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0B1F3A] mb-4 sm:mb-6"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
            >
              Your AI Voice Agent
              <br />
              <span className="text-[#6FB63A]">Handles Every Call</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-[#5B6A7F] mb-6 sm:mb-8 max-w-2xl mx-auto"
            >
              Let AI handle inquiries, qualify leads, and answer questions 24/7.
              Your dashboard shows you everything - conversations, insights, and ready-to-close leads.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-8 sm:mb-12">
              <Link href="/get-started">
                <motion.button
                  className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg shadow-[#6FB63A]/25"
                  whileHover={{ scale: 1.02, boxShadow: '0 12px 30px rgba(111,182,58,0.35)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    Start Free Trial
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </motion.button>
              </Link>
              <motion.button
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Hear the AI in Action
                </span>
              </motion.button>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap justify-center gap-6 sm:gap-8 text-sm text-[#8494A7]"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#6FB63A]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No coding required
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#6FB63A]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Personalized setup
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#6FB63A]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Automated followups
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-[#0B1F3A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center p-4 sm:p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#6FB63A] mb-1 sm:mb-2">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-[#B0BDCC] uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Apple-Style Cinematic Dashboard Showcase */}
      <AppleStyleShowcase />

      <section id="how-it-works" className="py-16 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
              AI Does the Talking.
              <br />
              <span className="text-[#6FB63A]">You See the Results.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
              A seamless handoff between AI-powered conversations and your team's expertise.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-auto flex items-center justify-center -translate-x-1/2 opacity-30">
                    <svg className="w-12 h-6 text-[#6FB63A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                )}
                <div className="text-5xl sm:text-6xl font-bold text-[#E8F5DC] mb-4">{item.step}</div>
                <h3 className="text-lg sm:text-xl font-semibold text-[#0B1F3A] mb-2">{item.title}</h3>
                <p className="text-sm sm:text-base text-[#5B6A7F]">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-28 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
                The Voice AI Difference
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B1F3A] mb-4 sm:mb-6" style={{ letterSpacing: '-0.02em' }}>
                Not Just Another CRM.
                <br />
                <span className="text-[#6FB63A]">An AI That Works For You.</span>
              </h2>
              <p className="text-base sm:text-lg text-[#5B6A7F] mb-6 sm:mb-8">
                Traditional CRMs make you do all the work. Cybrik's AI voice agent
                handles the heavy lifting - answering calls, qualifying leads, and
                documenting everything - while your dashboard gives you complete visibility.
              </p>
              <ul className="space-y-4">
                {[
                  'AI answers calls instantly - no more missed opportunities',
                  'Every conversation transcribed and summarized automatically',
                  'Your Customer gets personalized advice based on their queries',
                  'Your counselors only talk to pre-qualified, ready leads',
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="w-5 h-5 mt-0.5 flex items-center justify-center bg-[#6FB63A] rounded-full flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-[#3D4B5C] font-medium">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-[#6FB63A]/10 to-[#0B1F3A]/10 blur-3xl rounded-3xl" />
              <div className="relative bg-white border border-[#E6ECF4] rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E6ECF4]">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-sm text-[#8494A7]">Live AI Conversation</span>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E8F5DC] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#6FB63A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-3 flex-1">
                      <p className="text-sm text-[#3D4B5C]">"Hi! I'd like to learn more about your premium services. What's included?"</p>
                      <span className="text-xs text-[#8494A7] mt-1">Lead - 2:34 PM</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#6FB63A] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="bg-[#0B1F3A] rounded-lg p-3 flex-1">
                      <p className="text-sm text-white">"Our premium package includes full extensive support and priority access. It's designed for clients who need fast results. Shall I schedule a quick call to discuss your specific needs?"</p>
                      <span className="text-xs text-[#8494A7] mt-1">Cybrik AI - 2:34 PM</span>
                    </div>
                  </div>
                  <div className="p-3 bg-[#E8F5DC] rounded-lg border border-[#6FB63A]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-[#6FB63A] animate-pulse" />
                      <span className="text-xs font-semibold text-[#6FB63A] uppercase">Auto-Logged to CRM</span>
                    </div>
                    <p className="text-xs text-[#3D4B5C]">Lead qualified: High interest in Premium, Requesting call, Ready for closing</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              Platform Features
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
              AI-Powered. Human-Controlled.
              <br />
              <span className="text-[#6FB63A]">Complete Visibility.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
              Every AI interaction flows into your dashboard. See conversations, track leads, and step in when needed.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl hover:border-[#6FB63A]/50 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
              >
                <div className="w-12 h-12 flex items-center justify-center mb-4 sm:mb-6 bg-[#E8F5DC] text-[#6FB63A] rounded-lg group-hover:bg-[#6FB63A] group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-[#0B1F3A] mb-2 sm:mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-[#5B6A7F] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-16 sm:py-20 lg:py-28 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              Testimonials
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A]" style={{ letterSpacing: '-0.02em' }}>
              Agencies Love the AI Advantage
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                className="p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-[#6FB63A]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[#3D4B5C] mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-[#0B1F3A]">{testimonial.author}</div>
                  <div className="text-sm text-[#8494A7]">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              Pricing
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
              Simple, Usage-Based Pricing
            </h2>
            <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
              Pay for what you use. Scale up as your agency grows.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <motion.div
              className="p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0, duration: 0.5 }}
            >
              <div className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-2">Starter</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-[#0B1F3A]">$99</span>
                <span className="text-[#8494A7]">/month</span>
              </div>
              <p className="text-sm text-[#5B6A7F] mb-6">Perfect for small agencies testing AI automation.</p>
              <ul className="space-y-3 mb-8">
                {['500 AI call minutes/month', 'Up to 3 team members', 'Basic CRM dashboard', 'Email support', 'Call transcriptions'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3D4B5C]">
                    <svg className="w-4 h-4 text-[#6FB63A] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/get-started">
                <button className="w-full py-3 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors">
                  Start Free Trial
                </button>
              </Link>
            </motion.div>

            <motion.div
              className="p-6 sm:p-8 bg-[#0B1F3A] border-2 border-[#6FB63A] rounded-xl relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold bg-[#6FB63A] text-white rounded-full">
                Most Popular
              </div>
              <div className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-2">Professional</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">$299</span>
                <span className="text-[#8494A7]">/month</span>
              </div>
              <p className="text-sm text-[#B0BDCC] mb-6">For agencies serious about scaling with AI.</p>
              <ul className="space-y-3 mb-8">
                {['2,000 AI call minutes/month', 'Up to 10 team members', 'Advanced analytics', 'Priority support', 'Custom AI training', 'Lead scoring'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white">
                    <svg className="w-4 h-4 text-[#6FB63A] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/get-started">
                <button className="w-full py-3 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg hover:bg-[#5FA030] transition-colors shadow-lg">
                  Start Free Trial
                </button>
              </Link>
            </motion.div>

            <motion.div
              className="p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-2">Enterprise</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-[#0B1F3A]">Custom</span>
              </div>
              <p className="text-sm text-[#5B6A7F] mb-6">For large agencies with high volume needs.</p>
              <ul className="space-y-3 mb-8">
                {['Unlimited AI minutes', 'Unlimited team members', 'White-label option', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3D4B5C]">
                    <svg className="w-4 h-4 text-[#6FB63A] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors">
                Contact Sales
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-28 bg-[#0B1F3A]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-[#6FB63A]/20 rounded-full">
              <svg className="w-8 h-8 text-[#6FB63A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6" style={{ letterSpacing: '-0.02em' }}>
              Let AI Handle Your Calls.
              <br />
              <span className="text-[#6FB63A]">Focus on What Matters.</span>
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-[#B0BDCC] mb-8 sm:mb-10 max-w-2xl mx-auto">
              Stop missing calls. Stop repetitive conversations. Let Cybrik's AI voice agent
              handle customer inquiries while you close deals.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/get-started">
                <motion.button
                  className="w-full sm:w-auto px-8 py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start Your Free Trial
                </motion.button>
              </Link>
              <motion.button
                className="w-full sm:w-auto px-8 py-4 text-sm font-semibold text-white border-2 border-[#16263F] rounded-lg hover:border-[#6FB63A] transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.location.href = '/get-started'}
              >
                Schedule a Demo
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 sm:py-12 bg-[#0F1929] border-t border-[#16263F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8 pb-8 border-b border-[#16263F]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl font-bold text-white">CYBRIK</span>
                <span className="text-xl font-bold text-[#6FB63A]">SOLUTIONS</span>
              </div>
              <p className="text-sm text-[#8494A7]">
                AI-powered voice agents and CRM for growing businesses. Handle customer calls 24/7.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">How It Works</a></li>
                <li><a href="#features" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="https://cybriksolutions.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Blog</a></li>
                <li><Link href="/careers" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Help Center</a></li>
                <li><Link href="/contact" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Contact</Link></li>
                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs sm:text-sm text-[#5B6A7F]">
              &copy; {new Date().getFullYear()} Cybrik Solutions. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="text-[#8494A7] hover:text-[#6FB63A] transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
              </a>
              <a href="#" className="text-[#8494A7] hover:text-[#6FB63A] transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
