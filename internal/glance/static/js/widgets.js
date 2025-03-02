import morphdom from './morphdom-esm.js';
import { componentDynamicRelativeTime } from './components/dynamic-relative-time.js';
import { componentPopovers } from './components/popovers.js';

const debug = false;
let debugLog;
if (debug) {
	debugLog = function(...args) {
		console.log(...args);
	}
} else {
	debugLog = function(...args) {}
}

export function widgetRefresh(pageData, onChange) {
    return {
		widgets: {},
		init: function() {
			try {
				// Find all widgets in our loaded page "id=widget-metadata-<id>"
				const widgetElements = document.querySelectorAll("[id^=widget-metadata-]");
				if (widgetElements.length == 0) {
					return;
				}
				for (let i = 0; i < widgetElements.length; i++) {
					const element = widgetElements[i];
					const id = element.id.replace("widget-metadata-", "");
					const data = element.innerHTML.trim();
					if (data === undefined) {
						debugLog(`No widget metadata found for ${id}`);
						continue;
					}
		
					try {
						const metadata = JSON.parse(data);
						debugLog(`Loaded widget metadata for ${id}`, metadata);

						if (this.widgets[id] === undefined) {
							this.widgets[id] = {};
							this.widgets[id].components = [];
						}
						this.widgets[id].metadata = metadata;
						this.widgets[id].element = document.getElementById(`widget-${id}`);;

						const dynRelTime = componentDynamicRelativeTime(this.widgets[id].element);
						dynRelTime.load();
						this.widgets[id].components.push(dynRelTime);

						const popover = componentPopovers(this.widgets[id].element);
						popover.load();
						this.widgets[id].components.push(popover);

					} catch (e) {
						console.error(`Failed to parse widget metadata for ${id}`, e);
					}
				}
			} catch (error) {
				console.error("Error loading widget metadata:", error);       
			}
		
			try {
				for (const id in this.widgets) {
					this.refreshWidget(id, false);
				}
			} catch (error) {
				console.error("Error setting up widget refresh:", error);      
			}
		},
        fetchWidgetContent: async function (pageData, id) {
			const widget = this.widgets[id];
			if (!widget || !widget.metadata) {
				return undefined;
			}

			if (widget.metadata.Type === "iframe") {
				// Find the iframe element
				const widgetElement = widget.element.querySelector("iframe");
				if (!widgetElement) {
					console.error(`No iframe element found for widget ${id}`);
					return undefined;
				}

				// For iframes, we need to fetch the url from the element
				const url = widgetElement.getAttribute("src");
				if (!url) {
					console.error(`No src found for iframe widget ${id}`);
					return undefined;
				}

				if (!widgetElement.parentNode) {
					console.error(`No parent node found for iframe widget ${id}`);
					return undefined;
				}

				const height = widgetElement.getAttribute("height");
				const width = widgetElement.getAttribute("width");
				const frameborder = widgetElement.getAttribute("frameborder");

				// Create a new iframe element and set its attributes
				const newIframe = document.createElement("iframe");
				newIframe.setAttribute("src", url);
				newIframe.setAttribute("width", width);
				newIframe.setAttribute("height", height);
				newIframe.setAttribute("frameborder", frameborder);

				// Initial we want this new iframe to be hidden
				newIframe.style.display = "none";

				// Wait for the iframe to load
				await new Promise((resolve, reject) => {
					const cleanup = () => {
						newIframe.onload = null;
						newIframe.onerror = null;
					}

					newIframe.onload = () => {
						// Once the iframe is loaded, we can remove the old iframe and show the new one
						widgetElement.parentNode.removeChild(widgetElement);

						newIframe.style.display = "block";

						cleanup();
						resolve();
					};
					newIframe.onerror = () => {
						widgetElement.parentNode.removeChild(newIframe);
						cleanup();
						reject(new Error(`Error loading iframe widget ${id}`));
					};

					// Now add the new temporary iframe to the page and wait for it to load
					widgetElement.parentNode.appendChild(newIframe);
				});

				return undefined;
			}


			// TODO: handle non 200 status codes/time outs
			// TODO: add retries
		
			const url = `${pageData.baseURL}/api/pages/${pageData.slug}/widget/${id}/content/`;
			// const url = `${pageData.baseURL}/api/widgets/${id}/`;
			const response = await fetch(url);
			const content = await response.text();
		
			return content;
		},
		refreshWidget: async function(id, now = false) {
			try {
				const widget = this.widgets[id];
				if (!widget || !widget.metadata) {
					return;
				}
				const refreshInterval = widget.metadata.Refresh;
				if (!refreshInterval || refreshInterval <= 0) {
					return;
				}
		
				if (now) {
					debugLog(`Refreshing widget ${id}...`);
					
					try {
						const content = await this.fetchWidgetContent(pageData, id);

						if(content) {
							if (widget.element) {
								widget.components.forEach(c => c.unload());

								morphdom(widget.element, content);
								// widgetElement.innerHTML = content;
								// widgetElement.classList.add("widget-content-loaded");
								debugLog(`Fetched widget content for ${id}`);

								widget.components.forEach(c => c.load());

								if(onChange) {
									await onChange(id, widget.element);
								}
							} else {
								console.error(`Widget element not found for ${id}`);
							}
						}
			
					} catch (error) {
						console.error(`Error fetching widget content for ${id}:`, error);
					}
				} else {
					debugLog(`Refreshing widget ${id} in ${refreshInterval}ms...`);
				}
		
				if (widget.refreshTimeout) {
					clearTimeout(widget.refreshTimeout);
				}
				widget.refreshTimeout = setTimeout(() => this.refreshWidget(id, true), refreshInterval);
			} catch (error) {
				console.error("Error refreshing widget:", error);  
			}
		}
    };
}
