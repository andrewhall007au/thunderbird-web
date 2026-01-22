'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#why-sms', label: 'Why SMS' },
  { href: '#see-it-in-action', label: 'See It In Action' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
  { href: '#about', label: 'About' },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="text-gray-900 p-2 -mr-2"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-[70] shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <span className="font-semibold text-gray-900">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-900 p-2 -mr-2"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="p-4">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <div className="mt-6 px-4">
            <Link
              href="/checkout"
              onClick={() => setIsOpen(false)}
              className="btn-orange block w-full text-center py-3"
            >
              Buy Now
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
