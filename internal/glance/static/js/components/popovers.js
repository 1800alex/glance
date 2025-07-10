export function componentPopovers(element) {
	let targets = null;

	const defaultShowDelayMs = 200;
	const defaultHideDelayMs = 500;
	const defaultMaxWidth = "300px";
	const defaultDistanceFromTarget = "0px"
	const htmlContentSelector = "[data-popover-html]";

	let activeTarget = null;
	let pendingTarget = null;
	let cleanupOnHidePopover = null;
	let togglePopoverTimeout = null;

	let containerElement = null;
	let containerComputedStyle = null;
	let frameElement = null;
	let contentElement = null;

	let queueRepositionContainer;
	let observer;

	const handleMouseEnter = (event) => {
		clearTogglePopoverTimeout();
		const target = event.target;
		pendingTarget = target;
		const showDelay = target.dataset.popoverShowDelay || defaultShowDelayMs;

		if (activeTarget !== null) {
			if (activeTarget !== target) {
				hidePopover();
				requestAnimationFrame(() => requestAnimationFrame(showPopover));
			} else if (activeTarget.dataset.popoverTrigger === "click") {
				hidePopover();
			}

			return;
		}

		togglePopoverTimeout = setTimeout(showPopover, showDelay);
	}

	const handleMouseLeave = (event) => {
		clearTogglePopoverTimeout();
		const target = activeTarget || event.target;
		togglePopoverTimeout = setTimeout(hidePopover, target.dataset.popoverHideDelay || defaultHideDelayMs);
	}

	const clearTogglePopoverTimeout = () => {
		clearTimeout(togglePopoverTimeout);
	}

	const showContent = () => {
		if (activeTarget === null) return;
		if (contentElement === null) return;

		const popoverType = activeTarget.dataset.popoverType;

		if (popoverType === "text") {
			const text = activeTarget.dataset.popoverText;
			if (text === undefined || text === "") return;
			contentElement.textContent = text;
		} else if (popoverType === "html") {
			const htmlContent = activeTarget.querySelector(htmlContentSelector);
			if (htmlContent === null) return;
			/**
			 * The reason for all of the below shenanigans is that I want to preserve
			 * all attached event listeners of the original HTML content. This is so I don't have to
			 * re-setup events for things like lazy images, they'd just work as expected.
			 */
			const placeholder = document.createComment("");
			htmlContent.replaceWith(placeholder);
			contentElement.replaceChildren(htmlContent);
			htmlContent.removeAttribute("data-popover-html");
			cleanupOnHidePopover = () => {
				htmlContent.setAttribute("data-popover-html", "");
				placeholder.replaceWith(htmlContent);
				placeholder.remove();
			};
		} else {
			return;
		}

		const contentMaxWidth = activeTarget.dataset.popoverMaxWidth || defaultMaxWidth;

		if (activeTarget.dataset.popoverTextAlign !== undefined) {
			contentElement.style.textAlign = activeTarget.dataset.popoverTextAlign;
		} else {
			contentElement.style.removeProperty("text-align");
		}

		contentElement.style.maxWidth = contentMaxWidth;
		activeTarget.classList.add("popover-active");
		document.addEventListener("keydown", handleHidePopoverOnEscape);
		window.addEventListener("scroll", queueRepositionContainer);
		window.addEventListener("resize", queueRepositionContainer);
		observer.observe(containerElement);
	}

	const clearContent = () => {
		if (contentElement === null) return;
		contentElement.textContent = "";
		document.removeEventListener("keydown", handleHidePopoverOnEscape);
		window.removeEventListener("scroll", queueRepositionContainer);
		window.removeEventListener("resize", queueRepositionContainer);
		observer.unobserve(containerElement);
	}

	const showPopover = () => {
		if (pendingTarget === null) return;

		activeTarget = pendingTarget;
		pendingTarget = null;

		showContent();
	}

	const repositionContainer = () => {
		if (activeTarget === null) return;

		containerElement.style.display = "block";

		const targetBounds = activeTarget.dataset.popoverAnchor !== undefined
			? activeTarget.querySelector(activeTarget.dataset.popoverAnchor).getBoundingClientRect()
			: activeTarget.getBoundingClientRect();

		const containerBounds = containerElement.getBoundingClientRect();
		const containerInlinePadding = parseInt(containerComputedStyle.getPropertyValue("padding-inline"));
		const targetBoundsWidthOffset = targetBounds.width * (activeTarget.dataset.popoverTargetOffset || 0.5);
		const position = activeTarget.dataset.popoverPosition || "below";
		const popoverOffest = activeTarget.dataset.popoverOffset || 0.5;
		const left = Math.round(targetBounds.left + targetBoundsWidthOffset - (containerBounds.width * popoverOffest));

		if (left < 0) {
			containerElement.style.left = 0;
			containerElement.style.removeProperty("right");
			containerElement.style.setProperty("--triangle-offset", targetBounds.left - containerInlinePadding + targetBoundsWidthOffset + "px");
		} else if (left + containerBounds.width > window.innerWidth) {
			containerElement.style.removeProperty("left");
			containerElement.style.right = 0;
			containerElement.style.setProperty("--triangle-offset", containerBounds.width - containerInlinePadding - (document.documentElement.clientWidth - targetBounds.left - targetBoundsWidthOffset) + -1 + "px");
		} else {
			containerElement.style.removeProperty("right");
			containerElement.style.left = left + "px";
			containerElement.style.setProperty("--triangle-offset", ((targetBounds.left + targetBoundsWidthOffset) - left - containerInlinePadding) + -1 + "px");
		}

		const distanceFromTarget = activeTarget.dataset.popoverMargin || defaultDistanceFromTarget;
		const topWhenAbove = targetBounds.top + window.scrollY - containerBounds.height;
		const topWhenBelow = targetBounds.top + window.scrollY + targetBounds.height;

		if (
			position === "above" && topWhenAbove > window.scrollY ||
			(position === "below" && topWhenBelow + containerBounds.height > window.scrollY + window.innerHeight)
		) {
			containerElement.classList.add("position-above");
			frameElement.style.removeProperty("margin-top");
			frameElement.style.marginBottom = distanceFromTarget;
			containerElement.style.top = topWhenAbove + "px";
		} else {
			containerElement.classList.remove("position-above");
			frameElement.style.removeProperty("margin-bottom");
			frameElement.style.marginTop = distanceFromTarget;
			containerElement.style.top = topWhenBelow + "px";
		}
	}

	const hidePopover = () => {
		if (activeTarget === null) return;

		activeTarget.classList.remove("popover-active");
		containerElement.style.display = "none";
		containerElement.style.removeProperty("top");
		containerElement.style.removeProperty("left");
		containerElement.style.removeProperty("right");
		clearContent();

		if (cleanupOnHidePopover !== null) {
			cleanupOnHidePopover();
			cleanupOnHidePopover = null;
		}

		activeTarget = null;
	}

	const handleHidePopoverOnEscape = (event) => {
		if (event.key === "Escape") {
			hidePopover();
		}
	}

	return {
		element: element,
		load: function() {
			targets = element.querySelectorAll("[data-popover-type]");

			containerElement = document.createElement("div");
			containerElement.id = `popover-${element.id}`;
			containerComputedStyle = getComputedStyle(containerElement);
			containerElement.addEventListener("mouseenter", clearTogglePopoverTimeout);
			containerElement.addEventListener("mouseleave", handleMouseLeave);
			containerElement.classList.add("popover-container");

			frameElement = document.createElement("div");
			frameElement.id = `popover-frame-${element.id}`;
			frameElement.classList.add("popover-frame");

			contentElement = document.createElement("div");
			contentElement.id = `popover-content-${element.id}`;
			contentElement.classList.add("popover-content");

			frameElement.append(contentElement);
			containerElement.append(frameElement);
			containerElement.id = `popover-container-${element.id}`;
			document.body.append(containerElement);

			queueRepositionContainer = () => requestAnimationFrame(repositionContainer);
			observer = new ResizeObserver(queueRepositionContainer);


			for (let i = 0; i < targets.length; i++) {
				const target = targets[i];

				if (target.dataset.popoverTrigger === "click") {
					target.addEventListener("click", handleMouseEnter);
				} else {
					target.addEventListener("mouseenter", handleMouseEnter);
				}

				target.addEventListener("mouseleave", handleMouseLeave);
			}
		},
		pause: function() {
			for (let i = 0; i < targets.length; i++) {
				const target = targets[i];
				// target.classList.remove("popover-active");
				target.removeEventListener("click", handleMouseEnter);
				target.removeEventListener("mouseenter", handleMouseEnter);
				target.removeEventListener("mouseleave", handleMouseLeave);
			}
			window.removeEventListener("scroll", queueRepositionContainer);
			window.removeEventListener("resize", queueRepositionContainer);
			document.removeEventListener("keydown", handleHidePopoverOnEscape);

			clearContent();
		},
		resume: function() {
			targets = element.querySelectorAll("[data-popover-type]");

			for (let i = 0; i < targets.length; i++) {
				const target = targets[i];
				if (target.dataset.popoverTrigger === "click") {
					target.addEventListener("click", handleMouseEnter);
				} else {
					target.addEventListener("mouseenter", handleMouseEnter);
				}

				target.addEventListener("mouseleave", handleMouseLeave);
			}
			showContent();
		},
	};
}