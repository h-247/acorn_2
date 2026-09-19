import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Acorn — Every class makes your teaching smarter',
  description: 'Evidence-grounded learning-material platform for English centers by Agentivium AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F3F6FC]/60 text-[#082051]">
        {children}
      </body>
    </html>
  );
}
