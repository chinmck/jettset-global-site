(function () {
  'use strict';

  var form = document.getElementById('medicalTransferForm');
  if (!form) return;

  var submissionInProgress = false;

  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    options.signal = controller.signal;
    return fetch(url, options).finally(function () { window.clearTimeout(timeoutId); });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submissionInProgress || !form.reportValidity()) return;

    var submitButton = form.querySelector('[type="submit"]');
    var formData = new FormData(form);
    var webhookPayload = {};

    formData.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(webhookPayload, key)) {
        webhookPayload[key] = Array.isArray(webhookPayload[key])
          ? webhookPayload[key].concat(value)
          : [webhookPayload[key], value];
      } else {
        webhookPayload[key] = value;
      }
    });
    webhookPayload.form_name = 'jettset-medical-aviation';

    submissionInProgress = true;
    form.setAttribute('aria-busy', 'true');
    if (submitButton) submitButton.disabled = true;

    try {
      if (window.JettsetMetaTracking) window.JettsetMetaTracking.enrichForm(form);
      var netlifyBody = new URLSearchParams(new FormData(form)).toString();
      var responses = await Promise.all([
        fetchWithTimeout('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: netlifyBody
        }, 15000),
        fetchWithTimeout('/.netlify/functions/jettset-medical-aviation-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        }, 15000)
      ]);

      if (!responses[0].ok) throw new Error('Netlify form submission failed');
      if (!responses[1].ok) throw new Error('Webhook submission failed');
      if (window.JettsetMetaTracking) window.JettsetMetaTracking.trackLead(form);
    } catch (error) {
      submissionInProgress = false;
      form.removeAttribute('aria-busy');
      if (submitButton) submitButton.disabled = false;
      var failedStatus = document.getElementById('medicalFormStatus');
      if (failedStatus) {
        failedStatus.textContent = 'We could not send this enquiry. Please try again or contact the Jettset team directly.';
        failedStatus.focus();
      }
      return;
    }

    submissionInProgress = false;
    form.removeAttribute('aria-busy');
    if (submitButton) submitButton.disabled = false;

    var status = document.getElementById('medicalFormStatus');
    if (status) {
      status.textContent = 'Thank you. This enquiry shell is not yet connected. Please call or WhatsApp the Jettset team for immediate assistance.';
      status.focus();
    }
  });
}());
