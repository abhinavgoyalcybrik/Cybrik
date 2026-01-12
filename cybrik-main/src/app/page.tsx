'use client';


import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

image ?: string | null;
}

// Product Data
const products: Product[] = [
  {
    id: 'ielts',
    name: 'IELTS Portal',
    description: 'Complete IELTS preparation platform with practice tests, AI-powered evaluation, and detailed analytics.',
    icon: '📚',
    features: ['Reading & Listening Tests', 'Writing Evaluation', 'Speaking Practice', 'Progress Analytics'],
    status: 'live',
    link: 'https://ielts.cybriksolutions.com',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    image: '/images/ielts-card.png',
  },
  {
    id: 'crm',
    name: 'CRM System',
    description: 'Powerful customer relationship management with AI calling, lead tracking, and automated workflows.',
    icon: '📊',
    features: ['Lead Management', 'AI Phone Calls', 'Analytics Dashboard', 'Team Collaboration'],
    status: 'live',
    link: 'https://crm.cybriksolutions.com',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-600',
    image: '/images/crm-card.png',
  },
  {
    id: 'pte',
    name: 'PTE Portal',
    description: 'Advanced PTE Academic preparation with computer-based practice tests and instant scoring.',
    icon: '🎯',
    features: ['Speaking & Writing', 'Reading & Listening', 'Instant Scoring', 'Performance Tracking'],
    status: 'coming-soon',
    link: 'https://pte.cybriksolutions.com',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    image: null,
  },
];

// Feature Data
const features = [
  { icon: '⚡', title: 'Lightning Fast', description: 'Built with Next.js for blazing fast performance and optimal user experience' },
  { icon: '🛡️', title: 'Enterprise Security', description: 'Bank-grade encryption and security protocols to protect your data' },
  { icon: '📱', title: 'Responsive Design', description: 'Seamless experience across all devices and screen sizes' },
  { icon: '🤖', title: 'AI Integration', description: 'Cutting-edge AI technology powering intelligent automation' },
];

// Apple-style Animated Gradient Text
const gradientWords = ['Innovation', 'Excellence', 'Success', 'Growth', 'Future'];

function AnimatedGradientText() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % gradientWords.length);
        setIsAnimating(false);
      }, 400);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-all duration-500 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
    >
      <span className="bg-gradient-to-r from-[#6FB63A] via-[#8ED654] to-[#5FA030] bg-clip-text text-transparent animate-gradient-x">
        {gradientWords[currentIndex]}
      </span>
    </span>
  );
}

// Scroll Animation Hook
function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin: '0px 0px -100px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// Animated Section Component
function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(60px)',
      }}
    >
      {children}
    </div>
  );
}

// Animated Counter Component
function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollAnimation();
  const numericValue = parseInt(value.replace(/\D/g, '')) || 0;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isVisible && !hasAnimated.current) {
      hasAnimated.current = true;
      const duration = 2000;
      const steps = 60;
      const increment = numericValue / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          setCount(numericValue);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [isVisible, numericValue]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Full Screen Product Showcase
function ProductShowcase({ product, index }: { product: typeof products[0]; index: number }) {
  const { ref, isVisible } = useScrollAnimation(0.3);
  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className={`min-h-screen flex items-center py-20 px-6 ${index > 0 ? 'border-t border-gray-100' : ''}`}
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className={`grid md:grid-cols-2 gap-16 items-center ${!isEven ? 'md:flex-row-reverse' : ''}`}>
          {/* Content Side */}
          <div
            className={`transition-all duration-1000 ease-out ${isEven ? '' : 'md:order-2'}`}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible
                ? 'translateX(0)'
                : `translateX(${isEven ? '-80px' : '80px'})`,
            }}
          >
            {/* Status Badge */}
            {product.status === 'coming-soon' ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-bold mb-6">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Coming Soon
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Now
              </div>
            )}

            <h2 className="text-4xl md:text-6xl font-black mb-6 text-gray-900">
              {product.name}
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              {product.description}
            </p>

            {/* Features */}
            <ul className="space-y-4 mb-10">
              {product.features.map((feature, fIdx) => (
                <li
                  key={fIdx}
                  className="flex items-center gap-4 text-lg text-gray-700 transition-all duration-500"
                  style={{
                    transitionDelay: `${300 + fIdx * 100}ms`,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateX(0)' : 'translateX(-30px)',
                  }}
                >
                  <span className="w-8 h-8 rounded-full bg-[#6FB63A]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#6FB63A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA */}
            {product.status === 'live' ? (
              <a
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 btn-primary px-10 py-5 rounded-full text-xl font-bold shadow-2xl"
              >
                Launch {product.name}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            ) : (
              <button disabled className="px-10 py-5 rounded-full text-xl font-bold bg-gray-100 text-gray-400 cursor-not-allowed">
                Coming Soon
              </button>
            )}
          </div>

          {/* Visual Side */}
          <div
            className={`transition-all duration-1000 ease-out ${isEven ? '' : 'md:order-1'}`}
            style={{
              transitionDelay: '200ms',
              opacity: isVisible ? 1 : 0,
              transform: isVisible
                ? 'translateX(0) scale(1)'
                : `translateX(${isEven ? '80px' : '-80px'}) scale(0.9)`,
            }}
          >
            {product.image ? (
              <div className={`relative aspect-square rounded-3xl overflow-hidden shadow-2xl hover:scale-105 transition-transform duration-500`}>
                <Image
                  src={product.image}
                  alt={`${product.name} Preview`}
                  fill
                  className="object-contain p-4"
                />
              </div>
            ) : (
              <div className={`aspect-square rounded-3xl bg-gradient-to-br ${product.gradient} p-1 shadow-2xl`}>
                <div className="w-full h-full rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-9xl mb-6 animate-float">{product.icon}</div>
                    <div className="text-white text-3xl font-bold">{product.name}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsVisible(true);

    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouse);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-800 overflow-x-hidden">
      {/* Fixed Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollY > 50 ? 'glass-nav shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <Link href="/">
              <Image
                src="/images/cybrik-logo.png"
                alt="Cybrik Logo"
                width={0}
                height={0}
                sizes="100vw"
                style={{ width: 'auto', height: '4rem' }}
                className="logo-glow transition-transform group-hover:scale-105"
              />
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#products" className="relative text-gray-600 hover:text-[#6FB63A] transition-colors font-medium group">
              Products
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#6FB63A] transition-all group-hover:w-full"></span>
            </a>
            <a href="#features" className="relative text-gray-600 hover:text-[#6FB63A] transition-colors font-medium group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#6FB63A] transition-all group-hover:w-full"></span>
            </a>
            <a href="#about" className="relative text-gray-600 hover:text-[#6FB63A] transition-colors font-medium group">
              About
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#6FB63A] transition-all group-hover:w-full"></span>
            </a>
            <Link href="/contact" className="relative text-gray-600 hover:text-[#6FB63A] transition-colors font-medium group">
              Contact
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#6FB63A] transition-all group-hover:w-full"></span>
            </Link>
            <Link href="/careers" className="relative text-gray-600 hover:text-[#6FB63A] transition-colors font-medium group">
              Careers
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#6FB63A] transition-all group-hover:w-full"></span>
            </Link>
          </div>
          <a href="#products" className="btn-primary px-6 py-2.5 rounded-full font-semibold shadow-lg">
            Find Our Products
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-white/80 hero-mesh grid-pattern"></div>

        {/* Dynamic Background Orbs */}
        <div
          className="floating-orb w-[600px] h-[600px] bg-[#6FB63A]/20 -top-40 -left-40"
          style={{
            transform: `translate(${mousePos.x * 0.02}px, ${mousePos.y * 0.02}px)`,
          }}
        />
        <div
          className="floating-orb w-[500px] h-[500px] bg-[#7FC448]/15 -bottom-20 -right-20 animate-morph"
          style={{
            transform: `translate(${-mousePos.x * 0.015}px, ${-mousePos.y * 0.015}px)`,
          }}
        />

        {/* Animated Lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="floating-line"
              style={{
                left: `${20 + i * 15}%`,
                animationDelay: `${i * 1.2}s`,
              }}
            />
          ))}
        </div>

        <div className={`relative z-10 max-w-7xl mx-auto px-6 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-[#6FB63A]/20 shadow-lg mb-8">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6FB63A] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#6FB63A]"></span>
            </span>
            <span className="text-sm font-semibold text-gray-700">Welcome to the Future of Business Solutions</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
            <span className="text-gray-900">Empower Your Business</span>
            <br />
            <span className="text-gray-900">Through </span>
            <AnimatedGradientText />
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Comprehensive suite of <span className="text-[#6FB63A] font-semibold">AI-powered</span> tools for education and business management.
            Transform the way you work.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#products" className="btn-primary px-10 py-4 rounded-full text-lg font-bold flex items-center gap-3 shadow-2xl">
              <span>Explore Products</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
            <button className="btn-secondary px-10 py-4 rounded-full text-lg font-bold">
              Contact Sales
            </button>
          </div>

          {/* Stats */}
          <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '10', suffix: 'K+', label: 'Active Users' },
              { value: '99', suffix: '.9%', label: 'Uptime' },
              { value: '50', suffix: '+', label: 'Countries' },
              { value: '24', suffix: '/7', label: 'Support' },
            ].map((stat, idx) => (
              <div key={idx} className="stat-card p-6 rounded-2xl">
                <div className="text-3xl md:text-4xl font-black text-gradient">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-gray-500 mt-2 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-14 rounded-full border-2 border-[#6FB63A]/40 flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-[#6FB63A] rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Products Section - Full Screen Showcases */}
      <section id="products" className="bg-white">
        {/* Section Header */}
        <AnimatedSection className="py-20 px-6 text-center">
          <span className="inline-block px-5 py-2 rounded-full bg-[#6FB63A]/10 text-[#5FA030] text-sm font-bold mb-6 border border-[#6FB63A]/20">
            OUR PRODUCTS
          </span>
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-gray-900">
            Powerful Solutions<br />
            <span className="text-gradient">for Every Need</span>
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Scroll down to discover our suite of innovative products designed to transform your business.
          </p>
        </AnimatedSection>

        {/* Full Screen Product Showcases */}
        {products.map((product, idx) => (
          <ProductShowcase key={product.id} product={product} index={idx} />
        ))}
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6 section-light">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <span className="inline-block px-5 py-2 rounded-full bg-[#6FB63A]/10 text-[#5FA030] text-sm font-bold mb-6 border border-[#6FB63A]/20">
              WHY CHOOSE US
            </span>
            <h2 className="text-4xl md:text-6xl font-black mb-6 text-gray-900">
              Built for<br />
              <span className="text-gradient">Excellence</span>
            </h2>
            <p className="text-gray-600 text-xl max-w-2xl mx-auto">
              Our platform is designed with the latest technologies to deliver exceptional performance.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <AnimatedSection key={idx} delay={idx * 150} className="feature-card p-8 rounded-2xl text-center">
                <div className="text-5xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 px-6 relative overflow-hidden">
        <div className="floating-orb w-[500px] h-[500px] bg-[#6FB63A]/10 -bottom-40 -left-40" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <AnimatedSection>
              <span className="inline-block px-5 py-2 rounded-full bg-[#6FB63A]/10 text-[#5FA030] text-sm font-bold mb-6 border border-[#6FB63A]/20">
                ABOUT US
              </span>
              <h2 className="text-3xl md:text-4xl font-black mb-8 text-gray-900 leading-tight">
                Innovating the<br />
                Future of <span className="text-gradient">Technology</span>
              </h2>
              <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                Cybrik Solution is a leading technology company specializing in AI-powered solutions for education and business. We combine cutting-edge technology with deep domain expertise to create products that truly make a difference.
              </p>
              <p className="text-gray-600 text-lg mb-10 leading-relaxed">
                Our mission is to empower individuals and organizations with intelligent tools that enhance productivity, streamline processes, and drive success.
              </p>
              <button className="btn-primary px-8 py-4 rounded-full font-bold shadow-xl">
                Learn More About Us
              </button>
            </AnimatedSection>

            {/* Dynamic Visual */}
            <AnimatedSection delay={200}>
              <div className="w-full aspect-square rounded-3xl bg-gradient-to-br from-[#6FB63A]/5 to-[#7FC448]/10 border border-[#6FB63A]/10 flex items-center justify-center overflow-hidden">
                {/* Animated Rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-80 h-80 rounded-full border border-[#6FB63A]/10 animate-rotate-slow"></div>
                  <div className="absolute w-64 h-64 rounded-full border border-[#6FB63A]/15 animate-rotate-slow" style={{ animationDirection: 'reverse', animationDuration: '25s' }}></div>
                  <div className="absolute w-48 h-48 rounded-full border border-[#6FB63A]/20 animate-rotate-slow" style={{ animationDuration: '15s' }}></div>
                </div>

                {/* Center Element */}
                <div className="relative z-10 text-center">
                  <div className="w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br from-[#6FB63A] to-[#5FA030] flex items-center justify-center animate-glow-pulse shadow-2xl">
                    <span className="text-6xl font-black text-white">C</span>
                  </div>
                  <div className="mt-6 text-[#6FB63A] tracking-[0.3em] text-sm font-bold uppercase">
                    Innovation • Excellence • Impact
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-6 section-light">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <span className="inline-block px-5 py-2 rounded-full bg-[#6FB63A]/10 text-[#5FA030] text-sm font-bold mb-6 border border-[#6FB63A]/20">
              GET IN TOUCH
            </span>
            <h2 className="text-3xl md:text-5xl font-black mb-6 text-gray-900">
              Ready to Get<br />
              <span className="text-gradient">Started?</span>
            </h2>
            <p className="text-gray-600 text-xl mb-12 max-w-2xl mx-auto">
              Have questions or want to learn more? Reach out to our team and we'll get back to you shortly.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={200} className="glass-card rounded-3xl p-10 shadow-2xl">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <input
                  type="text"
                  placeholder="Your Name"
                  className="input-futuristic w-full px-6 py-4 rounded-xl text-gray-800 placeholder-gray-400"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  className="input-futuristic w-full px-6 py-4 rounded-xl text-gray-800 placeholder-gray-400"
                />
              </div>
              <textarea
                placeholder="Your Message"
                rows={5}
                className="input-futuristic w-full px-6 py-4 rounded-xl text-gray-800 placeholder-gray-400 resize-none"
              ></textarea>
              <button type="submit" className="btn-primary w-full py-5 rounded-xl font-bold text-lg shadow-2xl">
                Send Message
              </button>
            </form>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Image
                  src="/images/cybrik-logo.png"
                  alt="Cybrik Logo"
                  width={40}
                  height={40}
                  className="rounded-xl logo-glow"
                />
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Empowering businesses and education with AI-powered tools.
              </p>
            </div>
            {[
              { title: 'Products', links: ['IELTS Portal', 'CRM System', 'PTE Portal'] },
              { title: 'Company', links: ['About Us', 'Contact', 'Careers'] },
              { title: 'Legal', links: ['Privacy Policy', 'Terms of Service'] },
            ].map((section, idx) => (
              <div key={idx}>
                <h4 className="font-bold mb-4 text-gray-900">{section.title}</h4>
                <ul className="space-y-3 text-gray-500 text-sm">
                  {section.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <a href="#" className="hover:text-[#6FB63A] transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center text-gray-400 text-sm pt-8 border-t border-gray-100">
            © {new Date().getFullYear()} Cybrik Solution. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
