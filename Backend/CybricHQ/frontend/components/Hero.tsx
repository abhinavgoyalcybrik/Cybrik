import React from 'react'
import Link from 'next/link'

export default function Hero(){
  return (
    <section className="max-w-6xl mx-auto px-6 pt-16 lg:pt-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--cy-navy)] leading-tight">Simplify admissions & grow conversions with Cybrik</h1>
          <p className="mt-4 text-gray-600 text-lg">End-to-end lead management, counselor workflows, and admissions tracking — built for education consultants and agencies.</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/crm/login" className="btn-primary">Get started (CRM)</Link>
            <a href="#features" className="mt-0 inline-block px-4 py-2 rounded-md border border-gray-200 text-sm hover:bg-gray-50">Product tour</a>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 card-shadow">
              <div className="text-2xl font-bold text-[var(--cy-navy)]">1.2k</div>
              <div className="text-sm text-gray-500 mt-1">Leads processed / mo</div>
            </div>
            <div className="p-4 card-shadow">
              <div className="text-2xl font-bold text-[var(--cy-navy)]">95%</div>
              <div className="text-sm text-gray-500 mt-1">Response rate</div>
            </div>
            <div className="p-4 card-shadow">
              <div className="text-2xl font-bold text-[var(--cy-navy)]">40%</div>
              <div className="text-sm text-gray-500 mt-1">Avg conversion</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="hero-figure bg-white p-6 rounded-xl card-shadow flex items-center justify-center">
            <img src={'/mnt/data/Untitled design (1).png'} alt="Cybrik mock" className="w-full h-auto" />
          </div>
        </div>
      </div>
    </section>
  )
}