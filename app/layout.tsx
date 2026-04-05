export const metadata = {
  title: 'SIRIO - TPV',
  description: 'Sistema de punto de venta con VeriFactu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
