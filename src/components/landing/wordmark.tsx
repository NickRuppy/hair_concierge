export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[var(--brand-plum-darkest)]">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="22" fill="#FDFBF9">
          <path d="M12 2C9 7 5 11 5 15a7 7 0 0014 0c0-4-4-8-7-13z" />
        </svg>
      </span>
      <span className="font-header text-[22px] font-medium leading-none text-[var(--brand-plum-darkest)]">
        chaarlie
      </span>
    </div>
  )
}
