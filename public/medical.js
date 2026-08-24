(function () {
  'use strict';

  var form = document.getElementById('medicalTransferForm');
  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    try {
      if (window.JettsetMetaTracking) window.JettsetMetaTracking.enrichForm(form);
      var response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });
      if (!response.ok) throw new Error('Form submission failed');
      if (window.JettsetMetaTracking) window.JettsetMetaTracking.trackLead(form);
    } catch (error) {
      var failedStatus = document.getElementById('medicalFormStatus');
      if (failedStatus) {
        failedStatus.textContent = 'We could not send this enquiry. Please try again or contact the Jettset team directly.';
        failedStatus.focus();
      }
      return;
    }

    var status = document.getElementById('medicalFormStatus');
    if (status) {
      status.textContent = 'Thank you. This enquiry shell is not yet connected. Please call or WhatsApp the Jettset team for immediate assistance.';
      status.focus();
    }
  });
}());
