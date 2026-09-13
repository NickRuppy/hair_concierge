import Image from "next/image"

import type { ScanExampleCard as ScanExampleCardModel } from "@/lib/quiz/scan-insert-examples"

import { ScanExampleCard } from "./scan-example-card"

/** Photo of the moment the insert talks about, with the scanner verdict on it. */
export function ScanInsertPhoto({
  alt,
  card,
  src,
}: {
  alt: string
  card: ScanExampleCardModel
  src: string
}) {
  return (
    /*
      Width-capped: at the quiz column's full width (576 px) the 400 px-tall
      frame turns landscape and crops the head off insert 1 and the phone's top
      third off inserts 2 and 3. The cap is above every phone width, so the
      mobile crop is untouched and the desktop one matches it.
    */
    <div className="relative mx-auto h-[400px] w-full max-w-[400px] overflow-hidden rounded-[24px] bg-[var(--brand-plum-ice)] shadow-[0_30px_70px_-40px_rgba(42,24,69,0.6)]">
      <Image
        alt={alt}
        className="object-cover"
        fill
        priority
        sizes="(max-width: 640px) 100vw, 40rem"
        src={src}
      />
      <ScanExampleCard card={card} />
    </div>
  )
}
