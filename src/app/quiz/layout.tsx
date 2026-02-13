export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#0A0A0A]">
      <div className="relative z-10 flex w-full max-w-[420px] flex-col px-4 py-6">
        {children}
      </div>
    </div>
  )
}
