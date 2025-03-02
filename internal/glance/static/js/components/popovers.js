const defaultShowDelayMs = 200;
const defaultHideDelayMs = 500;
const defaultMaxWidth = "300px";
const defaultDistanceFromTarget = "0px"
const htmlContentSelector = "[data-popover-html]";

export function componentPopoversOLD(element) {
	return {
		element: element,
		unload: () => {},
		load: function () {
			let activeTarget = null;
			let pendingTarget = null;
			let cleanupOnHidePopover = null;
			let togglePopoverTimeout = null;

			const clearTogglePopoverTimeout = () => {
				clearTimeout(togglePopoverTimeout);
			};

			const containerElement = document.createElement("div");
			const containerComputedStyle = getComputedStyle(containerElement);

			const frameElement = document.createElement("div");

			const contentElement = document.createElement("div");

			const queueRepositionContainer = () => requestAnimationFrame(repositionContainer);
			const observer = new ResizeObserver(queueRepositionContainer);

			const handleMouseEnter = (event) => {
				clearTogglePopoverTimeout();
				const target = event.target;
				pendingTarget = target;
				const showDelay = target.dataset.popoverShowDelay || defaultShowDelayMs;

				if (activeTarget !== null) {
					if (activeTarget !== target) {
						hidePopover();
						requestAnimationFrame(() => requestAnimationFrame(showPopover));
					}

					return;
				}

				togglePopoverTimeout = setTimeout(showPopover, showDelay);
			};

			const handleMouseLeave = (event) => {
				clearTogglePopoverTimeout();
				const target = activeTarget || event.target;
				togglePopoverTimeout = setTimeout(hidePopover, target.dataset.popoverHideDelay || defaultHideDelayMs);
			};

			const showPopover = () => {
				if (pendingTarget === null) return;

				activeTarget = pendingTarget;
				pendingTarget = null;

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
				window.addEventListener("resize", queueRepositionContainer);
				observer.observe(containerElement);
			};

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
					containerElement.style.setProperty("--triangle-offset", containerBounds.width - containerInlinePadding - (window.innerWidth - targetBounds.left - targetBoundsWidthOffset) + -1 + "px");
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
			};

			const hidePopover = () => {
				if (activeTarget === null) return;

				activeTarget.classList.remove("popover-active");
				containerElement.style.display = "none";
				document.removeEventListener("keydown", handleHidePopoverOnEscape);
				window.removeEventListener("resize", queueRepositionContainer);
				observer.unobserve(containerElement);

				if (cleanupOnHidePopover !== null) {
					cleanupOnHidePopover();
					cleanupOnHidePopover = null;
				}

				activeTarget = null;
			};

			const handleHidePopoverOnEscape = (event) => {
				if (event.key === "Escape") {
					hidePopover();
				}
			};

			this.targets = element.querySelectorAll("[data-popover-type]");

			for (let i = 0; i < this.targets.length; i++) {
				const target = this.targets[i];
		
				target.addEventListener("mouseenter", handleMouseEnter);
				target.addEventListener("mouseleave", handleMouseLeave);
			}

			this.unload = () => {
				for (let i = 0; i < this.targets.length; i++) {
					const target = this.targets[i];
		
					target.removeEventListener("mouseenter", handleMouseEnter);
					target.removeEventListener("mouseleave", handleMouseLeave);
				}
				hidePopover();
				document.body.removeChild(containerElement);
				observer.disconnect();
				containerElement.removeEventListener("mouseenter", clearTogglePopoverTimeout);
				containerElement.removeEventListener("mouseleave", handleMouseLeave);
				containerElement.classList.remove("popover-container");
				frameElement.classList.remove("popover-frame");
				contentElement.classList.remove("popover-content");
				frameElement.remove();
				contentElement.remove();
				containerElement.remove();
			}

			containerElement.addEventListener("mouseenter", clearTogglePopoverTimeout);
			containerElement.addEventListener("mouseleave", handleMouseLeave);
			containerElement.classList.add("popover-container");
			frameElement.classList.add("popover-frame");
			contentElement.classList.add("popover-content");

			frameElement.append(contentElement);
			containerElement.append(frameElement);
			document.body.append(containerElement);
		},
	}
}


export function componentPopovers(element) {
	return {
		element: element,
		initialized: false,
		active: null,
		activeTarget: null,
		togglePopoverTimeout: null,
		showPopover: function() {
			console.log("Showing popover", this.active);
			if (this.active === null) {
				console.log("Popover is null, not showing");
				// this.containerElement.display = "none";
				this.containerElement.classList.remove("popover-active");
				return;
			}

			if (this.active.type === "text") {
				this.containerElement.textContent = this.active.text;
				// this.containerElement.display = "block";
				this.containerElement.classList.add("popover-active");
				console.log(`Showing popover with text: ${this.active.text}`);
			} else if (this.active.type === "html") {
				this.containerElement.replaceChildren(this.active.html);
				// this.containerElement.display = "block";
				this.containerElement.classList.add("popover-active");
				console.log(`Showing popover with HTML content: ${this.active.html}`);
			} else {
				// this.containerElement.display = "none";
				this.containerElement.classList.remove("popover-active");
			}
		},
		hidePopover: function() {
			console.log("Hiding popover");
			if (this.active === null) return;

			if (this.containerElement) {
				// this.containerElement.style.display = "none";
				this.containerElement.classList.remove("popover-active");
			}
			this.active = null;
		},
		getActive: function(event, target) {
			console.log(`Getting active popover for target: ${target}`);
			if(!target || !target.dataset) return null;

			const popoverType = target.dataset.popoverType;
			console.log(`Popover type: ${popoverType}`);

			if (popoverType === "text") {
				const text = target.dataset.popoverText;
				if (text === undefined || text === "") return null;
				return {
					type: "text",
					text: text,
					x: event.clientX,
					y: event.clientY,
				};
			} else if (popoverType === "html") {
				const htmlContent = target.querySelector(htmlContentSelector);
				if (htmlContent === null) return null;
				/**
				 * The reason for all of the below shenanigans is that I want to preserve
				 * all attached event listeners of the original HTML content. This is so I don't have to
				 * re-setup events for things like lazy images, they'd just work as expected.
				 */
				const placeholder = document.createComment("");
				htmlContent.replaceWith(placeholder);

				return {
					type: "html",
					html: htmlContent,
					x: event.clientX,
					y: event.clientY,
				};
			}
		
			return null;
		},
		clearTogglePopoverTimeout: function() {
			clearTimeout(this.togglePopoverTimeout);
		},
		handleMouseEnter: function(event) {
			this.clearTogglePopoverTimeout();
			const target = event.target;
			this.activeTarget = target;

			const showDelay = target.dataset.popoverShowDelay || defaultShowDelayMs;
			const active = this.getActive(event, target);

			if (this.active !== null) {
				if (active === null) {
					// hide
				} else if (this.active.type === active.type && this.active.text === active.text) {
					// do nothing
				} else {
					// hide
					// show
				}

				if (this.activeTarget !== target) {
					// hidePopover();
					// requestAnimationFrame(() => requestAnimationFrame(showPopover));
				}

				// return;
			}

			this.active = active;

			console.log(`Setting active popover: ${this.active} in ${showDelay}ms`);
			this.togglePopoverTimeout = setTimeout(() => this.showPopover(), showDelay);
		},
		handleMouseLeave: function(event) {
			this.clearTogglePopoverTimeout();
			const target = this.activeTarget || event.target;
			this.togglePopoverTimeout = setTimeout(() => this.hidePopover(), target.dataset.popoverHideDelay || defaultHideDelayMs);
		},
		unload: () => {},
		load: function () {
			if (!this.initialized) {
				this.initialized = true;

				// Create a new popover container element and add it to our parent
				this.containerElement = document.createElement("div");

				// Get the id of our element
				const elementId = this.element.id;

				// Give it a unique ID
				this.containerElement.id = "popover-container-" + elementId;
				console.log(`Creating popover container with id ${this.containerElement.id}`);

				// Make our popover container position absolute
				// this.containerElement.style.position = "absolute";
				// this.containerElement.style.display = "none";

				this.containerElement.classList.add("popover-container");
				this.element.parentElement.append(this.containerElement);
			}

			const handleMouseEnter = (event) => this.handleMouseEnter(event);
			const handleMouseLeave = (event) => this.handleMouseLeave(event);

			this.targets = element.querySelectorAll("[data-popover-type]");
			this.targets.forEach(target => {
				target.addEventListener("mouseenter", handleMouseEnter);
				target.addEventListener("mouseleave", handleMouseLeave);
			});

			this.unload = () => {
				this.targets.forEach(target => {
					target.removeEventListener("mouseenter", handleMouseEnter);
					target.removeEventListener("mouseleave", handleMouseLeave);
				});
				this.clearTogglePopoverTimeout();
			}
		},
	}
}
