/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import { Head, Meta, Title } from '@inertiajs/react'
import { Inertia } from '@inertiajs/inertia'

interface LayoutProps {
  title?: string
  children: React.ReactNode
}

export default function Layout({ title = 'Meme Bank', children }: LayoutProps) {
  return (
    <html lang="en">
      <Head>
        <Title>{title}</Title>
        <Meta name="csrf-token" content={Inertia.csrfToken()} />
        <Meta name="description" content="Meme Bank - Your Video Collection" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" 
          rel="stylesheet" 
        />
        
        <script src="/@vite/client" />
      </Head>
      <body>
        <div id="app">
          {children}
        </div>
      </body>
    </html>
  )
}