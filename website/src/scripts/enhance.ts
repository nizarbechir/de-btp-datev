/**
 * Progressive enhancement for the landing page. The page is complete without it.
 * Everything that moves respects prefers-reduced-motion.
 */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setupHeader() {
	const header = document.querySelector<HTMLElement>("[data-header]");
	const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
	const menu = document.querySelector<HTMLElement>("[data-menu]");
	const label = toggle?.querySelector<HTMLElement>("[data-menu-label]");
	if (!header || !toggle || !menu || !label) return;

	const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
	onScroll();
	window.addEventListener("scroll", onScroll, { passive: true });

	const setOpen = (open: boolean) => {
		menu.hidden = !open;
		header.classList.toggle("is-open", open);
		toggle.setAttribute("aria-expanded", String(open));
		label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? "";
		document.body.style.overflow = open ? "hidden" : "";
	};
	toggle.addEventListener("click", () => setOpen(menu.hidden !== false));
	menu.addEventListener("click", (event) => {
		if ((event.target as HTMLElement).closest("a")) setOpen(false);
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && menu.hidden === false) {
			setOpen(false);
			toggle.focus();
		}
	});
	window.matchMedia("(min-width: 56.0625rem)").addEventListener("change", (event) => {
		if (event.matches) setOpen(false);
	});
}

function setupReveal() {
	const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
	if (reducedMotion || !("IntersectionObserver" in window)) {
		elements.forEach((el) => el.classList.add("is-visible"));
		return;
	}
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("is-visible");
				observer.unobserve(entry.target);
			}
		},
		{ rootMargin: "0px 0px -8% 0px" },
	);
	elements.forEach((el) => observer.observe(el));
}

/** Count the hero figures up once; the server-rendered value is the end state. */
function setupCountUp() {
	if (reducedMotion) return;
	const elements = document.querySelectorAll<HTMLElement>("[data-count]");
	const format = new Intl.NumberFormat(document.documentElement.lang, { currency: "EUR", style: "currency" });
	const duration = 900;
	const start = performance.now();
	const targets = [...elements].map((el) => ({ el, value: Number(el.dataset.count) }));
	const tick = (now: number) => {
		const progress = Math.min(1, (now - start) / duration);
		const eased = 1 - Math.pow(1 - progress, 3);
		for (const { el, value } of targets) el.textContent = format.format(value * eased);
		if (progress < 1) requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/** Highlight the workflow step closest to the middle of the viewport. */
function setupSteps() {
	const steps = document.querySelectorAll<HTMLElement>("[data-step]");
	if (!steps.length || !("IntersectionObserver" in window)) return;
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					steps.forEach((step) => step.classList.toggle("is-active", step === entry.target));
				}
			}
		},
		{ rootMargin: "-45% 0px -45% 0px" },
	);
	steps.forEach((step) => observer.observe(step));
}

setupHeader();
setupReveal();
setupCountUp();
setupSteps();
