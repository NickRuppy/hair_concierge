"use client"

import { DiscreteSlider, type SliderStop } from "@/components/ui/slider"
import {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_SLIDER_LABEL_LINES,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

type FrequencySliderFieldProps = {
  stops: SliderStop[]
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
  ariaLabel: string
  selectedPlaceholder: string
  supportingText?: string
  legend?: string
}

/**
 * The shared, discrete frequency control used throughout Personal Plan.
 * Individual steps own their question copy; this component owns the familiar
 * spectrum, selected-value feedback, and slider interaction.
 */
export function FrequencySliderField({
  stops,
  value,
  onValueChange,
  disabled = false,
  ariaLabel,
  selectedPlaceholder,
  supportingText = "Von selten bis täglich",
  legend,
}: FrequencySliderFieldProps) {
  const selectedLabel = stops.find((stop) => stop.value === value)?.label
  const sliderStops = stops.map((stop) => ({
    ...stop,
    labelLines: PRODUCT_FREQUENCIES.includes(stop.value as ProductFrequency)
      ? PRODUCT_FREQUENCY_SLIDER_LABEL_LINES[stop.value as ProductFrequency]
      : stop.labelLines,
  }))

  return (
    <fieldset className="mb-5">
      {legend ? <legend className="text-sm font-semibold text-foreground">{legend}</legend> : null}
      <div className="mb-3 mt-1 flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">{supportingText}</p>
        <p className="text-sm font-semibold text-[var(--brand-plum)]">
          {selectedLabel ?? selectedPlaceholder}
        </p>
      </div>
      <DiscreteSlider
        stops={sliderStops}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </fieldset>
  )
}
