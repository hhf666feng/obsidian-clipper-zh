(function () {
	var fallbackRendered = false;
	var fallbackStateObserved = false;

	function isClipperHidden() {
		var clipper = document.querySelector('.clipper');
		return !!(clipper && clipper.style.display === 'none');
	}

	function isFatalPopupState() {
		return !!(document.body && document.body.classList.contains('has-error') && isClipperHidden());
	}

	function isClipTargetUrl(url) {
		return !url || /^https?:\/\//i.test(url);
	}

	function setValue(id, value) {
		var element = document.getElementById(id);
		if (element && 'value' in element) {
			element.value = value || '';
			return true;
		}
		return false;
	}

	function appendProperty(container, name, value) {
		var property = document.createElement('div');
		property.className = 'metadata-property';

		var key = document.createElement('div');
		key.className = 'metadata-property-key';

		var label = document.createElement('label');
		label.setAttribute('for', name);
		label.textContent = name;
		key.appendChild(label);

		var valueContainer = document.createElement('div');
		valueContainer.className = 'metadata-property-value';

		var input = document.createElement('input');
		input.id = name;
		input.setAttribute('data-type', 'text');
		input.value = value || '';
		valueContainer.appendChild(input);

		property.appendChild(key);
		property.appendChild(valueContainer);
		container.appendChild(property);
	}

	function renderBootstrapFallback(cause) {
		if (fallbackRendered || (document.body && (document.body.dataset.popupReady || document.body.dataset.fallbackRendered))) return;
		fallbackRendered = true;

		var title = document.title || 'Untitled';
		var url = '';

		if (window.browser && browser.tabs && browser.tabs.query) {
			browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
				var tab = tabs && tabs[0];
				renderFields(tab && (tab.title || title), tab && tab.url, cause);
			}).catch(function () {
				renderFields(title, url, cause);
			});
			return;
		}

		renderFields(title, url, cause);
	}

	function renderFields(title, url, cause) {
		if (!isClipTargetUrl(url)) {
			fallbackRendered = false;
			return;
		}

		setValue('note-name-field', title || 'Untitled');
		setValue('note-content-field', '');
		setValue('path-name-field', 'Clippings');

		var metadataProperties = document.querySelector('.metadata-properties');
		if (metadataProperties) {
			metadataProperties.textContent = '';
			appendProperty(metadataProperties, 'title', title || 'Untitled');
			appendProperty(metadataProperties, 'source', url || '');
		}

		var errorMessage = document.querySelector('.error-message');
		if (errorMessage) {
			errorMessage.style.display = 'none';
			errorMessage.textContent = '';
		}

		var clipper = document.querySelector('.clipper');
		if (clipper) {
			clipper.style.display = 'block';
		}

		if (document.body) {
			document.body.classList.remove('has-error');
			document.body.classList.remove('has-inline-error');
			document.body.dataset.fallbackRendered = 'bootstrap';
			document.body.dataset.bootstrapFallbackCause = String(cause && (cause.message || cause) || 'unknown').slice(0, 200);
		}
	}

	function handleError(event) {
		var cause = event && (event.error || event.reason || event.message);
		window.setTimeout(function () {
			renderBootstrapFallback(cause);
		}, 0);
	}

	function recoverFatalPopupState() {
		if (fallbackStateObserved || !isFatalPopupState()) return;
		fallbackStateObserved = true;
		window.setTimeout(function () {
			if (isFatalPopupState()) {
				renderBootstrapFallback('fatal popup state');
			} else {
				fallbackStateObserved = false;
			}
		}, 0);
	}

	function observeFatalPopupState() {
		window.setTimeout(recoverFatalPopupState, 100);
		window.setTimeout(recoverFatalPopupState, 1000);

		if (!window.MutationObserver || !document.body) return;
		var observer = new MutationObserver(recoverFatalPopupState);
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ['class', 'style'],
			childList: true,
			subtree: true,
		});
	}

	window.addEventListener('error', handleError);
	window.addEventListener('unhandledrejection', handleError);
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', observeFatalPopupState, { once: true });
	} else {
		observeFatalPopupState();
	}
})();
