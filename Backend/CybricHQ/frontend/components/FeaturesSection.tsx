'use client';
import React from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '🎯',
    title: 'Centralized Lead Management',
    description: 'All your student leads in one place with smart filters for country, intake, and program preferences.',
  },
  {
    icon: '👥',
    title: 'Counsellor Workflows',
    description: 'Assign leads to counsellors, schedule follow-ups, and track progress with intuitive dashboards.',
  },
  {
    icon: '📋',
    title: 'Application Tracking',
    description: 'Monitor applications from submission to visa approval with real-time status updates.',
  },
  {
    icon: '📊',
    title: 'Analytics & Reports',
    description: 'Get insights into conversion rates, counsellor performance, and pipeline health.',
  },
  {
    icon: '🔔',
    title: 'Smart Notifications',
    description: 'Never miss a follow-up with automated reminders and deadline alerts.',
  },
  {
    icon: '🔒',
    title: 'Secure & Compliant',
    description: 'Enterprise-grade security with role-based access control and data encryption.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.span 
            className="inline-block px-4 py-2 bg-[var(--cy-green)]/10 text-[var(--cy-green)] rounded-full text-sm font-medium mb-4"
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
          >
            Features
          </motion.span>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--cy-navy)] mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Powerful tools designed specifically for education consultants and agencies 
            to streamline their admissions process.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group p-8 bg-white rounded-2xl border border-gray-100 hover:border-[var(--cy-green)]/30 transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ 
                y: -5,
                boxShadow: "0 20px 40px rgba(111,182,58,0.15)",
              }}
            >
              <motion.div 
                className="text-5xl mb-6"
                whileHover={{ scale: 1.2, rotate: 10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {feature.icon}
              </motion.div>
              <h3 className="text-xl font-semibold text-[var(--cy-navy)] mb-3 group-hover:text-[var(--cy-green)] transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div 
          className="mt-20 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-[var(--cy-navy)] to-[#13315C] rounded-2xl text-white">
            <div className="text-left">
              <div className="text-2xl font-bold">1000+</div>
              <div className="text-sm text-white/70">Students Placed</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-left">
              <div className="text-2xl font-bold">95%</div>
              <div className="text-sm text-white/70">Success Rate</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-left">
              <div className="text-2xl font-bold">50+</div>
              <div className="text-sm text-white/70">Partner Universities</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
