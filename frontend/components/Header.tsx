import Image from 'next/image'
import Link from 'next/link'
import React from 'react'


export default function Header(){
return (
<header className="w-full bg-white/60 backdrop-blur-sm">
<div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
<Link href="/" className="flex items-center gap-3">
{/* Use the uploaded logo path during development. Replace with /public/images/logo.png in production */}
<img src={'/mnt/data/Untitled design (1).png'} alt="Cybrik Solutions" style={{height:44}}/>
<span className="font-semibold text-lg text-[var(--cy-navy)]">Cybrik Solutions</span>
</Link>


<nav className="flex items-center gap-4">
<Link href="/" className="text-sm text-gray-600 hover:text-[var(--cy-navy)]">Home</Link>
<Link href="/crm/login" className="text-sm text-gray-600 hover:text-[var(--cy-navy)]">CRM Login</Link>
<a href="#features" className="text-sm text-gray-600 hover:text-[var(--cy-navy)]">Features</a>
<Link href="/contact" className="ml-2 text-sm btn-primary">Contact Sales</Link>
</nav>
</div>
</header>
)
}