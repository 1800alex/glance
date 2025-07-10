const minuteInSeconds = 60;
const hourInSeconds = minuteInSeconds * 60;
const dayInSeconds = hourInSeconds * 24;
const monthInSeconds = dayInSeconds * 30.4;
const yearInSeconds = dayInSeconds * 365;

function timestampToRelativeTime(timestamp) {
    let delta = Math.round((Date.now() / 1000) - timestamp);
    let prefix = "";

    if (delta < 0) {
        delta = -delta;
        prefix = "in ";
    }

    if (delta < minuteInSeconds) {
        return prefix + "1m";
    }
    if (delta < hourInSeconds) {
        return prefix + Math.floor(delta / minuteInSeconds) + "m";
    }
    if (delta < dayInSeconds) {
        return prefix + Math.floor(delta / hourInSeconds) + "h";
    }
    if (delta < monthInSeconds) {
        return prefix + Math.floor(delta / dayInSeconds) + "d";
    }
    if (delta < yearInSeconds) {
        return prefix + Math.floor(delta / monthInSeconds) + "mo";
    }

    return prefix + Math.floor(delta / yearInSeconds) + "y";
}

function updateRelativeTimeForElements(elements)
{
    for (let i = 0; i < elements.length; i++)
    {
        const element = elements[i];
        const timestamp = element.dataset.dynamicRelativeTime;

        if (timestamp === undefined)
            continue

        element.textContent = timestampToRelativeTime(timestamp);
    }
}

export function componentDynamicRelativeTime(element) {
	return {
		element: element,
		elements: [],
		load: function() {
			this.elements = this.element.querySelectorAll("[data-dynamic-relative-time]");
			const updateInterval = 60 * 1000;
			let lastUpdateTime = Date.now();
		
			updateRelativeTimeForElements(this.elements);
		
			const updateElementsAndTimestamp = () => {
				updateRelativeTimeForElements(this.elements);
				lastUpdateTime = Date.now();
			};

			let interval;
			let timeout;
			
			const cleanupTimeouts = () => {
				if (interval) {
					clearInterval(interval);
					interval = undefined;
				}

				if (timeout) {
					clearTimeout(timeout);
					timeout = undefined;
				}
			}

			const scheduleRepeatingUpdate = () => {
				cleanupTimeouts();
				interval = setInterval(updateElementsAndTimestamp, updateInterval);
			};
		
			const visibilitychange = () => {
				if (document.hidden) {
					cleanupTimeouts();
					return;
				}
		
				const delta = Date.now() - lastUpdateTime;
		
				if (delta >= updateInterval) {
					updateElementsAndTimestamp();
					timeout = scheduleRepeatingUpdate();
					return;
				}
		
				timeout = setTimeout(() => {
					updateElementsAndTimestamp();
					timeout = scheduleRepeatingUpdate();
				}, updateInterval - delta);
			};

			this.pause = () => {
				cleanupTimeouts();
				document.removeEventListener("visibilitychange", visibilitychange);
			};

			this.resume = () => {
				document.addEventListener("visibilitychange", visibilitychange);
			}
		
			this.unload = () => {
				document.removeEventListener("visibilitychange", visibilitychange);
				cleanupTimeouts();
			};

			scheduleRepeatingUpdate();
			document.addEventListener("visibilitychange", visibilitychange);
		},
	}
}