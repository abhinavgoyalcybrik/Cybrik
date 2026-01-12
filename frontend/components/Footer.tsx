// frontend/components/Footer.tsx
import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full mt-12 border-t bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h4 className="font-semibold text-[var(--cy-navy)]">Cybrik Solutions</h4>
          <p className="text-sm text-gray-600 mt-2">
            Smart CRM & Admissions automation for education consultants.
          </p>
        </div>

        <div className="flex gap-8">
          <div>
            <h5 className="text-sm font-semibold text-gray-700">Product</h5>
            <ul className="mt-3 text-sm text-gray-600 space-y-2">
              <li>
                <Link href="/crm/login">CRM Login</Link>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-semibold text-gray-700">Company</h5>
            <ul className="mt-3 text-sm text-gray-600 space-y-2">
              <li>
                <a href="https://cybriksolutions.com" target="_blank" rel="noopener noreferrer">About</a>
              </li>
              <li>
                <Link href="/careers">Careers</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="w-full bg-gray-50 py-4">
        <div className="max-w-6xl mx-auto px-6 text-sm text-gray-500">
          © {new Date().getFullYear()} Cybrik Solutions — All rights reserved.
        </div>
      </div>
    </footer>
  );
}
