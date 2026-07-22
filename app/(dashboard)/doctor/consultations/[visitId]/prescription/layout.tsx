export default function PrescriptionPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="prescription-print-root min-h-svh bg-neutral-200 print:bg-white">
      {children}
    </div>
  );
}
