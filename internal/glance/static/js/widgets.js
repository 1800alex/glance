import morphdom from './morphdom-esm.js';
import { componentDynamicRelativeTime } from './components/dynamic-relative-time.js';

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

						const c = componentDynamicRelativeTime(this.widgets[id].element);
						c.load();
						this.widgets[id].components.push(c);

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
