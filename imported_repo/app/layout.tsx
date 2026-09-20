import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'COWIO - Онлайн Кинотеатр Вместе',
  description: 'Платформа совместного просмотра видео и фильмов с синхронизацией VK Video, Rutube и YouTube, поддержкой комнат и чата.',
  openGraph: {
    title: 'COWIO - Онлайн Кинотеатр Вместе',
    description: 'Платформа совместного просмотра видео и фильмов с синхронизацией VK Video, Rutube и YouTube, поддержкой комнат и чата.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'COWIO - Онлайн Кинотеатр Вместе',
    description: 'Платформа совместного просмотра видео и фильмов с синхронизацией VK Video, Rutube и YouTube, поддержкой комнат и чата.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
