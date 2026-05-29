export function Wordmark() {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[var(--brand-plum-darkest)] sm:h-[34px] sm:w-[34px] sm:rounded-[9px]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="#FDFBF9"
          className="h-[17px] w-[17px] sm:h-[19px] sm:w-[19px]"
        >
          <path d="M12 2C9 7 5 11 5 15a7 7 0 0014 0c0-4-4-8-7-13z" />
        </svg>
      </span>
      <span className="font-header text-[19px] font-medium leading-none text-[var(--brand-plum-darkest)] sm:text-[22px]">
        chaarlie
      </span>
    </div>
  )
}
