document.querySelectorAll(".pricing-card").forEach((pricingCard) => {
  const plans = Array.from(pricingCard.querySelectorAll(".plan"))
  const checkoutButton = pricingCard.querySelector(".checkout-cta")
  const checkoutPreview = pricingCard.querySelector(".checkout-preview")

  plans.forEach((plan) => {
    plan.addEventListener("click", () => {
      plans.forEach((candidate) => candidate.classList.remove("selected"))
      plan.classList.add("selected")
      if (checkoutButton) {
        checkoutButton.textContent = plan.dataset.cta || "Mit Chaarlie starten"
      }
      checkoutPreview?.classList.remove("visible")
    })
  })

  checkoutButton?.addEventListener("click", () => {
    checkoutPreview?.classList.toggle("visible")
  })
})
