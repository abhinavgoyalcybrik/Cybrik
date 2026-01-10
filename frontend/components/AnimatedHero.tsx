'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

const destinations = [
  { name: 'United States', code: 'USA', count: '500+' },
  { name: 'United Kingdom', code: 'UK', count: '300+' },
  { name: 'Canada', code: 'CAN', count: '200+' },
  { name: 'Australia', code: 'AUS', count: '150+' },
];

const services = [
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'University Selection',
    description: 'Expert guidance to find the perfect institution matching your goals and profile'
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Application Support',
    description: 'Complete assistance with documentation, essays, and submission process'
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Visa Processing',
    description: 'Streamlined visa application support with high success rate'
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Career Guidance',
    description: 'Strategic planning for your academic and professional future'
  },
];

const process = [
  { step: '01', title: 'Consultation', desc: 'Free initial assessment' },
  { step: '02', title: 'Planning', desc: 'Personalized roadmap' },
  { step: '03', title: 'Application', desc: 'Document preparation' },
  { step: '04', title: 'Success', desc: 'Visa & departure' },
];

export default function AnimatedHero() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F8FAFC] to-[#E8F5DC]/20" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="heroCircuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <circle cx="40" cy="40" r="2" fill="#6FB63A"/>
                <path d="M40 0 L40 38 M80 40 L42 40" stroke="#6FB63A" strokeWidth="0.5" fill="none"/>
                <circle cx="10" cy="10" r="1.5" fill="#0B1F3A"/>
                <path d="M10 10 L10 25" stroke="#0B1F3A" strokeWidth="0.3" fill="none"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#heroCircuit)"/>
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 sm:py-20 lg:py-24">
          <motion.div
            className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <div className="text-center lg:text-left">
              <motion.div variants={fadeInUp} className="mb-4 sm:mb-6">
                <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A] animate-pulse" />
                  Start Your Journey
                </span>
              </motion.div>

              <motion.h1 
                variants={fadeInUp}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0B1F3A] mb-4 sm:mb-6"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
              >
                Your Gateway to
                <br />
                <span className="text-[#6FB63A]">World-Class</span>
                <br />
                Education
              </motion.h1>

              <motion.p 
                variants={fadeInUp}
                className="text-base sm:text-lg text-[#5B6A7F] mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0"
              >
                Expert guidance for ambitious students seeking admission to prestigious 
                universities across the globe. Transform your future with Cybrik Solutions.
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4">
                <Link href="/crm/login">
                  <motion.button
                    className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg shadow-[#6FB63A]/25 overflow-hidden relative"
                    whileHover={{ scale: 1.02, boxShadow: '0 12px 30px rgba(111,182,58,0.35)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-[#5FA030]"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      CRM Access
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </motion.button>
                </Link>

                <motion.button
                  className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-disabled="true"
                  aria-label="Student Portal - Coming Soon"
                >
                  <span className="flex items-center justify-center gap-2">
                    Student Portal
                    <span className="text-[10px] px-2 py-0.5 bg-[#F8FAFC] text-[#8494A7] rounded-full">Soon</span>
                  </span>
                </motion.button>
              </motion.div>
            </div>

            <motion.div 
              variants={fadeInUp}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#6FB63A]/5 to-[#0B1F3A]/5 blur-3xl rounded-3xl" />
                <div className="relative grid grid-cols-2 gap-4">
                  {destinations.map((dest, i) => (
                    <motion.div
                      key={dest.code}
                      className="group p-5 bg-white border border-[#E6ECF4] rounded-xl hover:border-[#6FB63A]/50 hover:shadow-lg transition-all duration-300"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      whileHover={{ y: -4 }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center bg-[#E8F5DC] text-[#6FB63A] rounded-lg mb-3 group-hover:bg-[#6FB63A] group-hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-sm font-semibold text-[#0B1F3A] mb-1">
                        {dest.name}
                      </div>
                      <div className="text-xs text-[#8494A7]">
                        {dest.count} Universities
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        <div className="w-full h-1 bg-[#E8F5DC] rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-[#6FB63A] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${70 + i * 8}%` }}
                            transition={{ delay: 0.8 + i * 0.1, duration: 0.8 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div 
            className="lg:hidden grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {destinations.map((dest) => (
              <div key={dest.code} className="p-3 bg-white border border-[#E6ECF4] rounded-lg text-center">
                <div className="w-8 h-8 flex items-center justify-center bg-[#E8F5DC] text-[#6FB63A] rounded-lg mb-2 mx-auto">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-[#0B1F3A]">{dest.code}</div>
                <div className="text-[10px] text-[#8494A7]">{dest.count}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div 
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg className="w-6 h-6 text-[#B0BDCC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-[#0B1F3A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {[
              { value: '15,000+', label: 'Students Placed' },
              { value: '500+', label: 'Partner Universities' },
              { value: '98%', label: 'Success Rate' },
              { value: '10+', label: 'Years Experience' },
            ].map((stat, i) => (
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

      <section className="py-12 sm:py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              What We Offer
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A]" style={{ letterSpacing: '-0.02em' }}>
              Comprehensive Services
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                className="group p-5 sm:p-6 lg:p-8 bg-white border border-[#E6ECF4] rounded-xl hover:border-[#6FB63A]/50 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
              >
                <div className="w-12 h-12 flex items-center justify-center mb-4 sm:mb-6 bg-[#E8F5DC] text-[#6FB63A] rounded-lg group-hover:bg-[#6FB63A] group-hover:text-white transition-colors">
                  {service.icon}
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-[#0B1F3A] mb-2 sm:mb-3">
                  {service.title}
                </h3>
                <p className="text-sm text-[#5B6A7F] leading-relaxed">
                  {service.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 sm:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A]" style={{ letterSpacing: '-0.02em' }}>
              Your Path to Success
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {process.map((item, i) => (
              <motion.div
                key={item.step}
                className="relative text-center p-4 sm:p-6"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#E6ECF4] mb-2 sm:mb-4">{item.step}</div>
                <h3 className="text-base sm:text-lg font-semibold text-[#0B1F3A] mb-1 sm:mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-[#5B6A7F]">{item.desc}</p>
                {i < process.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-[2px] bg-gradient-to-r from-[#6FB63A] to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 bg-[#0B1F3A]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6" style={{ letterSpacing: '-0.02em' }}>
              Ready to Start Your
              <br />
              <span className="text-[#6FB63A]">Global Journey?</span>
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-[#B0BDCC] mb-6 sm:mb-8 max-w-2xl mx-auto">
              Join thousands of successful students who have achieved their dreams with Cybrik Solutions. 
              Your future begins here.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Link href="/crm/login">
                <motion.button
                  className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    Get Started Today
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 sm:py-12 bg-[#0F1929] border-t border-[#16263F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-white">CYBRIK</span>
              <span className="text-xl sm:text-2xl font-bold text-[#6FB63A]">SOLUTIONS</span>
            </div>
            <div className="text-xs sm:text-sm text-[#5B6A7F] text-center">
              Transforming futures through global education
            </div>
            <div className="text-xs sm:text-sm text-[#5B6A7F]">
              &copy; {new Date().getFullYear()} Cybrik Solutions
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
