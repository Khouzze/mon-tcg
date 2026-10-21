import './globals.css';
import { Bricolage_Grotesque } from 'next/font/google';

const font = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '600', '800'] });

export const metadata = { title: 'TCG ESPORT ÎLE', description: 'Le TCG de la bande' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={font.className}>{children}</body>
    </html>
  );
}
