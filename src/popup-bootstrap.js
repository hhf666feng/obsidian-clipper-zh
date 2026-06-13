(function () {
	var fallbackRendered = false;

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

	window.addEventListener('error', handleError);
	window.addEventListener('unhandledrejection', handleError);
})();
